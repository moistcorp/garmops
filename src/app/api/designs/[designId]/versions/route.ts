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
import { createCloudDesignVersion } from "@/lib/designs/dal";
import { revisionRequestSchema } from "@/lib/designs/schema";

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
  const parsed = revisionRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return designJsonError("Invalid design request", 400);
  }

  const { data, error } = await createCloudDesignVersion(
    auth.supabase,
    id.data,
    parsed.data.expectedRevision,
  );
  const result = data?.[0];
  if (error || !result) {
    return designJsonError("Design version could not be created", 403);
  }
  if (result.conflict) {
    return designJsonError("Design has newer cloud changes", 409, {
      conflict: {
        draftRevision: result.draft_revision,
        currentVersion: result.version_number,
        lastSavedAt: result.last_saved_at,
      },
    });
  }

  return designJson(
    {
      version: {
        id: result.design_version_id,
        number: result.version_number,
        draftRevision: result.draft_revision,
        createdAt: result.last_saved_at,
      },
    },
    201,
  );
}
