import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestIdFrom, withRequestId } from "@/lib/http/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request), environment = getServerEnvironment();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = environment.CRON_SECRET ?? "";
  if (!supplied || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), requestId);
  if (!environment.ABANDONED_DESIGN_EMAILS_ENABLED) return withRequestId(NextResponse.json({ enabled: false, enqueued: 0 }), requestId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_abandoned_design_recovery");
  return withRequestId(NextResponse.json(error ? { error: "Recovery scheduling failed" } : { enabled: true, enqueued: data ?? 0 }, { status: error ? 503 : 200 }), requestId);
}
