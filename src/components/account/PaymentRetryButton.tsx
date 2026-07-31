"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle, RotateCcw } from "lucide-react";
import { submitPayuCheckout } from "@/lib/payuClient";

export default function PaymentRetryButton({
  orderNumber,
  initialAttemptNumber,
  initialPaymentAttemptId,
  initialPaymentStatus,
  confirmation = false,
  paymentPurpose = "reservation",
}: {
  orderNumber: string;
  initialAttemptNumber: number;
  initialPaymentAttemptId: string;
  initialPaymentStatus: string;
  confirmation?: boolean;
  paymentPurpose?: "reservation" | "sample_full";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startPayment() {
    setPending(true);
    setError("");
    try {
      let paymentAttemptId = initialPaymentAttemptId;
      if (!confirmation || initialPaymentStatus === "failed") {
        const retryResponse = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/payments/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        });
        const retryBody = (await retryResponse.json()) as { error?: string; paymentAttempt?: { id: string } };
        if (!retryResponse.ok || !retryBody.paymentAttempt) throw new Error(retryBody.error ?? "Payment retry could not be prepared");
        paymentAttemptId = retryBody.paymentAttempt.id;
      }
      const response = await fetch("/api/payments/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentAttemptId }),
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
      <button type="button" onClick={startPayment} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173A91] disabled:cursor-wait disabled:opacity-60 sm:w-auto">
        {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : confirmation ? <CreditCard size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
        {pending
          ? "Opening secure payment…"
          : confirmation
            ? `Continue to secure ${paymentPurpose === "sample_full" ? "sample" : "reservation"} payment`
            : `Retry ${paymentPurpose === "sample_full" ? "sample" : "reservation"} payment${initialAttemptNumber > 1 ? ` · attempt ${initialAttemptNumber}` : ""}`}
      </button>
      {error ? <p className="mt-3 text-xs leading-relaxed text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
