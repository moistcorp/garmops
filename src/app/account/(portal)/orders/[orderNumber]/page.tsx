import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  ReceiptIndianRupee,
  Shirt,
  Truck,
  UserRound,
} from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import ShippingPaymentButton from "@/components/account/ShippingPaymentButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerOrder } from "@/lib/orders/dal";
import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderDate,
  formatOrderTimestamp,
  publicOrderStatusLabel,
} from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";
import { getPaymentDisplayState, paymentStatusLabel } from "@/lib/domain/payments/displayState";
import { summarizeOrderItemPricing } from "@/lib/orders/presentation";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/staff/statuses";
import { formatGstRate, GST_RATE_BASIS_POINTS } from "@/lib/tax";
import type { Enums, Tables } from "@/types/database.generated";

type OrderDetail = Pick<Tables<"orders">,
  | "order_number" | "public_status" | "subtotal_paise" | "discount_paise"
  | "taxable_value_paise" | "tax_paise" | "amount_paid_paise" | "total_paise"
  | "requested_delivery_date" | "configuration_snapshot" | "shipping_snapshot"
  | "billing_snapshot" | "customer_snapshot" | "business_snapshot"
  | "shipping_charge_paise" | "shipping_payment_status"
  | "confirmed_at" | "customer_reference"
>;

type OrderItemRow = Pick<Tables<"order_items">,
  | "id" | "line_number" | "product_name" | "quantity" | "size_breakdown"
  | "unit_price_paise" | "line_total_paise" | "product_snapshot" | "colour_snapshot"
  | "decoration_snapshot" | "artwork_snapshot" | "neck_label_snapshot"
>;

type CustomerHistoryRow = {
  id: string;
  to_status: Enums<"order_status">;
  public_status: Enums<"public_order_status">;
  customer_message: string | null;
  created_at: string;
};
type CustomerPaymentRow = {
  payment_attempt_id: string;
  purpose: string;
  status: string;
  amount_paise: number;
  created_at: string | null;
  paid_at: string | null;
};
type InvoiceRow = Pick<Tables<"invoices">,
  "id" | "invoice_number" | "status" | "total_paise" | "pdf_file_id" | "created_at"
>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function textValue(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function numberValue(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}
function humanize(value: unknown): string {
  return typeof value === "string" && value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not recorded";
}
function addressLines(snapshot: Record<string, unknown>): string[] {
  const source = record(snapshot.address ?? snapshot);
  const locality = [textValue(source, "city"), textValue(source, "state"), textValue(source, "postalCode", "pincode", "zip")]
    .filter(Boolean)
    .join(", ");
  return [
    textValue(source, "line1", "addressLine1"),
    textValue(source, "line2", "addressLine2"),
    locality,
    textValue(source, "country"),
  ].filter(Boolean);
}
function SnapshotRows({ rows }: { rows: Array<[string, string | number | null | undefined]> }) {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && String(value).trim());
  if (!visible.length) return <p className="text-xs text-black/40">Not recorded</p>;
  return <dl className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
    {visible.map(([label, value]) => <div key={label}><dt className="text-black/40">{label}</dt><dd className="mt-0.5 font-medium text-black/70">{value}</dd></div>)}
  </dl>;
}

