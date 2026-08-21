"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  normalizePaymentCheckoutType,
  paymentFailureReturnHref,
  type PaymentCheckoutType,
} from "@/lib/payments/checkoutReturn";

export default function PaymentStatusClient({ cartId, txnid }: { cartId: string; txnid?: string }) {
  const [status, setStatus] = useState("payment_pending");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [checkoutType, setCheckoutType] = useState<PaymentCheckoutType | null>(null);
  const failureRecheckStarted = useRef(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const response = await fetch(`/api/payments/payu/status?cartId=${encodeURIComponent(cartId)}${txnid ? `&txnid=${encodeURIComponent(txnid)}` : ""}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { status?: string; orderNumber?: string | null; checkoutType?: unknown };
      if (!active) return;
      setStatus(body.status ?? "payment_pending");
      setOrderNumber(body.orderNumber ?? null);
      setCheckoutType((current) => normalizePaymentCheckoutType(body.checkoutType) ?? current);
      if (body.status === "payment_failed" && cartId && !failureRecheckStarted.current) {
        failureRecheckStarted.current = true;
        // The status endpoint may only read the callback result. Recheck also
        // transitions the checkout attempt out of its active lock so a failed
        // cart can safely be paid again.
        void fetch("/api/payments/payu/recheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, txnid }),
        });
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [cartId, txnid]);

  const success = status === "order_complete";
  const failed = status === "payment_failed";
  return <main className="mx-auto max-w-xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold">{success ? "Payment received" : failed ? "Payment not completed" : "Verifying payment"}</h1><p className="mt-3 text-sm text-black/55">{success ? "Your order is complete." : failed ? "No order was created. You can safely return to checkout." : "We are checking the authoritative payment status. You can leave this page; webhook reconciliation continues on the server."}</p>{success && orderNumber ? <Link href={`/account/orders/${encodeURIComponent(orderNumber)}/confirmation`} className="mt-7 inline-flex rounded bg-(--color-accent) px-5 py-3 text-sm font-semibold text-white">View order</Link> : failed && cartId ? <Link href={paymentFailureReturnHref(cartId, checkoutType)} className="mt-7 inline-flex rounded bg-(--color-accent) px-5 py-3 text-sm font-semibold text-white">Return to checkout</Link> : <Link href="/account/orders" className="mt-7 inline-flex rounded border border-black/10 px-5 py-3 text-sm font-semibold">View my orders</Link>}</main>;
}
