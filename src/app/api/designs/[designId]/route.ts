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
import {
  archiveCloudDesign,
  getCloudDesign,
  saveCloudDesignDraft,
} from "@/lib/designs/dal";
import {
  cloudDesignSnapshotSchema,
  revisionRequestSchema,
  saveDesignRequestSchema,
} from "@/lib/designs/schema";
import type { Json } from "@/types/database.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DesignRouteContext = {
  params: Promise<{ designId: string }>;
};

async function validatedDesignId(context: DesignRouteContext) {
  const { designId } = await context.params;
  return z.uuid().safeParse(designId);
}

export async function GET(
  _request: NextRequest,
  context: DesignRouteContext,
) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }

  const id = await validatedDesignId(context);
  if (!id.success) return designJsonError("Design not found", 404);

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const [projectResult, versionsResult, ordersResult, estimatesResult] = await getCloudDesign(
    auth.supabase,
    id.data,
    auth.user.id,
  );
  if (projectResult.error || !projectResult.data) {
    return designJsonError("Design not found", 404);
  }
  if (versionsResult.error || ordersResult.error || estimatesResult.error) {
    return designJsonError("Design could not be loaded", 500);
  }

  const parsedSnapshot = cloudDesignSnapshotSchema.safeParse(
    projectResult.data.draft_snapshot,
  );
  if (!parsedSnapshot.success) {
    return designJsonError("Design uses an unsupported schema", 409);
  }

  return designJson({
    design: {
      ...projectResult.data,
      draft_snapshot: parsedSnapshot.data,
      versions: versionsResult.data ?? [],
      orders: ordersResult.data ?? [],
      estimates: estimatesResult.data ?? [],
    },
  });
}
export async function PATCH(
  request: NextRequest,
  context: DesignRouteContext,
) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }
  if (!hasExpectedDesignOrigin(request)) {
    return designJsonError("Invalid request origin", 403);
  }

  const id = await validatedDesignId(context);
  if (!id.success) return designJsonError("Design not found", 404);

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const body = await readDesignJson(request);
  if (!body.ok) return body.response;
  const parsed = saveDesignRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return designJsonError("Invalid design request", 400);
  }

  const { data, error } = await saveCloudDesignDraft(
    auth.supabase,
    id.data,
    {
      expectedRevision: parsed.data.expectedRevision,
      schemaVersion: parsed.data.schemaVersion,
      snapshot: parsed.data.snapshot as Json,
      pricingSnapshot: parsed.data.pricingSnapshot as Json | undefined,
      title: parsed.data.title,
    },
  );
  const result = data?.[0];
  if (error || !result) {
    return designJsonError("Design could not be saved", 403);
  }
  if (result.conflict) {
    return designJsonError("Design has newer cloud changes", 409, {
      conflict: {
        draftRevision: result.draft_revision,
        lastSavedAt: result.last_saved_at,
        snapshot: result.configuration_snapshot,
        pricingSnapshot: result.pricing_input_snapshot,
        title: result.title,
        status: result.status,
        currentVersion: result.current_version,
      },
    });
  }

  return designJson({
    design: {
      id: id.data,
      draftRevision: result.draft_revision,
      lastSavedAt: result.last_saved_at,
      title: result.title,
      status: result.status,
      currentVersion: result.current_version,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: DesignRouteContext,
) {
  if (!cloudDesignsAvailable()) {
    return designJsonError("Cloud designs are unavailable", 503);
  }
  if (!hasExpectedDesignOrigin(request)) {
    return designJsonError("Invalid request origin", 403);
  }

  const id = await validatedDesignId(context);
  if (!id.success) return designJsonError("Design not found", 404);

  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;

  const body = await readDesignJson(request, 16 * 1024);
  if (!body.ok) return body.response;
  const parsed = revisionRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return designJsonError("Invalid design request", 400);
  }

  const { data, error } = await archiveCloudDesign(
    auth.supabase,
    id.data,
    parsed.data.expectedRevision,
  );
  const result = data?.[0];
  if (error || !result) {
    return designJsonError("Design could not be archived", 403);
  }
  if (result.conflict) {
    return designJsonError("Design has newer cloud changes", 409, {
      conflict: { draftRevision: result.draft_revision },
    });
  }

  return designJson({
    design: {
      id: id.data,
      status: "archived",
      draftRevision: result.draft_revision,
      archivedAt: result.archived_at,
    },
  });
}
