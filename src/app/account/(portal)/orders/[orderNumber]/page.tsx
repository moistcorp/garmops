import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Package,
  Palette,
  ReceiptIndianRupee,
  Ruler,
} from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PaymentRetryButton from "@/components/account/PaymentRetryButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { getCustomerOrder } from "@/lib/orders/dal";
import {
  formatMoneyPaise,
  formatOrderDate,
  formatOrderTimestamp,
  publicOrderStatusLabel,
} from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  if (!isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED")) {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="Durable custom ordering is disabled for this environment."
      />
    );
  }

  const number = orderNumberSchema.safeParse((await params).orderNumber);
  if (!number.success) notFound();
  const { supabase, membership } = await requireOrganizationMember(
    `/account/orders/${number.data}`,
  );

  let result: Awaited<ReturnType<typeof getCustomerOrder>>;
  try {
    result = await getCustomerOrder(
      supabase,
      membership.organization_id,
      number.data,
    );
  } catch {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="The order payment history could not be loaded. Try again shortly."
      />
    );
  }
  if (result.order.error || !result.order.data) notFound();
  if (result.items.error || result.history.error) {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="The durable order specification could not be loaded."
      />
    );
  }

  const order = result.order.data;
  const items = result.items.data ?? [];
  const history = result.history.data ?? [];
  const payments = result.payments;
  const latestPayment = payments[0];
  const retryable =
    ["awaiting_payment", "payment_failed"].includes(order.status) &&
    Boolean(latestPayment) &&
    ["created", "initiated", "failed"].includes(latestPayment.status) &&
    !payments.some((payment) => payment.status === "paid");
  const shipping = record(order.shipping_snapshot);
  const shippingAddress = record(shipping.address);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, sync_status, document_number, issue_date, total_paise, pdf_file_id, last_error_message")
    .eq("order_id", order.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[#315F66]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to orders
      </Link>

      <section className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="rounded-full bg-[#4F8B92]/12 px-2.5 py-1 text-[11px] font-semibold text-[#315F66]">
              {publicOrderStatusLabel(order.public_status)}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {order.order_number}
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-black/50">
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={15} aria-hidden="true" />
                {formatOrderDate(order.submitted_at)}
              </span>
              <span className="inline-flex items-center gap-2">
                <ReceiptIndianRupee size={15} aria-hidden="true" />
                Estimated {formatMoneyPaise(order.estimated_total_paise)}
              </span>
            </div>
          </div>
          {retryable && latestPayment ? (
            <PaymentRetryButton
              orderNumber={order.order_number}
              initialAttemptNumber={latestPayment.attempt_number}
              initialPaymentAttemptId={latestPayment.id}
              initialPaymentStatus={latestPayment.status}
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Reservation",
            value: formatMoneyPaise(order.reservation_amount_paise),
            icon: ReceiptIndianRupee,
          },
          {
            label: "Payment",
            value: latestPayment?.status ?? "Unavailable",
            icon: Clock3,
          },
          {
            label: "Requested delivery",
            value: order.requested_delivery_date
              ? formatOrderDate(`${order.requested_delivery_date}T00:00:00Z`)
              : "Not specified",
            icon: CalendarDays,
          },
          {
            label: "Items",
            value: `${items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-IN")} units`,
            icon: Package,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="liquid-glass-panel rounded-2xl border p-5"
          >
            <metric.icon
              size={17}
              className="text-[#4F8B92]"
              aria-hidden="true"
            />
            <p className="mt-4 text-[10px] uppercase tracking-widest text-black/35">
              {metric.label}
            </p>
            <p className="mt-2 font-semibold capitalize">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <Palette
                size={18}
                className="text-[#4F8B92]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Immutable order specification</h3>
            </div>
            <div className="mt-5 space-y-4">
              {items.map((item) => {
                const colour = record(item.colour_snapshot);
                const sizes = record(item.size_breakdown);
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-black/7 bg-white/45 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{item.product_name}</h4>
                        <p className="mt-1 text-sm text-black/50">
                          {String(colour.name ?? "Colour to review")} ·{" "}
                          {item.quantity.toLocaleString("en-IN")} units
                        </p>
                      </div>
                      {item.line_total_paise !== null ? (
                        <span className="text-sm font-semibold">
                          {formatMoneyPaise(item.line_total_paise)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex items-start gap-2 border-t border-black/7 pt-4">
                      <Ruler
                        size={15}
                        className="mt-0.5 text-[#4F8B92]"
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-relaxed text-black/55">
                        {Object.entries(sizes)
                          .map(([size, quantity]) => `${size}: ${quantity}`)
                          .join(" · ")}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <Clock3
                size={18}
                className="text-[#4F8B92]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Order timeline</h3>
            </div>
            <div className="mt-5 space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#4F8B92]" />
                    {index < history.length - 1 ? (
                      <span className="mt-1 h-full w-px bg-black/10" />
                    ) : null}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold">
                      {publicOrderStatusLabel(entry.public_status)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-black/50">
                      {entry.customer_message ?? "Order status updated."}
                    </p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">
                      {formatOrderTimestamp(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <ReceiptIndianRupee
                size={18}
                className="text-[#4F8B92]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Payments</h3>
            </div>
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-black/7 bg-white/45 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Attempt {payment.attempt_number}
                    </p>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold capitalize text-black/55">
                      {payment.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/50">
                    {formatMoneyPaise(payment.amount_paise)} · reservation
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">
                    {formatOrderTimestamp(payment.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {invoice ? (
            <section className="liquid-glass-surface rounded-3xl border p-6">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee size={18} className="text-[#4F8B92]" aria-hidden="true" />
                <h3 className="font-semibold">Reservation invoice</h3>
              </div>
              <p className="mt-4 font-semibold">{invoice.document_number ?? "Being generated"}</p>
              <p className="mt-2 text-sm capitalize text-black/50">
                {invoice.sync_status.replaceAll("_", " ")}
                {invoice.total_paise !== null ? ` · ${formatMoneyPaise(invoice.total_paise)}` : ""}
              </p>
              {invoice.last_error_message ? (
                <p className="mt-3 text-xs leading-relaxed text-red-700">{invoice.last_error_message}</p>
              ) : null}
              {invoice.sync_status === "completed" && invoice.pdf_file_id ? (
                <div className="mt-4"><InvoiceDownloadButton fileId={invoice.pdf_file_id} /></div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-black/40">
                  Your verified payment is safe. The official PDF will appear here after Zoho and private storage finish processing.
                </p>
              )}
            </section>
          ) : null}

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <MapPin
                size={18}
                className="text-[#4F8B92]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Delivery snapshot</h3>
            </div>
            <div className="mt-4 text-sm leading-relaxed text-black/55">
              <p className="font-semibold text-black/75">
                {String(shipping.recipientName ?? "Delivery contact")}
              </p>
              <p className="mt-2">{String(shippingAddress.line1 ?? "")}</p>
              {shippingAddress.line2 ? (
                <p>{String(shippingAddress.line2)}</p>
              ) : null}
              <p>
                {String(shippingAddress.city ?? "")},{" "}
                {String(shippingAddress.state ?? "")}{" "}
                {String(shippingAddress.postalCode ?? "")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
