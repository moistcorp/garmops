import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, FileText, MapPin, Palette, ReceiptIndianRupee, Ruler, Truck, UserRound, Wrench } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderCode, formatOrderDate, formatOrderTimestamp, publicOrderStatusLabel } from "@/lib/orders/format";
import { allowedNextStatusesForRole, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/staff/statuses";
import { CancellationDecisionForm, CancellationRequestForm, ConfigurationRevisionForm, RefundForm, ReopenConfigurationForm, ShippingPaymentForm, StatusTransitionForm } from "@/components/staff/StaffOrderForms";
import PrivateFileDownloadButton from "@/components/staff/PrivateFileDownloadButton";
import ArtworkReviewForm from "@/components/staff/ArtworkReviewForm";
import type { Enums, Tables } from "@/types/database.generated";
type StaffHistoryRow = { id: string; to_status: Enums<"order_status">; public_status: Enums<"public_order_status">; customer_message: string | null; internal_note: string | null; reason: string | null; created_at: string; actor_type: string };
type StaffPaymentRow = { payment_attempt_id: string; purpose: string; status: string; amount_paise: number; provider_payment_id: string | null; provider_merchant_txn_id: string | null };

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(source: Record<string, unknown>, ...keys: string[]) { for (const key of keys) { const value = source[key]; if (typeof value === "string" && value.trim()) return value; } return ""; }

export default async function StaffOrderWorkspace({ orderNumber }: { orderNumber: string }) {
  const context = await requireStaffPermission("view_all_orders");
  const { supabase } = context;
  const orderResult = await supabase.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  const order = orderResult.data as Tables<"orders"> | null;
  if (orderResult.error || !order) notFound();

  const [itemsResult, historyResult, filesResult, invoiceResult, revisionsResult, paymentResult, cancellationResult] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).order("line_number"),
    supabase.rpc("staff_order_history", { p_order_id: order.id }),
    supabase.from("order_files").select("id, kind, original_filename, safe_filename, content_type, byte_size, scan_status, review_status, review_reason, created_at").eq("order_id", order.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, invoice_number, status, total_paise, pdf_file_id, created_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("order_configuration_revisions").select("id, revision_number, changed_paths, reason, created_at").eq("order_id", order.id).order("revision_number", { ascending: false }),
    supabase.rpc("staff_payment_summaries", { p_order_id: order.id }),
    supabase.from("cancellation_requests").select("id, status, reason, created_at").eq("order_id", order.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const items = (itemsResult.data ?? []) as unknown as Tables<"order_items">[];
  const history = (historyResult.data ?? []) as unknown as StaffHistoryRow[];
  const files = (filesResult.data ?? []) as unknown as Tables<"order_files">[];
  const revisions = (revisionsResult.data ?? []) as unknown as Tables<"order_configuration_revisions">[];
  const payments = (paymentResult.data ?? []) as unknown as StaffPaymentRow[];
  const pendingCancellation = cancellationResult.data as Tables<"cancellation_requests"> | null;
  const customer = record(order.customer_snapshot);
  const shipping = record(order.shipping_snapshot);
  const address = record(shipping.address ?? shipping);
  const billing = record(order.billing_snapshot);
  const business = record(order.business_snapshot);
  const nextStatuses = allowedNextStatusesForRole(order.status as OrderStatus, context.role);
  const customerName = stringValue(customer, "name", "fullName", "contactName") || stringValue(billing, "contactName") || "Customer";

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[var(--color-accent)]"><ArrowLeft size={15} />Back to order queue</Link>
      <section className="techpack-surface rounded-[4px] border p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5"><div><span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(order.public_status)}</span><h1 className="mt-4 text-2xl font-semibold">{formatOrderCode(order.order_number)}</h1><p className="mt-2 text-sm text-black/50">Confirmed {formatOrderDate(order.confirmed_at)} · {customerName}</p></div><div className="text-right"><p className="text-xs uppercase tracking-wider text-black/40">Full order payment</p><p className="mt-1 text-xl font-semibold">{formatMoneyPaise(order.amount_paid_paise)}</p><p className="text-xs text-black/40">Total {formatMoneyPaise(order.total_paise)}</p></div></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Palette size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Paid order specification</h2></div><div className="mt-5 space-y-4">{items.map((item) => { const colour = record(item.colour_snapshot); const sizes = record(item.size_breakdown); const product = record(item.product_snapshot); const decoration = record(item.decoration_snapshot); return <article key={item.id} className="rounded-[4px] border border-black/7 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">Line {item.line_number}: {item.product_name}</h3><p className="mt-1 text-sm text-black/50">{String(colour.name ?? colour.label ?? "Colour to review")} · {item.quantity.toLocaleString("en-IN")} units</p><p className="mt-1 text-xs text-black/40">{String(product.gsm ?? "")} {String(product.fit ?? "")} · {String(decoration.technique ?? decoration.frontTechnique ?? "Technique in configuration")}</p></div><span className="text-sm font-semibold">{formatMoneyPaise(item.line_total_paise)}</span></div><div className="mt-4 flex gap-2 border-t border-black/7 pt-4"><Ruler size={15} className="text-[var(--color-accent)]" /><p className="text-xs text-black/55">{Object.entries(sizes).map(([size, quantity]) => `${size}: ${quantity}`).join(" · ")}</p></div></article>; })}</div></section>

          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><FileText size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Private files</h2></div><div className="mt-5 space-y-3">{files.length ? files.map((file) => <div key={file.id} className="rounded border border-black/7 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{file.safe_filename ?? file.original_filename}</p><p className="mt-1 text-xs capitalize text-black/45">{file.kind.replaceAll("_", " ")} · {file.content_type} · review {file.review_status}</p></div><PrivateFileDownloadButton fileId={file.id} /></div>{file.kind === "customer_artwork" && file.review_status !== "approved" ? <div className="mt-3 border-t border-black/10 pt-3"><ArtworkReviewForm fileId={file.id} /></div> : null}</div>) : <p className="text-sm text-black/45">No files attached.</p>}</div></section>

          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Order timeline</h2></div><div className="mt-5 space-y-4">{history.map((entry) => <div key={entry.id} className="border-l border-black/10 pl-4"><p className="text-sm font-semibold">{ORDER_STATUS_LABELS[entry.to_status as OrderStatus] ?? entry.to_status}</p><p className="mt-1 text-xs text-black/50">{entry.customer_message ?? publicOrderStatusLabel(entry.public_status)}</p>{entry.internal_note ? <p className="mt-1 text-xs text-amber-800">Internal: {entry.internal_note}</p> : null}{entry.reason ? <p className="mt-1 text-xs text-black/45">Reason: {entry.reason}</p> : null}<p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(entry.created_at)} · {entry.actor_type}</p></div>)}</div></section>
        </div>

        <div className="space-y-5">
          <section className="techpack-surface rounded-[4px] border p-6"><h2 className="font-semibold">Change order status</h2><div className="mt-5"><StatusTransitionForm orderId={order.id} orderNumber={order.order_number} currentStatus={order.status} nextStatuses={nextStatuses} /></div></section>
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Cancellation control</h2></div><div className="mt-4">{pendingCancellation ? <div className="space-y-3"><div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Cancellation awaiting Founder</p><p className="mt-1">{pendingCancellation.reason}</p></div>{context.role === "founder" ? <CancellationDecisionForm requestId={pendingCancellation.id} orderNumber={order.order_number} /> : <p className="text-xs text-black/45">Founder must approve or reject this request.</p>}</div> : !["cancelled", "refund_pending", "refunded", "delivered"].includes(order.status) ? <CancellationRequestForm orderId={order.id} orderNumber={order.order_number} /> : <p className="text-sm text-black/45">No cancellation action is available at this stage.</p>}</div></section>
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Wrench size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Edit permitted details</h2></div><div className="mt-4">{["dispatched", "delivered"].includes(order.status) && !order.configuration_reopened_at ? context.role === "founder" ? <ReopenConfigurationForm orderId={order.id} orderNumber={order.order_number} /> : <p className="text-sm text-black/45">Founder must explicitly reopen this dispatched configuration.</p> : <ConfigurationRevisionForm orderId={order.id} orderNumber={order.order_number} configuration={order.configuration_snapshot} />}</div>{revisions.length ? <p className="mt-3 text-xs text-black/45">Latest revision #{revisions[0].revision_number}: {revisions[0].reason}</p> : null}</section>
          {context.role === "founder" && ["cancelled", "refund_pending"].includes(order.status) ? <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><ReceiptIndianRupee size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Refund control</h2></div><div className="mt-4"><RefundForm orderId={order.id} orderNumber={order.order_number} status={order.status as "cancelled" | "refund_pending"} /></div></section> : null}
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Truck size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Shipping payment</h2></div><div className="mt-3 rounded bg-[var(--color-cream-soft)] p-3 text-xs text-black/55"><p>Status: <strong className="capitalize">{String(order.shipping_payment_status).replaceAll("_", " ")}</strong></p>{order.shipping_charge_paise != null ? <p className="mt-1">Charge: {formatMoneyPaise(order.shipping_charge_paise)}</p> : null}<p className="mt-2 text-black/45">Customers open PayU from their authenticated order page. No external URL is stored.</p></div><div className="mt-4"><ShippingPaymentForm orderId={order.id} orderNumber={order.order_number} founder={context.role === "founder"} /></div></section>
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><UserRound size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Customer</h2></div><div className="mt-4 text-sm text-black/55"><p className="font-semibold text-black/75">{customerName}</p><p className="mt-1">{stringValue(customer, "email")}</p><p className="mt-1">{stringValue(customer, "phone")}</p>{stringValue(business, "gstin", "GSTIN") ? <p className="mt-3">GSTIN {stringValue(business, "gstin", "GSTIN")}</p> : null}</div></section>
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><ReceiptIndianRupee size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Payment & invoice</h2></div><div className="mt-4 space-y-2 text-sm">{payments.map((payment) => <div key={payment.payment_attempt_id} className="rounded border border-black/7 p-3"><p className="font-semibold capitalize">{String(payment.purpose).replaceAll("_", " ")} · {payment.status}</p><p className="text-xs text-black/45">{formatMoneyPaise(payment.amount_paise)} · {context.role === "founder" ? payment.provider_payment_id || payment.provider_merchant_txn_id || "Awaiting provider reference" : "Provider reference restricted"}</p></div>)}</div>{invoiceResult.data ? <div className="mt-4 border-t border-black/10 pt-4"><p className="font-semibold">{invoiceResult.data.invoice_number ?? `Invoice ${invoiceResult.data.status}`}</p><p className="mt-1 text-sm text-black/50">{formatMoneyPaise(invoiceResult.data.total_paise)}</p>{invoiceResult.data.pdf_file_id ? <div className="mt-3"><PrivateFileDownloadButton fileId={invoiceResult.data.pdf_file_id} label="Download invoice" /></div> : null}</div> : null}</section>
          <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><MapPin size={18} className="text-[var(--color-accent)]" /><h2 className="font-semibold">Delivery address</h2></div><div className="mt-4 text-sm leading-relaxed text-black/55"><p className="font-semibold text-black/75">{stringValue(shipping, "recipientName", "name") || customerName}</p><p className="mt-2">{stringValue(address, "line1", "addressLine1")}</p>{stringValue(address, "line2", "addressLine2") ? <p>{stringValue(address, "line2", "addressLine2")}</p> : null}<p>{stringValue(address, "city")}, {stringValue(address, "state")} {stringValue(address, "postalCode", "pincode")}</p></div></section>
        </div>
      </div>
    </div>
  );
}
