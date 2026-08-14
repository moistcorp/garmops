import { NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function GET(_request: Request, context: { params: Promise<{ pin: string }> }) {
  const { pin } = await context.params;
  try { return NextResponse.json(await medusaRequest(`/store/garmops/pincode/${encodeURIComponent(pin)}`, { actor: "public" })); }
  catch { return NextResponse.json({ error: "PIN lookup is temporarily unavailable" }, { status: 404 }); }
}
