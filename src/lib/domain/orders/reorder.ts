import "server-only";

import type { User } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { getServerEnvironment } from "@/lib/config/env";
import { hashOrderRequest } from "@/lib/orders/service";
import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "@/lib/orders/pricing";
import { CUSTOM_ORDER_TERMS_VERSION } from "@/lib/orders/terms";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

function deterministicUuid(seed: string) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function existingReorder(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  organizationId: string,
  sourceOrderNumber: string,
  idempotencyKey: string,
) {
  const { data: key } = await admin
    .from("idempotency_keys")
    .select("resource_id")
    .eq("scope", "submit_order")
    .eq("actor_id", actorId)
    .eq("key", idempotencyKey)
    .maybeSingle();
  if (!key?.resource_id) return null;

  const [{ data: order }, { data: payment }] = await Promise.all([
    admin
      .from("orders")
      .select("id,order_number,organization_id,customer_reference")
      .eq("id", key.resource_id)
      .maybeSingle(),
    admin
      .from("payment_attempts")
      .select("id")
      .eq("order_id", key.resource_id)
      .eq("attempt_number", 1)
      .maybeSingle(),
  ]);
  if (
    !order ||
    !payment ||
    order.organization_id !== organizationId ||
    order.customer_reference !== `Reorder of ${sourceOrderNumber}`
  ) {
    throw new Error("The reorder idempotency key belongs to another request");
  }
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentAttemptId: payment.id,
  };
}


export type ReorderAssessment = Readonly<{
  available: boolean;
  previousEstimatePaise: number;
  currentEstimatePaise: number | null;
  pricingChanged: boolean;
  pricingVersionChanged: boolean;
  message: string;
}>;

export async function assessReorder(input: {
  supabase: SessionClient;
  organizationId: string;
  sourceOrderNumber: string;
}): Promise<ReorderAssessment> {
  const source = await input.supabase
    .from("orders")
    .select("id,status,order_type,design_version_id,estimated_total_paise,pricing_version,terms_snapshot")
    .eq("organization_id", input.organizationId)
    .eq("order_number", input.sourceOrderNumber)
    .maybeSingle();
  if (
    !source.data ||
    source.data.status !== "delivered" ||
    !["custom_bulk", "reorder"].includes(source.data.order_type) ||
    !source.data.design_version_id
  ) {
    return {
      available: false,
      previousEstimatePaise: source.data?.estimated_total_paise ?? 0,
      currentEstimatePaise: null,
      pricingChanged: false,
      pricingVersionChanged: false,
      message: "Only delivered custom orders can be reordered.",
    };
  }

  const [versionResult, itemResult] = await Promise.all([
    input.supabase
      .from("design_project_versions")
      .select("configuration_snapshot")
      .eq("id", source.data.design_version_id)
      .single(),
    input.supabase
      .from("order_items")
      .select("size_breakdown")
      .eq("order_id", source.data.id)
      .order("line_number")
      .limit(1)
      .single(),
  ]);

  try {
    if (!versionResult.data || !itemResult.data) throw new Error("missing history");
    const snapshot = cloudDesignSnapshotSchema.parse(
      versionResult.data.configuration_snapshot,
    );
    const sizeQuantities = Object.fromEntries(
      Object.entries(record(itemResult.data.size_breakdown)).map(([key, value]) => [
        key,
        Number(value),
      ]),
    );
    const oldTerms = record(source.data.terms_snapshot);
    const deliveryType = ["rush", "standard", "flexible"].includes(
      String(oldTerms.deliveryType),
    )
      ? (String(oldTerms.deliveryType) as "rush" | "standard" | "flexible")
      : "standard";
    const priced = priceCustomOrder({ snapshot, sizeQuantities, deliveryType });
    const currentEstimatePaise =
      priced.subtotalPaise + priced.shippingPaise + priced.taxEstimatePaise;
    const pricingChanged =
      currentEstimatePaise !== source.data.estimated_total_paise;
    const pricingVersionChanged =
      source.data.pricing_version !== CUSTOM_ORDER_PRICING_VERSION;
    return {
      available: true,
      previousEstimatePaise: source.data.estimated_total_paise,
      currentEstimatePaise,
      pricingChanged,
      pricingVersionChanged,
      message: pricingChanged || pricingVersionChanged
        ? "Current pricing differs from the historical order. Review the new estimate before payment."
        : "The configuration is currently available at the recalculated estimate.",
    };
  } catch {
    return {
      available: false,
      previousEstimatePaise: source.data.estimated_total_paise,
      currentEstimatePaise: null,
      pricingChanged: false,
      pricingVersionChanged: source.data.pricing_version !== CUSTOM_ORDER_PRICING_VERSION,
      message: "This historical configuration needs a staff availability review before it can be reordered.",
    };
  }
}

