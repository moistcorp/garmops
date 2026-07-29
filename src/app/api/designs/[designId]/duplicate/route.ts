import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateDesignApi,
  cloudDesignsAvailable,
  designJson,
  designJsonError,
  hasExpectedDesignOrigin,
  readDesignJson,
} from "@/lib/designs/api";
import { duplicateCloudDesign } from "@/lib/designs/dal";
import { duplicateDesignRequestSchema } from "@/lib/designs/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ designId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }
  if (!hasExpectedDesignOrigin(request)) {
    return designJsonError("Invalid request origin", 403);
  }

  const { designId } = await context.params;
  const id = z.uuid().safeParse(designId);
  if (!id.success) return designJsonError("Design not found", 404);

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const body = await readDesignJson(request, 16 * 1024);
  if (!body.ok) return body.response;
  const parsed = duplicateDesignRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return designJsonError("Invalid design request", 400);
  }

  const { data, error } = await duplicateCloudDesign(
    auth.supabase,
    id.data,
    parsed.data.title,
    parsed.data.clientOperationId,
  );
  const result = data?.[0];
  if (error || !result) {
    return designJsonError("Design could not be duplicated", 403);
  }

  return designJson(
    {
      design: {
        id: result.design_project_id,
        versionId: result.design_version_id,
        draftRevision: result.draft_revision,
        currentVersion: result.version_number,
        lastSavedAt: result.last_saved_at,
        created: result.created_new,
      },
    },
    result.created_new ? 201 : 200,
  );
}
