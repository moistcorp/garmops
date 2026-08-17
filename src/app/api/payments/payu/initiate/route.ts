import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { checkoutPaymentAttemptId?: string; cartId?: string };
  const cartId = body.cartId ?? body.checkoutPaymentAttemptId;
  if (!cartId) return NextResponse.json({ error: "Cart is required" }, { status: 400 });
  try {
    const result = await medusaRequest<{ paymentSession: { data?: Record<string, unknown> }; amountPaise: number }>("/store/garmops/payments/payu/initiate", { method: "POST", actor: "customer", body: { cartId } });
    const session = result.paymentSession;
    const raw = session.data ?? {};
    const fields = ((raw.fields ?? raw) as Record<string, unknown>);
    const checkoutUrl = typeof raw.checkoutUrl === "string" ? raw.checkoutUrl : undefined;
    if (!checkoutUrl) return NextResponse.json({ error: "Secure payment could not be configured. Please try again." }, { status: 502 });
    return NextResponse.json({ checkoutUrl, fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => ["string", "number"].includes(typeof value)).map(([key, value]) => [key, String(value)])), amountPaise: result.amountPaise, cartId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Secure payment could not be started" }, { status: 409 }); }
}
