import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest, context: { params: Promise<{ designId: string }> }) {
  const { designId } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await medusaRequest<{ project: Record<string, unknown> }>(`/store/garmops/designs/${encodeURIComponent(designId)}/duplicate`, { method: "POST", actor: "customer", body: { clientOperationId: body.clientOperationId ?? crypto.randomUUID() } });
    return NextResponse.json({ design: result.project }, { status: 201 });
  } catch { return NextResponse.json({ error: "Design could not be duplicated" }, { status: 409 }); }
}
