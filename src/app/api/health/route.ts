import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness probe. It deliberately does not expose provider state or configuration. */
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "garmops-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
