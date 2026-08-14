import { NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  try {
    const result = await medusaRequest<{ url: string; expiresIn: number }>(`/store/garmops/files/${encodeURIComponent(fileId)}/download`, { actor: "customer" });
    return NextResponse.json({ download: { url: result.url, expiresIn: result.expiresIn } });
  } catch { return NextResponse.json({ error: "File is not ready for download" }, { status: 423 }); }
}
