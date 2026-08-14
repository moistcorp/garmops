import { NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  try {
    const result = await medusaRequest<{ file: Record<string, unknown>; scanStatus?: string }>(`/store/garmops/files/${encodeURIComponent(fileId)}/finalize`, { method: "POST", actor: "customer" });
    return NextResponse.json({ fileId, uploadStatus: result.file?.state ?? "uploaded", scanStatus: result.scanStatus ?? result.file?.scan_status ?? "pending" });
  } catch { return NextResponse.json({ error: "Upload could not be verified" }, { status: 409 }); }
}
