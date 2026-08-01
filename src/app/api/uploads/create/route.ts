import { NextRequest } from "next/server";

import {
  authenticateFileApi,
  hasExpectedOrigin,
  jsonError,
  jsonPrivate,
  privateUploadsAvailable,
} from "@/lib/r2/api";
import { validateUploadRequest } from "@/lib/r2/filePolicy";
import { createPresignedUpload } from "@/lib/r2/presign";
import { readBoundedJson, RequestBodyError } from "@/lib/http/requestBody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maximumRequestBytes = 16 * 1024;

export async function POST(request: NextRequest) {
  if (!privateUploadsAvailable()) {
    return jsonError("Private uploads are unavailable", 503);
  }
  if (!hasExpectedOrigin(request)) {
    return jsonError("Invalid request origin", 403);
  }

  const auth = await authenticateFileApi();
  if (!auth.ok) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(request, maximumRequestBytes);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      if (error.code === "too_large") return jsonError("Request is too large", 413);
      if (error.code === "unsupported_media_type") return jsonError("JSON request required", 415);
    }
    return jsonError("Invalid upload request", 400);
  }

  const validation = validateUploadRequest(rawBody);
  if (!validation.ok) {
    const status = validation.error === "File is too large" ? 413 : 400;
    return jsonError(validation.error, status);
  }

  const file = validation.value;
  const uploadExpiresAt = new Date(Date.now() + 8 * 60 * 1000).toISOString();
  const { data, error } = await auth.supabase.rpc("create_private_upload_slot", {
    // Supabase's generated RPC args cannot express nullable PostgreSQL
    // parameters, even though this function deliberately accepts one null ID.
    p_order_id: file.orderId ?? (null as unknown as string),
    p_design_project_id:
      file.designProjectId ?? (null as unknown as string),
    p_kind: file.kind,
    p_visibility: file.visibility,
    p_original_filename: file.originalFilename,
    p_safe_filename: file.safeFilename,
    p_content_type: file.contentType,
    p_byte_size: file.byteSize,
    p_extension: file.extension,
    p_sha256: file.sha256 ?? (null as unknown as string),
    p_expires_at: uploadExpiresAt,
  });

  const slot = data?.[0];
  if (error || !slot) {
    return jsonError("Upload target is unavailable", 403);
  }

  try {
    const upload = await createPresignedUpload({
      fileId: slot.file_id,
      objectKey: slot.object_key,
      contentType: file.contentType,
      byteSize: file.byteSize,
      sha256: file.sha256,
    });

    return jsonPrivate(
      {
        fileId: slot.file_id,
        upload,
        finalizeUrl: `/api/uploads/${slot.file_id}/finalize`,
      },
      201,
    );
  } catch {
    return jsonError("Upload signing is unavailable", 503);
  }
}
