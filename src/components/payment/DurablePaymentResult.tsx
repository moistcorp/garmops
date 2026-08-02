import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import ClearPaidSampleCart from "@/components/payment/ClearPaidSampleCart";

import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderDate,
} from "@/lib/orders/format";

export default function DurablePaymentResult({
  result,
}: {
  result: {
    outcome: "success" | "failure" | "pending";
    orderNumber: string;
    orderType: string;
    submittedAt: string;
    amountPaise: number;
    paymentStatus: string;
    invoiceStatus: string | null;
    invoiceNumber: string | null;
    invoicePdfFileId: string | null;
  };
}) {
  const success = result.outcome === "success";
  const pending = result.outcome === "pending";
  const sampleOrder = result.orderType === "sample_purchase";
  const reviewRequired = result.paymentStatus === "disputed";
  const Icon = success ? CheckCircle2 : pending ? Clock3 : XCircle;
  const invoice = result.invoiceNumber
    ? result.invoiceNumber
    : reviewRequired
      ? "Payment review pending"
      : sampleOrder && result.invoiceStatus === "not_required"
        ? "Automation not enabled"
        : result.invoiceStatus
          ? "Being generated"
          : success
            ? sampleOrder
              ? "Available when sample invoicing is enabled"
              : "Queued"
            : "Not started";

  return (
    <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6">
      {sampleOrder ? (
        <ClearPaidSampleCart paid={result.paymentStatus === "paid"} />
      ) : null}
      <div className="techpack-surface w-full max-w-xl rounded-[4px] border p-7 text-center sm:p-10">
        <Icon
          size={52}
          className={`mx-auto ${
            success
              ? "text-emerald-600"
              : pending
                ? "text-amber-600"
                : "text-red-600"
          }`}
          aria-hidden="true"
        />
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Durable PayU result
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {success
            ? sampleOrder
              ? "Sample order confirmed"
              : "Reservation confirmed"
            : reviewRequired
              ? "Payment requires review"
              : pending
                ? "Payment verification pending"
                : "Payment was not completed"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          {success
            ? `PayU verified the ${sampleOrder ? "full sample" : "reservation"} payment and your saved order has been updated.`
            : reviewRequired
              ? `Your order is safe. PayU reported another successful attempt for the same ${sampleOrder ? "sample order" : "reservation"}, so do not pay again while our team reviews it.`
              : pending
                ? "Your order is safe. We are reconciling the transaction with PayU; do not make another payment yet."
                : "Your order remains saved and can be retried safely from the order page."}
        </p>

        <dl className="mt-7 grid gap-3 rounded-[4px] border border-black/7 bg-white p-5 text-left sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-black/35">
              Order number
            </dt>
            <dd className="mt-1 font-semibold">{formatOrderCode(result.orderNumber)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-black/35">
              Order date
            </dt>
            <dd className="mt-1 font-semibold">
              {formatOrderDate(result.submittedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-black/35">
              {sampleOrder ? "Full sample payment" : "Reservation"}
            </dt>
            <dd className="mt-1 font-semibold">
              {formatMoneyPaise(result.amountPaise)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-black/35">
              Payment status
            </dt>
            <dd className="mt-1 font-semibold capitalize">
              {result.paymentStatus}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-wider text-black/35">
              {sampleOrder ? "Tax document" : "Invoice"}
            </dt>
            <dd className="mt-1 font-semibold">
              {invoice}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/account/orders/${encodeURIComponent(result.orderNumber)}`}
            className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
          >
            View order
          </Link>
          {result.invoicePdfFileId ? (
            <InvoiceDownloadButton fileId={result.invoicePdfFileId} />
          ) : null}
          <Link
            href="/account/orders"
            className="rounded-[4px] border border-black/10 px-5 py-3 text-sm font-semibold"
          >
            Return to orders
          </Link>
        </div>
      </div>
    </div>
  );
}
