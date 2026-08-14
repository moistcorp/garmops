import { NextResponse } from "next/server";

import { medusaRequest } from "@/lib/medusa/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await medusaRequest("/store/garmops/catalog", { method: "GET" });
    return NextResponse.json(
      { status: "ok", backend: "medusa" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { status: "degraded", backend: "medusa", error: error instanceof Error ? error.message : "Backend unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
