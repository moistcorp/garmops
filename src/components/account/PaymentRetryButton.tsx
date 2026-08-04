"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { submitPayuCheckout } from "@/lib/payuClient";

export default function PaymentRetryButton({
  checkoutPaymentAttemptId,
}: {
  checkoutPaymentAttemptId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startPayment() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/payments/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutPaymentAttemptId }),
      });
      const body = (await response.json()) as { error?: string; checkoutUrl?: string; fields?: Record<string, string> };
      if (!response.ok || !body.checkoutUrl || !body.fields) throw new Error(body.error ?? "Secure payment could not be started");
      submitPayuCheckout(body.fields, body.checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Secure payment could not be started");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={startPayment} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)] disabled:cursor-wait disabled:opacity-60 sm:w-auto">
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CreditCard size={16} aria-hidden="true" />}
        {pending ? "Opening secure payment…" : "Retry full payment"}
      </button>
      {error ? <p className="mt-3 text-xs leading-relaxed text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
