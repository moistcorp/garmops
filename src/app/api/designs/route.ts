import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await medusaRequest<{ projects: Array<Record<string, unknown>> }>("/store/garmops/designs", { actor: "customer" });
    return NextResponse.json({ designs: body.projects ?? [] });
  } catch { return NextResponse.json({ error: "Designs could not be loaded" }, { status: 401 }); }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { title?: string; snapshot?: unknown; clientImportId?: string } | null;
  const snapshot = cloudDesignSnapshotSchema.safeParse(body?.snapshot);
  if (!body?.title || !snapshot.success) return NextResponse.json({ error: "Invalid design request" }, { status: 400 });
  try {
    const result = await medusaRequest<Record<string, unknown>>("/store/garmops/designs", {
      method: "POST", actor: "customer",
      body: { title: body.title, productSlug: snapshot.data.configId, configuration: snapshot.data.configuration, quantity: snapshot.data.configuration.quantity, clientOperationId: body.clientImportId },
    });
    const project = result.project as Record<string, unknown>;
    const version = result.version as Record<string, unknown>;
    return NextResponse.json({ design: { id: project.id, draftRevision: version.revision ?? 1, currentVersion: version.revision ?? 1, currentVersionId: version.id, lastSavedAt: version.created_at ?? new Date().toISOString() } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Design could not be saved" }, { status: 400 }); }
}
