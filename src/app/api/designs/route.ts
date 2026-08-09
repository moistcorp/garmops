import { NextRequest } from "next/server";

import {
  authenticateDesignApi,
  cloudDesignsAvailable,
  designJson,
  designJsonError,
  hasExpectedDesignOrigin,
  readDesignJson,
} from "@/lib/designs/api";
import { createCloudDesign, listCloudDesigns } from "@/lib/designs/dal";
import { createDesignRequestSchema } from "@/lib/designs/schema";
import type { Json } from "@/types/database.generated";
import { captureServerAnalytics, customerAllowsAnalytics } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const { data, error } = await listCloudDesigns(
    auth.supabase,
    auth.user.id,
    request.nextUrl.searchParams.get("includeArchived") === "true",
  );
  if (error) {
    console.error("Cloud designs could not be listed", {
      userId: auth.user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return designJsonError("Designs could not be loaded", 500);
  }

  return designJson({ designs: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }
  if (!hasExpectedDesignOrigin(request)) {
    return designJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const body = await readDesignJson(request);
  if (!body.ok) return body.response;

  const parsed = createDesignRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    console.error("Cloud design request validation failed", {
      userId: auth.user.id,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return designJsonError("Invalid design request", 400);
  }

  const { data, error } = await createCloudDesign(auth.supabase, {
    title: parsed.data.title,
    schemaVersion: parsed.data.schemaVersion,
    snapshot: parsed.data.snapshot as Json,
    pricingSnapshot: parsed.data.pricingSnapshot as Json | undefined,
    source: parsed.data.source,
    clientImportId: parsed.data.clientImportId,
  });
  const design = Array.isArray(data) ? data[0] : undefined;

  if (error || !design) {
    console.error("Cloud design creation failed", {
      userId: auth.user.id,
      clientImportId: parsed.data.clientImportId ?? null,
      code: error?.code ?? null,
      message: error?.message ?? "RPC returned no design",
      details: error?.details ?? null,
      hint: error?.hint ?? null,
    });
    return designJsonError("Design could not be saved", 403);
  }

  if (design.created_new) {
    captureServerAnalytics({
      event: "saved_design_created",
      supabaseUserId: auth.user.id,
      consent: await customerAllowsAnalytics(auth.user.id),
      properties: { source: parsed.data.source },
    });
  }

  return designJson(
    {
      design: {
        id: design.design_project_id,
        versionId: design.design_version_id,
        draftRevision: design.draft_revision,
        currentVersion: design.version_number,
        lastSavedAt: design.last_saved_at,
        created: design.created_new,
      },
    },
    design.created_new ? 201 : 200,
  );
}
