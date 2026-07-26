"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import type { PaymentKind } from "@/lib/payu";

interface PaymentSuccessClientProps {
  verified: boolean;
  txnid: string;
  paymentKind: PaymentKind | null;
  isMockPayment: boolean;
}

type EmailStatus = "idle" | "sending" | "sent" | "failed" | "skipped";
type OrderDetailsStatus = "checking" | "found" | "missing";

type PendingOrder = {
  kind?: PaymentKind;
  mockPayment?: boolean;
  name?: string;
  email?: string;
  txnid?: string;
  amount?: string;
  product?: string;
  color?: string;
  technique?: string;
  placements?: string;
  neckLabel?: string;
  totalQty?: number;
  sizeBreakdown?: string;
  estimatedTotal?: string;
  shippingAddress?: string;
  items?: Array<{
    name?: string;
    size?: string;
    quantity?: number;
    lineTotal?: number;
  }>;
  shipping?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
};

export default function PaymentSuccessClient({
  verified,
  txnid,
  paymentKind,
  isMockPayment,
}: PaymentSuccessClientProps) {
  const hasHandled = useRef(false);
  const clearCart = useCartStore((state) => state.clearCart);
  const [orderSummary, setOrderSummary] = useState({ name: "", email: "" });
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [orderDetailsStatus, setOrderDetailsStatus] =
    useState<OrderDetailsStatus>("checking");

  useEffect(() => {
    if (!verified || hasHandled.current) return;
    hasHandled.current = true;

    // A verified sample-cart payment means this browser cart should no longer
    // remain purchasable, even when its optional local order summary is missing.
    if (paymentKind === "sample-cart") {
      clearCart();
    }

    let order: PendingOrder | null = null;
    try {
      const raw = window.localStorage.getItem("mf_pending_order");
      if (raw) {
        const parsed = JSON.parse(raw) as PendingOrder;
        if (parsed.txnid === txnid) order = parsed;
      }
    } catch {
      order = null;
    }

    if (!order) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderDetailsStatus("missing");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderDetailsStatus("found");

    // One-time hydration from localStorage on mount, guarded by hasHandled
    // above — not a derived/cascading update, so the lint rule's general
    // "don't setState in an effect" guidance doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderSummary({
      name: order.name ?? "",
      email: order.email ?? "",
    });

    if (isMockPayment) {
      window.localStorage.removeItem("mf_pending_order");
      setEmailStatus("skipped");
      return;
    }

    if (!order.name || !order.email) {
      setEmailStatus("failed");
      return;
    }

    const isSampleOrder = paymentKind === "sample-cart";
    setEmailStatus("sending");
    void fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: order.name,
        email: order.email,
        txnid,
        type: isSampleOrder ? "sample" : "configure",
        orderDetails: isSampleOrder
          ? {
              items: order.items ?? [],
              estimatedTotal: order.amount ? `₹${order.amount}` : "",
              shippingAddress: order.shippingAddress ?? "",
            }
          : {
              product: order.product,
              color: order.color,
              technique: order.technique,
              placements: order.placements,
              neckLabel: order.neckLabel,
              totalQty: order.totalQty,
              sizeBreakdown: order.sizeBreakdown,
              estimatedTotal: order.estimatedTotal,
              shippingAddress: order.shipping
                ? [
                    order.shipping.addressLine1,
                    order.shipping.city,
                    order.shipping.state,
                    order.shipping.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "",
            },
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Confirmation email failed");
        window.localStorage.removeItem("mf_pending_order");
        setEmailStatus("sent");
      })
      .catch(() => {
        // Keep the pending order so a reload can retry the acknowledgement.
        setEmailStatus("failed");
      });
  }, [clearCart, isMockPayment, paymentKind, txnid, verified]);

  if (!verified) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-2xl text-amber-700">
            !
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#111111]">
            Payment not verified
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-[#111111]/60">
            We could not validate a PayU response for this page. If money was
            deducted, do not retry immediately—contact us with your transaction
            reference so we can check it safely.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-full bg-[var(--color-teal)] px-7 py-3 text-sm font-medium text-white hover:bg-[var(--color-teal-dark)]"
            >
              Contact support
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#ECE7DF] px-7 py-3 text-sm font-medium text-[#111111]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSampleOrder = paymentKind === "sample-cart";
  const firstName = orderSummary.name.split(" ")[0];

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-teal)]/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="stroke-[var(--color-teal)]"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#111111]">
          {isMockPayment
            ? "Reservation flow complete"
            : isSampleOrder
              ? "Order placed"
              : "Payment successful"}
        </h1>
        {isMockPayment && (
          <p className="mb-4 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Development preview — no payment was charged.
          </p>
        )}
        <p className="mb-2 text-sm text-[#111111]/60">
          {firstName ? `Thanks ${firstName}!` : "Thank you!"}{" "}
          {isSampleOrder
            ? "Your sample order has been received."
            : "Your production slot has been reserved."}
        </p>

        {orderDetailsStatus === "missing" && (
          <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Your payment was verified, but this browser could not restore the local order details.
            Save the transaction ID below and contact support so we can match the payment safely.
          </p>
        )}

        {emailStatus === "sending" && (
          <p className="mb-1 text-sm text-[#111111]/55">Sending your confirmation…</p>
        )}
        {emailStatus === "sent" && orderSummary.email && (
          <p className="mb-1 text-sm">
            Confirmation sent to{" "}
            <span className="font-medium text-[#111111]">{orderSummary.email}</span>
          </p>
        )}
        {emailStatus === "failed" && (
          <p role="alert" className="mb-1 text-sm text-amber-700">
            The payment is verified, but we could not send the email receipt.
            Please save the transaction ID below.
          </p>
        )}

        {txnid && (
          <p className="mb-6 mt-2 text-xs text-[#111111]/40">
            Transaction ID: <span className="font-mono">{txnid}</span>
          </p>
        )}

        <div className="mb-8 rounded-2xl border border-[#ECE7DF] bg-[var(--color-cream)] p-5 text-left text-xs leading-relaxed text-[#111111]/60">
          <p className="mb-2 font-medium text-[#111111]">What happens next</p>
          {isSampleOrder ? (
            <ul className="flex flex-col gap-1.5">
              <li>· Our team will review and prepare your sample order</li>
              <li>· We will contact you if any delivery detail needs clarification</li>
              <li>· Keep the transaction ID above for your records</li>
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              <li>· Our team will review your order and send a proforma invoice within 24 hours</li>
              <li>· The ₹499 reservation fee will be deducted from your final invoice</li>
              <li>· Production begins after balance payment is received</li>
            </ul>
          )}
        </div>

        <Link
          href="/"
          className="inline-block rounded-full bg-[var(--color-teal)] px-8 py-3 text-sm font-medium text-white hover:bg-[var(--color-teal-dark)]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}