import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApprovalToken } from "@/lib/domain/approvals/approval";
import { createPresignedDownload, inspectPrivateObject } from "@/lib/r2/presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32 || token.length > 512) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: approval } = await admin.from("approvals").select("status,expires_at,approval_pdf_file_id").eq("secure_token_hash", hashApprovalToken(token)).maybeSingle();
  if (!approval || !approval.approval_pdf_file_id || ["revoked", "expired"].includes(approval.status) || !approval.expires_at || new Date(approval.expires_at).getTime() <= Date.now()) return new NextResponse("Not found", { status: 404 });
  const { data: file } = await admin.from("order_files").select("id,bucket_name,object_key,safe_filename,content_type,byte_size,sha256,upload_status,scan_status,deleted_at").eq("id", approval.approval_pdf_file_id).maybeSingle();
  if (!file || file.bucket_name !== "garmops-private-orders" || file.deleted_at || file.upload_status !== "finalized" || !["clean", "not_required"].includes(file.scan_status) || !file.sha256) return new NextResponse("Not found", { status: 404 });
  const verified = await inspectPrivateObject({
    objectKey: file.object_key,
    fileId: file.id,
    expectedByteSize: file.byte_size,
    expectedSha256: file.sha256,
  }).catch(() => null);
  if (!verified || verified.contentType !== file.content_type) return new NextResponse("Not found", { status: 404 });
  const download = await createPresignedDownload({ objectKey: file.object_key, filename: file.safe_filename, contentType: file.content_type });
  return NextResponse.redirect(download.url, { status: 302, headers: { "cache-control": "private, no-store" } });
}
