"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";

import { submitPayuCheckout } from "@/lib/payuClient";

export default function ShippingPaymentButton({
  orderPaymentAttemptId,
}: {
  orderPaymentAttemptId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startPayment() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/payments/payu/initiate-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderPaymentAttemptId }),
      });
      const body = (await response.json()) as {
        error?: string;
        checkoutUrl?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok || !body.checkoutUrl || !body.fields) {
        throw new Error(body.error ?? "Secure shipping payment could not be started");
      }
      await submitPayuCheckout(body.fields, body.checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error
        ? paymentError.message
        : "Secure shipping payment could not be started");
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={startPayment}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          : <CreditCard size={16} aria-hidden="true" />}
        {pending ? "Opening secure PayU…" : "Pay shipping securely"}
      </button>
      {error ? <p className="mt-3 text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
