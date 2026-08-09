import { NextRequest, NextResponse } from "next/server";
import { requestIdFrom, withRequestId } from "@/lib/http/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness probe. It deliberately does not expose provider state or configuration. */
export function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  return withRequestId(NextResponse.json(
    { status: "ok", service: "garmops-web" },
    { headers: { "Cache-Control": "no-store" } },
  ), requestId);
}
