import { NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function GET(_request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  try { return NextResponse.json(await medusaRequest(`/store/garmops/orders/${encodeURIComponent(orderNumber)}`, { actor: "customer" })); }
  catch { return NextResponse.json({ error: "Order not found" }, { status: 404 }); }
}
