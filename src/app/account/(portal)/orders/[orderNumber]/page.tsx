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
import CustomerOrderReplyForm from "@/components/account/CustomerOrderReplyForm";
import PaymentRetryButton from "@/components/account/PaymentRetryButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import CustomerOrderLifecyclePanel from "@/components/account/CustomerOrderLifecyclePanel";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { getCustomerOrder } from "@/lib/orders/dal";
import { assessReorder } from "@/lib/domain/orders/reorder";
import {
  formatOrderCode,
  formatMoneyPaise,
  formatOrderDate,
  formatOrderTimestamp,
  publicOrderStatusLabel,
} from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";

export const dynamic = "force-dynamic";

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
  if (
    !isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED") &&
    !isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED")
  ) {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="Durable ordering is disabled for this environment."
      />
    );
  }

  const number = orderNumberSchema.safeParse((await params).orderNumber);
  if (!number.success) notFound();
  const { supabase, membership, user } = await requireOrganizationMember(
    `/account/orders/${number.data}`,
  );

  let result: Awaited<ReturnType<typeof getCustomerOrder>>;
  try {
    result = await getCustomerOrder(
      supabase,
      membership.organization_id,
      user.id,
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
  if (result.items.error || result.history.error || result.comments.error) {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="The order details could not be loaded."
      />
    );
  }

  const order = result.order.data;
  const orderFlowEnabled =
    order.order_type === "sample_purchase"
      ? isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED")
      : isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED");
  if (!orderFlowEnabled) {
    return (
      <PortalPlaceholder
        title="Order unavailable"
        description="This order type is disabled for this environment."
      />
    );
  }
  const sampleOrder = order.order_type === "sample_purchase";
  const items = result.items.data ?? [];
  const history = result.history.data ?? [];
  const comments = result.comments.data ?? [];
  const payments = result.payments;
  const latestPayment = payments[0];
  const retryable =
    ["awaiting_payment", "payment_failed"].includes(order.status) &&
    Boolean(latestPayment) &&
    ["created", "initiated", "failed"].includes(latestPayment.status) &&
    !payments.some((payment) => payment.status === "paid");
  const shipping = record(order.shipping_snapshot);
  const shippingAddress = record(shipping.address);
  const reorderAssessment =
    !sampleOrder && order.status === "delivered" && ["owner", "buyer"].includes(membership.role)
      ? await assessReorder({
          supabase,
          organizationId: membership.organization_id,
          sourceOrderNumber: order.order_number,
        })
      : null;

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
        className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[#1D49B4]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to my orders
      </Link>

      <section className="techpack-surface rounded-[4px] border p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="techpack-stamp" data-tone="accent">
              {publicOrderStatusLabel(order.public_status)}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {formatOrderCode(order.order_number)}
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
              paymentPurpose={latestPayment.purpose as "reservation" | "sample_full"}
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: sampleOrder ? "Full sample payment" : "Reservation",
            value: formatMoneyPaise(
              sampleOrder
                ? order.estimated_total_paise
                : order.reservation_amount_paise,
            ),
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
            className="techpack-panel rounded-[4px] border p-5"
          >
            <metric.icon
              size={17}
              className="text-[#1D49B4]"
              aria-hidden="true"
            />
            <p className="mt-4 text-[10px] uppercase tracking-widest text-black/35">
              {metric.label}
            </p>
            <p className="mt-2 font-semibold capitalize">{metric.value}</p>
          </div>
        ))}
      </div>

      <CustomerOrderLifecyclePanel
        order={{ order_number: order.order_number, status: order.status, order_type: order.order_type }}
        membershipRole={membership.role}
        approvals={result.approvals}
        shipments={result.shipments}
        shipmentEvents={result.shipmentEvents}
        files={result.files}
        reorderAssessment={reorderAssessment}
      />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <section className="techpack-surface rounded-[4px] border p-6">
            <div className="flex items-center gap-2">
              <Palette
                size={18}
                className="text-[#1D49B4]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Order items</h3>
            </div>
            <div className="mt-5 space-y-4">
              {items.map((item) => {
                const colour = record(item.colour_snapshot);
                const sizes = record(item.size_breakdown);
                return (
                  <article
                    key={item.id}
                    className="rounded-[4px] border border-black/7 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{item.product_name}</h4>
                        <p className="mt-1 text-sm text-black/50">
                          {sampleOrder
                            ? `${String(record(item.product_snapshot).gsm ?? "Catalogue")} GSM sample`
                            : String(colour.name ?? "Colour to review")} ·{" "}
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
                        className="mt-0.5 text-[#1D49B4]"
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

          <section className="techpack-surface rounded-[4px] border p-6">
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="text-[#1D49B4]" aria-hidden="true" />
              <h3 className="font-semibold">Updates and messages</h3>
            </div>
            <div className="mt-5 space-y-3">
              {comments.map((comment) => (
                <article
                  key={comment.id}
                  className={`rounded-[4px] border p-4 ${comment.action_required && !comment.resolved_at ? "border-blue-200 bg-blue-50/60" : "border-black/7 bg-white"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold">
                      {comment.action_required
                        ? comment.resolved_at
                          ? "Action completed"
                          : "Action required"
                        : "Order message"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-black/30">
                      {formatOrderTimestamp(comment.created_at)}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-black/60">{comment.body}</p>
                  {comment.action_type ? <p className="mt-2 text-xs capitalize text-black/40">Requested: {comment.action_type.replaceAll("_", " ")}</p> : null}
                </article>
              ))}
              {!comments.length ? <p className="py-5 text-center text-sm text-black/40">No customer messages yet.</p> : null}
            </div>
            <CustomerOrderReplyForm orderId={order.id} orderNumber={order.order_number} />
          </section>

          <section className="techpack-surface rounded-[4px] border p-6">
            <div className="flex items-center gap-2">
              <Clock3
                size={18}
                className="text-[#1D49B4]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Order timeline</h3>
            </div>
            <div className="mt-5 space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-[4px] bg-[#1D49B4]" />
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
          <section className="techpack-surface rounded-[4px] border p-6">
            <div className="flex items-center gap-2">
              <ReceiptIndianRupee
                size={18}
                className="text-[#1D49B4]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Payments</h3>
            </div>
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-[4px] border border-black/7 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      Payment {formatOrderDate(payment.created_at)}
                    </p>
                    <span className="rounded-[4px] bg-black/5 px-2 py-1 text-[10px] font-semibold capitalize text-black/55">
                      {payment.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/50">
                    {formatMoneyPaise(payment.amount_paise)} ·{" "}
                    {payment.purpose === "sample_full"
                      ? "full sample payment"
                      : "reservation"}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">
                    {formatOrderTimestamp(payment.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {invoice ? (
            <section className="techpack-surface rounded-[4px] border p-6">
              <div className="flex items-center gap-2">
                <ReceiptIndianRupee size={18} className="text-[#1D49B4]" aria-hidden="true" />
                <h3 className="font-semibold">{sampleOrder ? "Sample invoice" : "Invoice"}</h3>
              </div>
              <p className="mt-4 font-semibold">
                {invoice.document_number ??
                  (sampleOrder && invoice.sync_status === "not_required"
                    ? "Invoice is being prepared"
                    : "Being generated")}
              </p>
              <p className="mt-2 text-sm capitalize text-black/50">
                {invoice.sync_status.replaceAll("_", " ")}
                {invoice.total_paise !== null ? ` · ${formatMoneyPaise(invoice.total_paise)}` : ""}
              </p>
              {invoice.last_error_message ? (
                <p className="mt-3 text-xs leading-relaxed text-red-700">{invoice.last_error_message}</p>
              ) : null}
              {invoice.sync_status === "completed" && invoice.pdf_file_id ? (
                <div className="mt-4"><InvoiceDownloadButton fileId={invoice.pdf_file_id} /></div>
              ) : sampleOrder && invoice.sync_status === "not_required" ? (
                <p className="mt-3 text-xs leading-relaxed text-black/40">
                  Your payment is recorded. The invoice will appear here when it is ready.
                </p>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-black/40">
                  Your payment is recorded. The PDF will appear here when it is ready.
                </p>
              )}
            </section>
          ) : null}

          <section className="techpack-surface rounded-[4px] border p-6">
            <div className="flex items-center gap-2">
              <MapPin
                size={18}
                className="text-[#1D49B4]"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Delivery</h3>
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
