import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Background work belongs to Medusa. Keep this endpoint explicit so old
 * cron jobs fail safely instead of attempting to use the removed database.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Background jobs are owned by the Medusa backend" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
