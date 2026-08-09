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
import { createAdminClient } from "@/lib/supabase/admin";
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
    p_staff_quote_id:
      file.staffQuoteId ?? (null as unknown as string),
    p_replacement_for_file_id:
      file.replacementForFileId ?? (null as unknown as string),
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
    const code = error?.message.match(/(ARTWORK_UPLOAD_LOCKED|ORDER_PRODUCTION_LOCKED|ARTWORK_REVISION_REQUIRED|ARTWORK_REPLACEMENT_NOT_OPEN|ARTWORK_REVISION_NOT_FOUND|FILE_COUNT_LIMIT|FILE_TOTAL_LIMIT)/)?.[1];
    const messages: Record<string, string> = {
      ARTWORK_UPLOAD_LOCKED: "Artwork cannot be changed after production approval. Contact Garmops if a revision is required.",
      ORDER_PRODUCTION_LOCKED: "This order is already in production. A controlled production revision is required.",
      ARTWORK_REVISION_REQUIRED: "Choose the artwork requirement that this file replaces.",
      ARTWORK_REPLACEMENT_NOT_OPEN: "This artwork is not currently open for replacement.",
      ARTWORK_REVISION_NOT_FOUND: "The artwork requirement is no longer current. Refresh and try again.",
      FILE_COUNT_LIMIT: "The active artwork upload limit has been reached.",
      FILE_TOTAL_LIMIT: "The active upload size limit has been reached.",
    };
    return jsonError(code ? messages[code] : "Upload target is unavailable", code?.includes("LOCKED") ? 409 : 403);
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
    await createAdminClient().from("order_files").update({ upload_status: "failed" }).eq("id", slot.file_id).eq("upload_status", "pending");
    return jsonError("Upload signing is unavailable", 503);
  }
}