export async function createReorder(input: {
  supabase: SessionClient;
  user: User;
  organizationId: string;
  sourceOrderNumber: string;
  idempotencyKey?: string;
}) {
  const { supabase, user, organizationId, sourceOrderNumber } = input;
  const membership = await supabase
    .from("organization_members")
    .select("role,status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "buyer"])
    .maybeSingle();
  if (!membership.data) throw new Error("Active buyer access is required");

  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const admin = createAdminClient();
  const prior = await existingReorder(
    admin,
    user.id,
    organizationId,
    sourceOrderNumber,
    idempotencyKey,
  );
  if (prior) return prior;

  const source = await supabase
    .from("orders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("order_number", sourceOrderNumber)
    .maybeSingle();
  if (
    !source.data ||
    source.data.status !== "delivered" ||
    !["custom_bulk", "reorder"].includes(source.data.order_type) ||
    !source.data.design_version_id
  ) {
    throw new Error("Only delivered custom orders can be reordered");
  }

  const [versionResult, itemResult, profileResult] = await Promise.all([
    supabase
      .from("design_project_versions")
      .select("configuration_snapshot,pricing_input_snapshot")
      .eq("id", source.data.design_version_id)
      .single(),
    supabase
      .from("order_items")
      .select("size_breakdown")
      .eq("order_id", source.data.id)
      .order("line_number")
      .limit(1)
      .single(),
    supabase
      .from("profiles")
      .select("first_name,last_name,phone,department")
      .eq("id", user.id)
      .single(),
  ]);
  if (!versionResult.data || !itemResult.data || !profileResult.data || !user.email) {
    throw new Error("Historical order data is incomplete");
  }

  const snapshot = cloudDesignSnapshotSchema.parse(
    versionResult.data.configuration_snapshot,
  );
  const sizeQuantities = Object.fromEntries(
    Object.entries(record(itemResult.data.size_breakdown)).map(([key, value]) => [
      key,
      Number(value),
    ]),
  );
  const oldTerms = record(source.data.terms_snapshot);
  const deliveryType = ["rush", "standard", "flexible"].includes(
    String(oldTerms.deliveryType),
  )
    ? (String(oldTerms.deliveryType) as "rush" | "standard" | "flexible")
    : "standard";
  const priced = priceCustomOrder({ snapshot, sizeQuantities, deliveryType });

  const projectId = deterministicUuid(`reorder:${user.id}:${idempotencyKey}:project`);
  const versionId = deterministicUuid(`reorder:${user.id}:${idempotencyKey}:version`);
  const title = `Reorder of ${sourceOrderNumber}`;
  const { error: projectError } = await admin.from("design_projects").upsert(
    {
      id: projectId,
      organization_id: organizationId,
      created_by: user.id,
      title,
      status: "draft",
      schema_version: snapshot.schemaVersion,
      current_version: 1,
      source: "reorder",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (projectError) throw new Error("Reorder design could not be created");
  const { error: versionError } = await admin
    .from("design_project_versions")
    .upsert(
      {
        id: versionId,
        design_project_id: projectId,
        version_number: 1,
        configuration_snapshot: snapshot as unknown as Json,
        pricing_input_snapshot: versionResult.data.pricing_input_snapshot,
        created_by: user.id,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (versionError) throw new Error("Reorder version could not be created");

  const customerSnapshot = {
    ...record(source.data.customer_snapshot),
    userId: user.id,
    accountEmail: user.email.toLowerCase(),
    email: user.email.toLowerCase(),
    name: `${profileResult.data.first_name} ${profileResult.data.last_name}`.trim(),
    phone: profileResult.data.phone,
    department: profileResult.data.department,
  };
  const termsSnapshot = {
    ...oldTerms,
    accepted: true,
    version: CUSTOM_ORDER_TERMS_VERSION,
    acceptedAtServer: new Date().toISOString(),
    reorderSourceOrderId: source.data.id,
    reorderSourceOrderNumber: sourceOrderNumber,
    pricingRecalculated: true,
  };
  const requestHash = hashOrderRequest({
    sourceOrderId: source.data.id,
    projectId,
    versionId,
    idempotencyKey,
    price: priced,
    termsVersion: CUSTOM_ORDER_TERMS_VERSION,
  });
  const env = getServerEnvironment();

  const { data, error } = await (
    admin.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: Array<Record<string, unknown>> | null;
      error: { message: string } | null;
    }>
  )("submit_reorder_order", {
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_source_order_id: source.data.id,
    p_organization_id: organizationId,
    p_customer_user_id: user.id,
    p_subtotal_paise: priced.subtotalPaise,
    p_shipping_paise: priced.shippingPaise,
    p_tax_estimate_paise: priced.taxEstimatePaise,
    p_reservation_amount_paise: env.RESERVATION_AMOUNT_PAISE,
    p_pricing_version: CUSTOM_ORDER_PRICING_VERSION,
    p_configuration_schema_version: snapshot.schemaVersion,
    p_billing_snapshot: source.data.billing_snapshot,
    p_shipping_snapshot: source.data.shipping_snapshot,
    p_customer_snapshot: customerSnapshot,
    p_company_snapshot: source.data.company_snapshot,
    p_terms_snapshot: termsSnapshot,
    p_items: [priced.item],
    p_design_project_id: projectId,
    p_design_version_id: versionId,
    p_customer_reference: title,
    p_po_number: null,
    p_requested_delivery_date: source.data.requested_delivery_date,
    p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  const result = data?.[0];
  if (error || !result) {
    throw new Error(error?.message ?? "Reorder could not be created");
  }
  return {
    orderId: String(result.order_id),
    orderNumber: String(result.order_number),
    paymentAttemptId: String(result.payment_attempt_id),
  };
}
