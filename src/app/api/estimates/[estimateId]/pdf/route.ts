import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateDesignApi, cloudDesignsAvailable, designJsonError } from "@/lib/designs/api";
import { getEstimate } from "@/lib/estimates/dal";
import { buildEstimatePdf } from "@/lib/estimates/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ estimateId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  if (!cloudDesignsAvailable()) return designJsonError("Saved designs are unavailable", 503);
  const id = z.uuid().safeParse((await context.params).estimateId);
  if (!id.success) return designJsonError("Estimate not found", 404);
  const auth = await authenticateDesignApi();
  if (!auth.ok) return auth.response;
  const { data, error } = await getEstimate(auth.supabase, id.data, auth.user.id);
  if (error || !data) return designJsonError("Estimate not found", 404);
  const pdf = buildEstimatePdf(data as never);
  return new Response(pdf.bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
