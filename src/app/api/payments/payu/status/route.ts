import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import { normalizePaymentCheckoutType } from "@/lib/payments/checkoutReturn";

export async function GET(request: NextRequest) {
  const cartId = request.nextUrl.searchParams.get("cartId");
  const txnid = request.nextUrl.searchParams.get("txnid");
  if (!cartId) return NextResponse.json({ error: "Cart is required" }, { status: 400 });
  try {
    const payment = await medusaRequest<Record<string, unknown>>(`/store/garmops/payments/payu/status?cartId=${encodeURIComponent(cartId)}${txnid ? `&txnid=${encodeURIComponent(txnid)}` : ""}`, { actor: "customer" });
    let checkoutType = null;
    try {
      const result = await medusaRequest<{ cart?: { cartType?: unknown } }>(`/store/garmops/sample-cart?cartId=${encodeURIComponent(cartId)}`, { actor: "customer" });
      checkoutType = normalizePaymentCheckoutType(result.cart?.cartType);
    } catch {
      // Payment status remains useful for legacy carts without a cart profile.
    }
    return NextResponse.json({ ...payment, checkoutType });
  } catch { return NextResponse.json({ status: "payment_pending" }, { status: 202 }); }
}
