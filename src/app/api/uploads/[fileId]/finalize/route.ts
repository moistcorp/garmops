import { NextRequest } from "next/server";

import {
  authenticateFileApi,
  hasExpectedOrigin,
  jsonError,
  jsonPrivate,
  privateUploadsAvailable,
} from "@/lib/r2/api";
import { inspectPrivateObject } from "@/lib/r2/presign";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!privateUploadsAvailable()) {
    return jsonError("Private uploads are unavailable", 503);
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
      "id, uploaded_by, kind, bucket_name, object_key, byte_size, content_type, sha256, upload_status, upload_expires_at, scan_status, deleted_at",
    )
    .eq("id", fileId)
    .maybeSingle();

  if (
    error ||
    !file ||
    file.uploaded_by !== auth.user.id ||
    file.bucket_name !== "garmops-private-orders" ||
    file.deleted_at ||
    !["pending", "finalized"].includes(file.upload_status)
  ) {
    return jsonError("Upload cannot be finalized", 404);
  }
  if (file.upload_status === "finalized") {
    return jsonPrivate({
      fileId: file.id,
      uploadStatus: "finalized",
      scanStatus: file.scan_status,
    });
  }
  if (
    !file.upload_expires_at ||
    new Date(file.upload_expires_at).getTime() <= Date.now()
  ) {
    return jsonError("Upload cannot be finalized", 404);
  }

  let object;
  try {
    object = await inspectPrivateObject({
      objectKey: file.object_key,
      fileId: file.id,
      expectedByteSize: file.byte_size,
      expectedSha256: file.sha256,
    });
  } catch {
    return jsonError("Uploaded object is not available", 409);
  }

  if (!object || object.contentType !== file.content_type) {
    return jsonError("Uploaded object does not match the upload slot", 409);
  }

  const admin = createAdminClient();
  const { data: finalized, error: finalizeError } = await admin.rpc(
    "finalize_private_upload",
    {
      p_file_id: file.id,
      p_actual_byte_size: object.byteSize,
      p_actual_content_type: object.contentType,
      p_object_etag: object.etag,
      p_actual_sha256: object.sha256 as unknown as string,
    },
  );

  if (finalizeError || !finalized) {
    return jsonError("Upload could not be finalized", 409);
  }

  const scanningEnabled = getServerEnvironment().MALWARE_SCANNING_ENABLED && file.kind === "customer_artwork";
  if (scanningEnabled) {
    const { error: quarantineError } = await admin.from("order_files").update({ scan_status: "pending_scan" }).eq("id", file.id);
    if (quarantineError) return jsonError("Upload quarantine could not be recorded", 503);
    const { error: jobError } = await admin.from("integration_jobs").upsert({
      job_type: "malware_scan_private_file", deduplication_key: `malware-scan:${file.id}:${object.sha256 ?? object.etag}`,
      payload: { fileId: file.id },
    }, { onConflict: "deduplication_key", ignoreDuplicates: true });
    if (jobError) return jsonError("Upload scan could not be scheduled", 503);
  }

  return jsonPrivate({
    fileId: file.id,
    uploadStatus: "finalized",
    scanStatus: scanningEnabled ? "pending_scan" : file.kind === "customer_artwork" ? "manual_review" : "not_required",
  });
}
