import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateDesignApi, cloudDesignsAvailable, designJson, designJsonError } from "@/lib/designs/api";
import { getEstimate } from "@/lib/estimates/dal";
import { publicEstimate } from "@/lib/estimates/api";

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
  return designJson({ estimate: publicEstimate(data as never) });
}
