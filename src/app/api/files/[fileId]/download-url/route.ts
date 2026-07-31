import { NextRequest } from "next/server";

import {
  authenticateFileApi,
  hasExpectedOrigin,
  jsonError,
  jsonPrivate,
  privateUploadsAvailable,
} from "@/lib/r2/api";
import { createPresignedDownload } from "@/lib/r2/presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!privateUploadsAvailable()) {
    return jsonError("Private downloads are unavailable", 503);
  }
  if (!hasExpectedOrigin(request)) {
    return jsonError("Invalid request origin", 403);
  }

  const auth = await authenticateFileApi();
  if (!auth.ok) return auth.response;

  const { fileId } = await context.params;
  const { data: file, error } = await auth.supabase
      .from("order_files")
      .select(
        "id, bucket_name, object_key, safe_filename, content_type, upload_status, scan_status, deleted_at",
      )
      .eq("id", fileId)
      .maybeSingle();

  if (
    error ||
    !file ||
    file.bucket_name !== "garmops-private-orders" ||
    file.deleted_at ||
    file.upload_status !== "finalized" ||
    file.scan_status === "rejected"
  ) {
    return jsonError("File not found", 404);
  }

  const clearedForDownload =
    file.scan_status === "clean" || file.scan_status === "not_required";
  if (!clearedForDownload) {
    return jsonError("File is awaiting security review", 423);
  }

  try {
    const download = await createPresignedDownload({
      objectKey: file.object_key,
      filename: file.safe_filename,
      contentType: file.content_type,
    });

    return jsonPrivate({
      fileId: file.id,
      download,
    });
  } catch {
    return jsonError("Download signing is unavailable", 503);
  }
}
