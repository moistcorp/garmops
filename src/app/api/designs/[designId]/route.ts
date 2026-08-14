import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";

type Context = { params: Promise<{ designId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { designId } = await context.params;
  try {
    const result = await medusaRequest<Record<string, unknown>>(`/store/garmops/designs/${encodeURIComponent(designId)}`, { actor: "customer" });
    const project = result.project as Record<string, unknown>;
    const versions = Array.isArray(result.versions) ? result.versions as Array<Record<string, unknown>> : [];
    const latest = versions[0];
    return NextResponse.json({ design: { ...project, draft_revision: latest?.revision ?? 1, current_version: latest?.revision ?? 1, current_version_id: latest?.id, last_saved_at: latest?.created_at ?? project.updated_at ?? new Date().toISOString(), draft_snapshot: latest?.configuration ?? {} } });
  } catch { return NextResponse.json({ error: "Design not found" }, { status: 404 }); }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { designId } = await context.params;
  const body = await request.json().catch(() => null) as { expectedRevision?: number; snapshot?: unknown } | null;
  const snapshot = cloudDesignSnapshotSchema.safeParse(body?.snapshot);
  if (!snapshot.success || !Number.isInteger(body?.expectedRevision)) return NextResponse.json({ error: "Invalid design request" }, { status: 400 });
  try {
    const result = await medusaRequest<Record<string, unknown>>(`/store/garmops/designs/${encodeURIComponent(designId)}`, { method: "PATCH", actor: "customer", body: { revision: body!.expectedRevision, productSlug: snapshot.data.configId, configuration: snapshot.data.configuration, quantity: snapshot.data.configuration.quantity } });
    const version = result.version as Record<string, unknown>;
    return NextResponse.json({ design: { id: designId, draftRevision: version.revision, currentVersion: version.revision, currentVersionId: version.id, lastSavedAt: version.created_at } });
  } catch (error) {
    const status = error instanceof Error && error.message.includes("changed") ? 409 : 400;
    return NextResponse.json({ error: status === 409 ? "Design has newer cloud changes" : "Design could not be saved" }, { status });
  }
}

export async function DELETE() {
  return NextResponse.json({ error: "Design archiving is not present in the current Medusa contract." }, { status: 405 });
}