export const dynamic = "force-dynamic";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const parsed = orderNumberSchema.safeParse((await params).orderNumber);
  if (!parsed.success) notFound();
  const { supabase, user } = await requireCustomer(`/account/orders/${parsed.data}`);
  const result = await getCustomerOrder(supabase, user.id, parsed.data);
  if (result.order.error || !result.order.data) notFound();
  if (result.items.error || result.history.error || result.payments.error || result.invoices.error) {
    return <PortalPlaceholder title="Order unavailable" description="The complete order record could not be loaded." />;
  }

  const order = result.order.data as unknown as OrderDetail;
  const items = (result.items.data ?? []) as unknown as OrderItemRow[];
  const history = (result.history.data ?? []) as unknown as CustomerHistoryRow[];
  const payments = (result.payments.data ?? []) as unknown as CustomerPaymentRow[];
  const invoices = (result.invoices.data ?? []) as unknown as InvoiceRow[];
  const shippingPayment = payments.find((payment) => payment.purpose === "shipping");
  const shipping = record(order.shipping_snapshot);
  const billing = record(order.billing_snapshot);
  const customer = record(order.customer_snapshot);
  const business = record(order.business_snapshot);
  const configuration = record(order.configuration_snapshot);
  const deliveryType = textValue(configuration, "deliveryType");
  const orderNotes = textValue(configuration, "orderNotes");
  const gstRateBasisPoints = items
    .map((item) => numberValue(record(item.product_snapshot), "gstRateBasisPoints"))
    .find((rate) => rate > 0) || GST_RATE_BASIS_POINTS;
  const pricingBreakdown = summarizeOrderItemPricing(
    items.map((item) => ({
      quantity: item.quantity,
      lineTotalPaise: item.line_total_paise,
      productSnapshot: item.product_snapshot,
    })),
  );

  return <div className="space-y-6">
    <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-black/50"><ArrowLeft size={15} />Back to orders</Link>

    <section className="techpack-surface rounded border p-6">
      <span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(order.public_status)}</span>
      <h1 className="mt-4 text-2xl font-semibold">{formatOrderCode(order.order_number)}</h1>
      <p className="mt-2 text-sm text-black/50">Payment confirmed {formatOrderDate(order.confirmed_at)}</p>
      <div className="mt-5">
        <SnapshotRows rows={[
          ["Configured merchandise", formatMoneyPaise(pricingBreakdown.configuredMerchandisePaise || order.subtotal_paise)],
          ["Volume discount", `-${formatMoneyPaise(pricingBreakdown.volumeDiscountPaise)}`],
          ["Rush delivery", pricingBreakdown.rushPaise > 0 ? `+${formatMoneyPaise(pricingBreakdown.rushPaise)}` : "Not selected"],
          ["Order subtotal", formatMoneyPaise(order.subtotal_paise)],
          ["Promo discount", `-${formatMoneyPaise(order.discount_paise)}`],
          [`${formatGstRate(gstRateBasisPoints)} GST`, formatMoneyPaise(order.tax_paise)],
          ["Total paid", formatMoneyPaise(order.amount_paid_paise)],
          ["Target delivery", `${deliveryType ? `${humanize(deliveryType)} · ` : ""}${order.requested_delivery_date ? formatOrderDate(order.requested_delivery_date) : "Not recorded"}`],
        ]} />
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-5">
        <section className="techpack-surface rounded border p-6">
          <div className="flex items-center gap-2"><Shirt size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Configured products</h2></div>
          <div className="mt-4 space-y-4">
            {items.map((item) => {
              const product = record(item.product_snapshot);
              const colour = record(item.colour_snapshot);
              const decoration = record(item.decoration_snapshot);
              const artwork = record(item.artwork_snapshot);
              const neckLabel = record(item.neck_label_snapshot);
              const frontArtwork = record(artwork.front);
              const backArtwork = record(artwork.back);
              return <details key={item.id} className="group rounded border border-black/8 bg-white p-4" open={items.length === 1}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div><p className="font-semibold">Line {item.line_number}: {item.product_name}</p><p className="mt-1 text-sm text-black/50">{item.quantity.toLocaleString("en-IN")} units · {textValue(colour, "name", "label") || "Colour not recorded"}</p></div>
                    <div className="text-right"><p className="font-semibold">{formatMoneyPaise(item.line_total_paise)}</p><p className="text-xs text-black/40">{formatMoneyPaise(item.unit_price_paise)} / unit</p></div>
                  </div>
                </summary>
                <div className="mt-4 space-y-4 border-t border-black/8 pt-4">
                  <SnapshotRows rows={[
                    ["Product", item.product_name], ["GSM", textValue(product, "gsm")], ["Fit", textValue(product, "fit")],
                    ["Fabric", textValue(product, "fabric", "fabricFeel")], ["Colour", textValue(colour, "name", "label")],
                    ["Pantone", textValue(colour, "pantone")], ["HEX", textValue(colour, "hex")],
                    ["Front technique", humanize(textValue(decoration, "frontTechnique", "technique"))],
                    ["Back technique", humanize(textValue(decoration, "backTechnique"))],
                    ["Volume discount", `${numberValue(product, "discountPercent")} %`],
                    ["Rush surcharge", numberValue(product, "rushSurchargePaise") > 0 ? formatMoneyPaise(numberValue(product, "rushSurchargePaise")) : "None"],
                  ]} />
                  <div><p className="mb-2 text-xs font-semibold text-black/55">Size allocation</p><div className="flex flex-wrap gap-2">{Object.entries(record(item.size_breakdown)).map(([size, quantity]) => <span key={size} className="rounded border border-black/8 px-2 py-1 text-xs">{size}: {String(quantity)}</span>)}</div></div>
                  <SnapshotRows rows={[
                    ["Front artwork", textValue(frontArtwork, "fileName", "name", "filename") || (frontArtwork.fileId ? "Uploaded file" : "None")],
                    ["Back artwork", textValue(backArtwork, "fileName", "name", "filename") || (backArtwork.fileId ? "Uploaded file" : "None")],
                    ["Neck label", neckLabel.labelType === "standard-size" || (!neckLabel.fileId && !neckLabel.fileUrl) ? "Standard size label only" : textValue(neckLabel, "fileName", "name", "filename") || (neckLabel.fileId ? "Uploaded file" : "Custom neck label")],
                  ]} />
                </div>
              </details>;
            })}
          </div>
        </section>

        <section className="techpack-surface rounded border p-6">
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Production timeline</h2></div>
          <div className="mt-4 space-y-4">{history.map((entry) => <div key={entry.id} className="border-l border-black/10 pl-4"><p className="text-sm font-semibold">{ORDER_STATUS_LABELS[entry.to_status as OrderStatus] ?? publicOrderStatusLabel(entry.public_status)}</p><p className="mt-1 text-xs text-black/50">{entry.customer_message ?? publicOrderStatusLabel(entry.public_status)}</p><p className="mt-1 text-[10px] text-black/35">{formatOrderTimestamp(entry.created_at)}</p></div>)}</div>
        </section>
      </div>

      <div className="space-y-5">
        <section className="techpack-surface rounded border p-6">
          <div className="flex items-center gap-2"><FileText size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Project details</h2></div>
          <div className="mt-4"><SnapshotRows rows={[["Reference", order.customer_reference], ["Delivery type", humanize(deliveryType)], ["Requested date", order.requested_delivery_date ? formatOrderDate(order.requested_delivery_date) : "Not recorded"]]} /></div>
          {orderNotes ? <div className="mt-4 border-t border-black/8 pt-4"><p className="text-xs text-black/40">Order notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-black/65">{orderNotes}</p></div> : null}
        </section>

        <section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><UserRound size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Customer & billing</h2></div><div className="mt-4 space-y-4"><SnapshotRows rows={[["Name", textValue(customer, "name")], ["Email", textValue(customer, "email")], ["Phone", textValue(customer, "phone")], ["Department", textValue(customer, "department")], ["Billing entity", textValue(billing, "entity", "name")], ["GSTIN", textValue(billing, "gstin") || textValue(business, "gstin")]]} /><div><p className="text-xs text-black/40">Billing address</p>{addressLines(billing).map((line) => <p key={line} className="mt-1 text-sm text-black/60">{line}</p>)}</div></div></section>

        <section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><MapPin size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Delivery</h2></div><div className="mt-4"><p className="font-medium">{textValue(shipping, "recipientName", "name")}</p>{addressLines(shipping).map((line) => <p key={line} className="mt-1 text-sm text-black/60">{line}</p>)}{shipping.multipleLocations ? <p className="mt-3 rounded bg-amber-50 p-3 text-xs text-amber-900">Multiple locations: {textValue(shipping, "multipleLocationsNotes") || "Operations will confirm the split."}</p> : null}</div></section>

        <section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><CreditCard size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Payment history</h2></div><div className="mt-4 space-y-3">{payments.length ? payments.map((payment) => <div key={payment.payment_attempt_id} className="rounded border border-black/8 p-3"><p className="text-sm font-semibold">{humanize(payment.purpose)} · {paymentStatusLabel(getPaymentDisplayState({ outcome: "pending", paymentStatus: payment.status }))}</p><p className="mt-1 text-xs text-black/45">{formatMoneyPaise(payment.amount_paise)}{payment.paid_at ? ` · Paid ${formatOrderTimestamp(payment.paid_at)}` : ""}</p></div>) : <p className="text-sm text-black/45">No customer-visible payment record.</p>}</div></section>

        <section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><ReceiptIndianRupee size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">GST invoices</h2></div><div className="mt-4 space-y-4">{invoices.length ? invoices.map((invoice) => <div key={invoice.id} className="rounded border border-black/8 p-3"><p className="font-semibold">{invoice.invoice_number || `Invoice ${humanize(invoice.status)}`}</p><p className="mt-1 text-sm text-black/50">{formatMoneyPaise(invoice.total_paise)}</p>{invoice.pdf_file_id ? <div className="mt-3"><InvoiceDownloadButton fileId={invoice.pdf_file_id} /></div> : <p className="mt-2 text-xs text-black/45">PDF generation is {humanize(invoice.status).toLowerCase()}.</p>}</div>) : <p className="text-sm text-black/45">Invoice generation is pending.</p>}</div></section>

        <section className="techpack-surface rounded border p-6">
          <div className="flex items-center gap-2"><Truck size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Shipping payment</h2></div>
          <p className="mt-3 text-sm text-black/55">{humanize(order.shipping_payment_status)}</p>
          {order.shipping_charge_paise != null
            ? <p className="mt-1 font-semibold">{formatMoneyPaise(order.shipping_charge_paise)}</p>
            : <p className="mt-1 text-xs text-black/45">Operations will calculate shipping separately.</p>}
          {shippingPayment && ["created", "initiated"].includes(shippingPayment.status)
            ? <ShippingPaymentButton orderPaymentAttemptId={shippingPayment.payment_attempt_id} />
            : shippingPayment?.status === "pending"
              ? <p className="mt-3 rounded bg-amber-50 p-3 text-xs text-amber-900">PayU verification is pending. Do not pay again until this status changes.</p>
              : shippingPayment?.status === "failed"
                ? <p className="mt-3 text-xs text-red-700">The previous shipping payment was not completed. Operations must issue a fresh secure payment attempt.</p>
                : null}
        </section>
      </div>
    </div>
  </div>;
}
