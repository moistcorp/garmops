import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { checkoutAttemptId?: string; cartId?: string; txnid?: string };
  const cartId = body.cartId ?? body.checkoutAttemptId;
  if (!cartId) return NextResponse.json({ error: "Cart is required" }, { status: 400 });
  try {
    const result = await medusaRequest<{ status: string; orderId?: string; orderNumber?: string }>("/store/garmops/payments/payu/recheck", { method: "POST", actor: "customer", body: { cartId, txnid: body.txnid } });
    const outcome = result.status === "order_complete" ? "success" : result.status === "payment_failed" ? "failure" : result.status === "artifact_pending" ? "needs_review" : "pending";
    return NextResponse.json({ outcome, orderNumber: result.orderNumber ?? null, confirmationUrl: result.orderNumber ? `/account/orders/${encodeURIComponent(result.orderNumber)}/confirmation` : null });
  } catch { return NextResponse.json({ outcome: "pending", error: "Payment status could not be checked" }, { status: 202 }); }
}
