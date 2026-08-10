import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ShieldAlert,
} from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import ClearPaidCustomCart from "@/components/payment/ClearPaidCustomCart";
import ClearPaidSampleCart from "@/components/payment/ClearPaidSampleCart";
import {
  getPaymentDisplayState,
  paymentStatusLabel,
} from "@/lib/domain/payments/displayState";
import { formatMoneyPaise, formatOrderCode } from "@/lib/orders/format";

type Result = {
  outcome: "success" | "failure" | "pending" | "needs_review";
  orderNumber: string;
  orderType: string;
  submittedAt: string;
  amountPaise: number;
  paymentStatus: string;
  paymentPurpose: string;
  invoiceStatus: string | null;
  invoiceNumber: string | null;
  invoicePdfFileId: string | null;
  cartId: string | null;
};

const PRESENTATION = {
  success: {
    eyebrow: "Payment successful",
    title: "Payment successful",
    copy: "Your order has been confirmed.",
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
  },
  pending: {
    eyebrow: "Confirming payment",
    title: "We're confirming your payment",
    copy: "PayU hasn't returned a final verified status yet. Don't make another payment while we check it.",
    Icon: Clock3,
    iconClass: "text-amber-600",
  },
  failure: {
    eyebrow: "Payment not completed",
    title: "Payment wasn't completed",
    copy: "Your saved order details are still available. You can return safely and try again when payment is available.",
    Icon: AlertTriangle,
    iconClass: "text-red-600",
  },
  needs_review: {
    eyebrow: "Payment needs review",
    title: "Payment needs review",
    copy: "We received an unusual payment status. Don't make another payment. Our payments team is reviewing it.",
    Icon: ShieldAlert,
    iconClass: "text-amber-700",
  },
  refunded: {
    eyebrow: "Payment refunded",
    title: "Payment refunded",
    copy: "This payment has been refunded. Open your order for the latest details.",
    Icon: ShieldAlert,
    iconClass: "text-[var(--color-accent)]",
  },
} as const;

export default function DurablePaymentResult({ result }: { result: Result }) {
  const state = getPaymentDisplayState(result);
  const presentation = PRESENTATION[state];
  const { Icon } = presentation;
  const sampleOrder = result.orderType === "sample_purchase";
  const orderHref = `/account/orders/${encodeURIComponent(result.orderNumber)}`;
  const canClearCart = state === "success" && result.paymentStatus === "paid";
  const invoiceLabel = result.invoiceNumber
    ? result.invoiceNumber
    : result.invoiceStatus === "completed"
      ? "Available in your order"
      : state === "success"
        ? "Being generated"
        : "Not started";

  return (
    <main className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      {sampleOrder ? (
        <ClearPaidSampleCart paid={canClearCart} />
      ) : (
        <ClearPaidCustomCart cartId={result.cartId} paid={canClearCart} />
      )}

      <section
        className="techpack-surface w-full max-w-xl rounded-[4px] border p-6 sm:p-9"
        aria-live="polite"
      >
        <div className="text-center">
          <Icon size={48} className={`mx-auto ${presentation.iconClass}`} aria-hidden="true" />
          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
            {presentation.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {presentation.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-black/55">
            {presentation.copy}
          </p>
        </div>

        <dl className="mt-7 grid gap-4 rounded-[4px] border border-black/8 bg-white p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-black/40">Order</dt>
            <dd className="mt-1 break-all font-semibold">{formatOrderCode(result.orderNumber)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-black/40">
              {state === "success" ? "Amount paid" : "Amount"}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatMoneyPaise(result.amountPaise)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-black/40">Payment</dt>
            <dd className="mt-1 font-semibold">{paymentStatusLabel(state)}</dd>
          </div>
          <div>
              <dt className="text-xs uppercase tracking-wider text-black/40">
                {sampleOrder ? "Tax document" : "Invoice"}
              </dt>
              <dd className="mt-1 font-semibold">{invoiceLabel}</dd>
              {state === "success" && !result.invoicePdfFileId ? (
                <p className="mt-1 text-xs text-black/45">It will appear in your order once ready.</p>
              ) : null}
          </div>
        </dl>

        {state === "success" ? (
          <div className="mt-6 border-t border-black/8 pt-5">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-black/45">What happens next</h2>
            <ol className="mt-3 space-y-2 text-sm text-black/60">
              <li>1&nbsp;&nbsp;Our team reviews your artwork and production details</li>
              <li>2&nbsp;&nbsp;We&apos;ll contact you if anything needs confirmation</li>
              <li>3&nbsp;&nbsp;Track production from your order page</li>
            </ol>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={orderHref} className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-center text-sm font-semibold text-white">
            {state === "success" || state === "needs_review" || state === "refunded"
              ? "View your order →"
              : state === "pending"
                ? "View order"
                : "Try payment again →"}
          </Link>
          {state === "success" && result.invoicePdfFileId ? (
            <InvoiceDownloadButton fileId={result.invoicePdfFileId} />
          ) : null}
          {state === "needs_review" ? (
            <Link href="/contact" className="rounded-[4px] border border-black/10 px-5 py-3 text-center text-sm font-semibold">Contact support</Link>
          ) : (
            <Link href="/account/orders" className="rounded-[4px] border border-black/10 px-5 py-3 text-center text-sm font-semibold">View all orders</Link>
          )}
        </div>
      </section>
    </main>
  );
}
