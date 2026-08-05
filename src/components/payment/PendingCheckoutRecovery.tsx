"use client";

import Link from "next/link";
import { AlertTriangle, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PendingCheckoutRecoveryProps = {
  outcome: "pending" | "failure";
  checkoutAttemptId?: string;
  retryHref: string;
  retryLabel?: string;
};

type VerificationState = "pending" | "checking" | "failure" | "error";

export default function PendingCheckoutRecovery({
  outcome,
  checkoutAttemptId,
  retryHref,
  retryLabel = "Return to checkout",
}: PendingCheckoutRecoveryProps) {
  const automaticCheckStarted = useRef(false);
  const [state, setState] = useState<VerificationState>(
    outcome === "failure" ? "failure" : "pending",
  );
  const [message, setMessage] = useState(
    outcome === "failure"
      ? "PayU did not complete this payment. No order was created, so you can try again safely."
      : "PayU is still verifying this payment. Do not start another payment until its status is confirmed.",
  );

  const recheckPayment = useCallback(async () => {
    if (!checkoutAttemptId || state === "checking") return;
    setState("checking");
    setMessage("Checking the verified payment status with PayU…");

    try {
      const response = await fetch("/api/payments/payu/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutAttemptId }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        outcome?: "success" | "failure" | "pending";
        confirmationUrl?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Payment status could not be checked");
      }
      if (body.outcome === "success" && body.confirmationUrl) {
        window.location.assign(body.confirmationUrl);
        return;
      }
      if (body.outcome === "failure") {
        setState("failure");
        setMessage(
          "PayU confirmed that this payment was not completed. No order was created, so you can try again safely.",
        );
        return;
      }

      setState("pending");
      setMessage(
        "PayU is still verifying this payment. Do not start another payment yet; check again shortly.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment status could not be checked. Do not pay again until verification completes.",
      );
    }
  }, [checkoutAttemptId, state]);

  useEffect(() => {
    if (
      outcome !== "pending" ||
      !checkoutAttemptId ||
      automaticCheckStarted.current
    ) {
      return;
    }
    automaticCheckStarted.current = true;
    void recheckPayment();
  }, [checkoutAttemptId, outcome, recheckPayment]);

  const isFailure = state === "failure";
  const isChecking = state === "checking";

  return (
    <section
      className={`rounded border p-4 ${
        isFailure
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
      aria-live="polite"
    >
      <div className="flex gap-3">
        {isFailure ? (
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={18} />
        ) : isChecking ? (
          <LoaderCircle className="mt-0.5 shrink-0 animate-spin text-amber-700" size={18} />
        ) : (
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={18} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {isFailure ? "Payment not completed" : "Payment verification pending"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-black/60">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!isFailure && checkoutAttemptId ? (
              <button
                type="button"
                onClick={() => void recheckPayment()}
                disabled={isChecking}
                className="inline-flex items-center gap-2 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChecking ? (
                  <LoaderCircle className="animate-spin" size={14} />
                ) : (
                  <RefreshCw size={14} />
                )}
                {isChecking ? "Checking PayU" : "Check payment status"}
              </button>
            ) : null}
            {isFailure ? (
              <Link
                href={retryHref}
                className="inline-flex items-center rounded border border-black/10 bg-white px-3 py-2 text-xs font-semibold"
              >
                {retryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
