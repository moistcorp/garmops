"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PaymentKind } from "@/lib/payu";

type EmailStatus = "idle" | "sending" | "sent" | "failed" | "missing";

type PendingOrder = {
  kind?: PaymentKind;
  name?: string;
  email?: string;
  txnid?: string;
  amount?: string;
  projectName?: string;
  product?: string;
  totalQty?: number;
  retryHref?: string;
  items?: Array<{
    name?: string;
    size?: string;
    quantity?: number;
  }>;
};

type PaymentFailureClientProps = {
  verified: boolean;
  txnid: string;
  error: string;
  paymentKind: PaymentKind | null;
  supportEmail: string;
};

function safeRetryHref(value: unknown, paymentKind: PaymentKind | null): string {
  const fallback = paymentKind === "sample-cart" ? "/checkout" : "/configurator";
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/\s/.test(value)
    ? value
    : fallback;
}

export default function PaymentFailureClient({
  verified,
  txnid,
  error,
  paymentKind,
  supportEmail,
}: PaymentFailureClientProps) {
  const hasHandled = useRef(false);
  const [name, setName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [retryHref, setRetryHref] = useState(() =>
    safeRetryHref(undefined, paymentKind)
  );
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");

  useEffect(() => {
    if (!verified || !paymentKind || !txnid || hasHandled.current) return;
    hasHandled.current = true;

    let order: PendingOrder | null = null;
    try {
      const raw = window.localStorage.getItem("mf_pending_order");
      if (raw) {
        const parsed = JSON.parse(raw) as PendingOrder;
        if (
          parsed.txnid === txnid &&
          (!parsed.kind || parsed.kind === paymentKind)
        ) {
          order = parsed;
        }
      }
    } catch {
      order = null;
    }

    if (!order) {
      queueMicrotask(() => setEmailStatus("missing"));
      return;
    }

    const nextRetryHref = safeRetryHref(order.retryHref, paymentKind);
    queueMicrotask(() => {
      setName(order?.name?.split(/\s+/)[0] ?? "");
      setCustomerEmail(order?.email ?? "");
      setRetryHref(nextRetryHref);
    });

    // Restore the configurator review state so the retry link can continue
    // from the order that produced this payment attempt.
    try {
      const progress = window.sessionStorage.getItem("mf_configurator_v2");
      if (progress) {
        const parsedProgress = JSON.parse(progress) as Record<string, unknown>;
        parsedProgress.screen = "review";
        parsedProgress.savedAt = Date.now();
        window.sessionStorage.setItem(
          "mf_configurator_v2",
          JSON.stringify(parsedProgress)
        );
      }
    } catch {
      // The retry link still works even if optional session progress is invalid.
    }

    if (!order.name || !order.email) {
      queueMicrotask(() => setEmailStatus("missing"));
      return;
    }

    queueMicrotask(() => setEmailStatus("sending"));
    void fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: order.name,
        email: order.email,
        txnid,
        type: paymentKind === "sample-cart" ? "sample" : "configure",
        paymentStatus: "failure",
        orderDetails: {
          amount: order.amount,
          projectName: order.projectName,
          product: order.product,
          totalQty: order.totalQty,
          items: order.items ?? [],
          retryHref: nextRetryHref,
        },
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Payment-status email failed");
        setEmailStatus("sent");
      })
      .catch(() => {
        setEmailStatus("failed");
      });
  }, [paymentKind, txnid, verified]);

  const firstName = name || "";
  const supportHref = `mailto:${supportEmail}`;

  return (
    <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="techpack-surface w-full max-w-md rounded-[4px] border p-5 text-center sm:rounded-[4px] sm:p-9">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] bg-red-50">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#111111]">
          {verified ? "Payment failed" : "Payment not verified"}
        </h1>
        <p className="mb-6 text-sm text-[#111111]/60">
          {firstName ? `Hi ${firstName}, we` : "We"} could not complete your
          payment.
          {error && (
            <span className="mt-1 block text-xs text-red-500">{error}</span>
          )}
        </p>

        {emailStatus === "sending" && (
          <p className="mb-4 text-sm text-[#111111]/55">
            Sending payment guidance to your email…
          </p>
        )}
        {emailStatus === "sent" && customerEmail && (
          <p className="mb-4 text-sm text-[#111111]/65">
            We sent retry guidance to{" "}
            <span className="font-medium text-[#111111]">{customerEmail}</span>.
          </p>
        )}
        {emailStatus === "failed" && (
          <p role="alert" className="mb-4 text-sm text-amber-700">
            We could not send the payment-status email. Keep the transaction
            reference below and contact support if needed.
          </p>
        )}
        {emailStatus === "missing" && verified && (
          <p role="alert" className="mb-4 text-sm text-amber-700">
            We could not restore the email address for this payment attempt.
            Keep the transaction reference below for support.
          </p>
        )}

        {txnid && (
          <p className="mb-6 text-xs text-[#111111]/40">
            Transaction reference:{" "}
            <span className="break-all font-mono">{txnid}</span>
          </p>
        )}

        <div className="techpack-panel mb-6 rounded-[4px] border p-4 text-left text-xs leading-relaxed text-[#111111]/70">
          <p className="mb-1 font-semibold">Important — before retrying</p>
          <p>
            If an amount was deducted from your bank account,{" "}
            <strong>do not retry payment immediately</strong>. Bank transactions
            can take up to <strong>6 hours</strong> to sync with our records. If
            it still does not appear as successful, contact us at{" "}
            <a href={supportHref} className="font-medium underline">
              {supportEmail}
            </a>{" "}
            with the transaction reference.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={retryHref}
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Retry payment
          </Link>

          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-[4px] border border-[var(--color-accent)] py-3.5 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white"
          >
            Back to home
          </Link>

          <a
            href={supportHref}
            className="mt-1 text-xs text-[#111111]/40 transition-colors hover:text-[#111111]"
          >
            Need help? Email us →
          </a>
        </div>
      </div>
    </div>
  );
}
