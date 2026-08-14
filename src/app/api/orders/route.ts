import { NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function GET() {
  try { return NextResponse.json(await medusaRequest("/store/garmops/orders", { actor: "customer" })); }
  catch { return NextResponse.json({ error: "Orders could not be loaded" }, { status: 401 }); }
}
