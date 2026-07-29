"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, LoaderCircle, RotateCcw } from "lucide-react";

function retryKey(orderNumber: string): string {
  return `garmops:payment-retry:${orderNumber}`;
}

function idempotencyKey(orderNumber: string): string {
  try {
    const existing = window.sessionStorage.getItem(retryKey(orderNumber));
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(retryKey(orderNumber), created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export default function PaymentRetryButton({
  orderNumber,
  initialAttemptNumber,
  confirmation = false,
}: {
  orderNumber: string;
  initialAttemptNumber: number;
  confirmation?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function preparePayment() {
    setPending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payments/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: idempotencyKey(orderNumber),
          }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        paymentAttempt?: {
          attemptNumber: number;
          status: string;
          created: boolean;
        };
      };
      if (!response.ok || !body.paymentAttempt) {
        throw new Error(body.error ?? "Payment could not be prepared");
      }

      setMessage(
        body.paymentAttempt.created
          ? `Payment attempt ${body.paymentAttempt.attemptNumber} is ready.`
          : `Payment attempt ${body.paymentAttempt.attemptNumber} remains ready.`,
      );
      router.refresh();
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Payment could not be prepared",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={preparePayment}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#315F66] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#254b51] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pending ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        ) : confirmation ? (
          <CreditCard size={16} aria-hidden="true" />
        ) : (
          <RotateCcw size={16} aria-hidden="true" />
        )}
        {pending
          ? "Preparing payment…"
          : confirmation
            ? "Continue to secure payment"
            : `Retry reservation payment${
                initialAttemptNumber > 1 ? ` · attempt ${initialAttemptNumber}` : ""
              }`}
      </button>
      {message ? (
        <p className="mt-3 text-xs leading-relaxed text-[#315F66]" role="status">
          {message} Your order remains saved while secure PayU processing is
          prepared.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs leading-relaxed text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
