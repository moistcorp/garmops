import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  try {
    const result = await medusaRequest<{ fileId: string; uploadUrl: string; expiresIn: number; state: string }>("/store/garmops/files/upload", { method: "POST", actor: "customer", body: {
      filename: body.filename,
      safeFilename: body.filename,
      contentType: body.contentType,
      byteSize: body.byteSize,
      extension: String(body.filename).split(".").pop()?.toLowerCase(),
      sha256: body.sha256,
      kind: body.kind,
      visibility: "customer",
      designProjectId: body.designProjectId,
      orderId: body.orderId,
    } });
    return NextResponse.json({ fileId: result.fileId, upload: { url: result.uploadUrl, method: "PUT", headers: { "Content-Type": body.contentType as string, "Content-Length": String(body.byteSize) } }, finalizeUrl: `/api/uploads/${result.fileId}/finalize` }, { status: 201 });
  } catch { return NextResponse.json({ error: "Upload target is unavailable" }, { status: 503 }); }
}
