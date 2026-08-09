import "server-only";

import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { deletePrivateObject } from "@/lib/r2/presign";
import { createAdminClient } from "@/lib/supabase/admin";

type ExpiredUpload = Readonly<{ file_id: string; object_key: string }>;

export async function cleanupExpiredPrivateUploads(limit = 100): Promise<{
  claimed: number;
  deleted: number;
}> {
  if (!isFeatureEnabled("R2_PRIVATE_UPLOADS_ENABLED")) {
    return { claimed: 0, deleted: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_expired_private_uploads", {
    p_limit: Math.max(1, Math.min(limit, 500)),
  });
  if (error) throw new Error(error.message);

  const claimed = (data ?? []) as ExpiredUpload[];
  const deletedIds: string[] = [];
  for (const upload of claimed) {
    try {
      await deletePrivateObject(upload.object_key);
      deletedIds.push(upload.file_id);
    } catch (error) {
      console.error("Expired private upload cleanup failed", {
        fileId: upload.file_id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  if (deletedIds.length) {
    const { error: completionError } = await admin.rpc(
      "complete_expired_private_upload_cleanup",
      { p_file_ids: deletedIds },
    );
    if (completionError) throw new Error(completionError.message);
  }

  return { claimed: claimed.length, deleted: deletedIds.length };
}
