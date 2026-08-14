import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(_request: NextRequest, context: { params: Promise<{ designId: string }> }) {
  const { designId } = await context.params;
  try {
    const result = await medusaRequest<Record<string, unknown>>(`/store/garmops/designs/${encodeURIComponent(designId)}`, { actor: "customer" });
    const versions = Array.isArray(result.versions) ? result.versions as Array<Record<string, unknown>> : [];
    const latest = versions[0] ?? {};
    return NextResponse.json({ version: { id: latest.id, number: latest.revision ?? 1, draftRevision: latest.revision ?? 1, createdAt: latest.created_at ?? new Date().toISOString() } });
  } catch { return NextResponse.json({ error: "Design version could not be loaded" }, { status: 409 }); }
}
