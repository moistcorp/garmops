import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "PayU reconciliation is owned by the Medusa backend" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
