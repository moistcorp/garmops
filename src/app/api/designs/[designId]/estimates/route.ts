import { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateDesignApi, cloudDesignsAvailable, designJson, designJsonError, hasExpectedDesignOrigin, readDesignJson } from "@/lib/designs/api";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/config/env";
import { buildEstimateSnapshot, calculateEstimatePricing } from "@/lib/pricing/engine";
import { publicEstimate } from "@/lib/estimates/api";
import { listDesignEstimates } from "@/lib/estimates/dal";
import type { Json } from "@/types/database.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const estimateRequestSchema = z.object({ expectedRevision: z.number().int().positive(), clientOperationId: z.uuid() }).strict();
type RouteContext = { params: Promise<{ designId: string }> };

async function getId(context: RouteContext) {
  return z.uuid().safeParse((await context.params).designId);
}

function hasPendingUpload(snapshot: z.infer<typeof cloudDesignSnapshotSchema>): boolean {
  return Boolean(
    snapshot.configuration.artwork.front?.pendingUpload ||
    snapshot.configuration.artwork.back?.pendingUpload ||
    snapshot.configuration.neckLabel?.pendingUpload,
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!cloudDesignsAvailable()) return designJsonError("Saved designs are unavailable", 503);
  const id = await getId(context);
  if (!id.success) return designJsonError("Saved design not found", 404);
  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;
  const { data, error } = await listDesignEstimates(auth.supabase, id.data, auth.user.id);
  if (error) return designJsonError("Estimates could not be loaded", 500);
  return designJson({ estimates: (data ?? []).map((estimate) => publicEstimate(estimate as never)) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!cloudDesignsAvailable()) return designJsonError("Saved designs are unavailable", 503);
  if (!hasExpectedDesignOrigin(request)) return designJsonError("Invalid request origin", 403);
  const id = await getId(context);
  if (!id.success) return designJsonError("Saved design not found", 404);
  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;
  const body = await readDesignJson(request, 32 * 1024);
  if (!body.ok) return body.response;
  const parsedRequest = estimateRequestSchema.safeParse(body.value);
  if (!parsedRequest.success) return designJsonError("Invalid estimate request", 400);

  const { data: design, error: designError } = await auth.supabase
    .from("design_projects")
    .select("id, organization_id, created_by, status, schema_version, draft_revision, draft_snapshot")
    .eq("id", id.data)
    .eq("created_by", auth.user.id)
    .maybeSingle();
  if (designError) return designJsonError("Saved design could not be loaded", 500);
  if (!design) return designJsonError("Saved design not found", 404);
  if (design.status !== "draft") return designJsonError("This saved design is not available for a new estimate", 422);
  if (design.draft_revision !== parsedRequest.data.expectedRevision) {
    return designJsonError("This design changed. Refresh it before generating an estimate.", 409);
  }
  const parsedSnapshot = cloudDesignSnapshotSchema.safeParse(design.draft_snapshot);
  if (!parsedSnapshot.success) return designJsonError("This saved design needs to be duplicated before it can be estimated", 422);
  if (hasPendingUpload(parsedSnapshot.data)) return designJsonError("Artwork is still uploading. Wait for the upload to finish before generating an estimate.", 422);

  const fileIds = [parsedSnapshot.data.configuration.artwork.front?.fileId, parsedSnapshot.data.configuration.artwork.back?.fileId, parsedSnapshot.data.configuration.neckLabel?.fileId].filter((value): value is string => Boolean(value));
  if (fileIds.length) {
    const { data: files, error: filesError } = await auth.supabase.from("order_files").select("id, upload_status, scan_status, deleted_at, design_project_id").in("id", fileIds);
    if (filesError || !files || files.length !== fileIds.length || files.some((file) => file.design_project_id !== id.data || file.upload_status !== "finalized" || file.deleted_at !== null || !["clean", "manual_review", "not_required"].includes(file.scan_status))) {
      return designJsonError("Artwork is still uploading. Wait for the upload to finish before generating an estimate.", 422);
    }
  }

  const [profileResult, organizationResult, addressResult] = await Promise.all([
    auth.supabase.from("profiles").select("first_name, last_name").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("organizations").select("display_name, legal_name, gstin, billing_email").eq("id", design.organization_id).maybeSingle(),
    auth.supabase.from("addresses").select("city, state").eq("organization_id", design.organization_id).eq("is_default_billing", true).maybeSingle(),
  ]);
  if (profileResult.error || organizationResult.error || addressResult.error || !profileResult.data || !organizationResult.data) return designJsonError("Company details could not be loaded", 422);
  const company = {
    companyName: organizationResult.data.display_name || organizationResult.data.legal_name,
    contactName: `${profileResult.data.first_name} ${profileResult.data.last_name}`.trim(),
    contactEmail: auth.user.email ?? organizationResult.data.billing_email ?? "",
    gstin: organizationResult.data.gstin,
    billingCity: addressResult.data?.city ?? null,
    billingState: addressResult.data?.state ?? null,
  };
  let pricing;
  try { pricing = calculateEstimatePricing(parsedSnapshot.data); } catch { return designJsonError("This saved design cannot be estimated with current pricing", 422); }
  const estimateSnapshot = buildEstimateSnapshot(parsedSnapshot.data, company, pricing);
  const admin = createAdminClient();
  const validUntil = new Date(Date.now() + getServerEnvironment().ESTIMATE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rpcSnapshot = { designSnapshot: parsedSnapshot.data, ...estimateSnapshot } as unknown as Json;
  const { data: result, error: rpcError } = await admin.rpc("create_design_estimate_from_server", {
    p_organization_id: design.organization_id,
    p_created_by: auth.user.id,
    p_design_project_id: id.data,
    p_expected_revision: parsedRequest.data.expectedRevision,
    p_client_operation_id: parsedRequest.data.clientOperationId,
    p_pricing_engine_version: pricing.pricingEngineVersion,
    p_pricing_snapshot: rpcSnapshot,
    p_subtotal_paise: pricing.subtotalPaise,
    p_discount_paise: pricing.discountPaise,
    p_taxable_subtotal_paise: pricing.taxableSubtotalPaise,
    p_gst_rate_basis_points: pricing.gstRateBasisPoints,
    p_gst_paise: pricing.gstPaise,
    p_shipping_paise: null as unknown as number,
    p_total_paise: pricing.totalPaise,
    p_reservation_fee_paise: pricing.reservationFeePaise,
    p_balance_due_paise: pricing.balanceDuePaise,
    p_valid_until: validUntil,
  });
  const created = result?.[0];
  if (rpcError || !created) {
    if (rpcError?.code === "40001" || /newer changes/i.test(rpcError?.message ?? "")) return designJsonError("This design changed. Refresh it before generating an estimate.", 409);
    return designJsonError("We couldn’t generate the estimate. Your design is safe. Try again in a moment.", 500);
  }
  const { data: estimate, error: estimateError } = await auth.supabase.from("design_estimates").select("id, organization_id, created_by, design_project_id, design_version_id, design_revision, estimate_number, status, currency, pricing_engine_version, pricing_snapshot, subtotal_paise, discount_paise, taxable_subtotal_paise, gst_rate_basis_points, gst_paise, shipping_paise, total_paise, reservation_fee_paise, balance_due_paise, generated_at, valid_until, converted_order_id, client_operation_id, created_at").eq("id", created.estimate_id).eq("created_by", auth.user.id).maybeSingle();
  if (estimateError || !estimate) return designJsonError("Estimate could not be loaded", 500);
  return designJson({ estimate: publicEstimate(estimate as never) }, created.created ? 201 : 200);
}
