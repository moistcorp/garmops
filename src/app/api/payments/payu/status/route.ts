import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function GET(request: NextRequest) {
  const cartId = request.nextUrl.searchParams.get("cartId");
  const txnid = request.nextUrl.searchParams.get("txnid");
  if (!cartId) return NextResponse.json({ error: "Cart is required" }, { status: 400 });
  try {
    return NextResponse.json(await medusaRequest(`/store/garmops/payments/payu/status?cartId=${encodeURIComponent(cartId)}${txnid ? `&txnid=${encodeURIComponent(txnid)}` : ""}`, { actor: "customer" }));
  } catch { return NextResponse.json({ status: "payment_pending" }, { status: 202 }); }
}
