import { NextRequest } from "next/server";

import {
  authenticateDesignApi,
  cloudDesignsAvailable,
  designJson,
  designJsonError,
  hasExpectedDesignOrigin,
  readDesignJson,
} from "@/lib/designs/api";
import {
  createCloudDesign,
  findWritableOrganization,
  listCloudDesigns,
} from "@/lib/designs/dal";
import { createDesignRequestSchema } from "@/lib/designs/schema";
import type { Json } from "@/types/database.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";
  const { data, error } = await listCloudDesigns(
    auth.supabase,
    auth.user.id,
    includeArchived,
  );

  if (error) return designJsonError("Designs could not be loaded", 500);
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
    return designJsonError("Invalid design request", 400);
  }

  const { data: membership, error: membershipError } =
    await findWritableOrganization(auth.supabase, auth.user.id);
  if (membershipError || !membership) {
    return designJsonError("Design write access is unavailable", 403);
  }

  const { data, error } = await createCloudDesign(auth.supabase, {
    organizationId: membership.organization_id,
    title: parsed.data.title,
    schemaVersion: parsed.data.schemaVersion,
    snapshot: parsed.data.snapshot as Json,
    pricingSnapshot: parsed.data.pricingSnapshot as Json | undefined,
    source: parsed.data.source,
    clientImportId: parsed.data.clientImportId,
  });
  const design = data?.[0];

  if (error || !design) {
    return designJsonError("Design could not be saved", 403);
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
