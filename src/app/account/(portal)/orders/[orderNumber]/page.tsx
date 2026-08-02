import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, Package, Palette, ReceiptIndianRupee, Ruler } from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { getCustomerOrder } from "@/lib/orders/dal";
import { customerProductionTimeline } from "@/lib/orders/productionTimeline";
import { formatOrderCode, formatMoneyPaise, formatOrderDate, formatOrderTimestamp, publicOrderStatusLabel } from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";

export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const number = orderNumberSchema.safeParse((await params).orderNumber);
  if (!number.success) notFound();
  const { supabase, membership, user } = await requireOrganizationMember(`/account/orders/${number.data}`);
  const result = await getCustomerOrder(supabase, membership.organization_id, user.id, number.data).catch(() => null);
  if (!result) return <PortalPlaceholder title="Order unavailable" description="The order details could not be loaded. Try again shortly." />;
  if (result.order.error || !result.order.data) notFound();
  if (result.items.error || result.history.error) return <PortalPlaceholder title="Order unavailable" description="The order details could not be loaded." />;

  const order = result.order.data;
  const items = result.items.data ?? [];
  const history = result.history.data ?? [];
  const payments = result.payments;
  const latestHistory = history.at(-1);
  const sampleOrder = order.order_type === "sample_purchase";
  const timeline = customerProductionTimeline(order.status, history.map((entry) => entry.to_status));
  const shipping = record(order.shipping_snapshot);
  const address = record(shipping.address);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("document_number, total_paise, pdf_file_id")
    .eq("order_id", order.id)
    .not("pdf_file_id", "is", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return <div className="space-y-6">
    <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm font-medium text-black/50 hover:text-[var(--color-accent)]"><ArrowLeft size={15} />Back to my orders</Link>
    <section className="techpack-surface rounded-[4px] border p-6 sm:p-8">
      <span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(order.public_status)}</span>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{formatOrderCode(order.order_number)}</h2>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-black/50"><span className="inline-flex items-center gap-2"><CalendarDays size={15} />{formatOrderDate(order.submitted_at)}</span><span className="inline-flex items-center gap-2"><ReceiptIndianRupee size={15} />Estimated {formatMoneyPaise(order.estimated_total_paise)}</span></div>
    </section>
    <section className="techpack-panel rounded-[4px] border border-[var(--color-accent)]/20 p-5 sm:p-6"><div className="flex items-start gap-3"><Clock3 size={19} className="mt-0.5 shrink-0 text-[var(--color-accent)]" /><div><p className="text-[10px] uppercase tracking-widest text-black/35">Current stage</p><h3 className="mt-1 text-lg font-semibold">{publicOrderStatusLabel(order.public_status)}</h3><p className="mt-2 text-sm leading-relaxed text-black/50">{latestHistory?.customer_message ?? "Your order is recorded. Updates will appear here as it progresses."}</p>{latestHistory ? <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">Updated {formatOrderTimestamp(latestHistory.created_at)}</p> : null}</div></div>
      {!sampleOrder ? <div className="mt-6 border-t border-black/8 pt-6"><h4 className="text-sm font-semibold">Production timeline</h4><ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{timeline.map((stage, index) => <li key={stage.label} className={`rounded-[4px] border p-3 ${stage.state === "current" ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8" : stage.state === "completed" ? "border-[var(--color-accent)]/20 bg-white" : "border-black/7 bg-white/50"}`}><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold">{stage.state === "completed" ? <Check size={13} /> : index + 1}</span><span className="text-[10px] font-semibold uppercase tracking-wider">{stage.state === "completed" ? "Complete" : stage.state === "current" ? "In progress" : "Upcoming"}</span></div><p className="mt-3 text-sm font-semibold leading-snug">{stage.label}</p></li>)}</ol></div> : null}
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Palette size={18} className="text-[var(--color-accent)]" /><h3 className="font-semibold">Order items</h3></div><div className="mt-5 space-y-4">{items.map((item) => { const colour = record(item.colour_snapshot); const sizes = record(item.size_breakdown); return <article key={item.id} className="rounded-[4px] border border-black/7 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{item.product_name}</h4><p className="mt-1 text-sm text-black/50">{sampleOrder ? `${String(record(item.product_snapshot).gsm ?? "Catalogue")} GSM sample` : String(colour.name ?? "Colour to review")} · {item.quantity.toLocaleString("en-IN")} units</p></div>{item.line_total_paise !== null ? <span className="text-sm font-semibold">{formatMoneyPaise(item.line_total_paise)}</span> : null}</div><div className="mt-4 flex items-start gap-2 border-t border-black/7 pt-4"><Ruler size={15} className="mt-0.5 text-[var(--color-accent)]" /><p className="text-xs leading-relaxed text-black/55">{Object.entries(sizes).map(([size, quantity]) => `${size}: ${quantity}`).join(" · ")}</p></div></article>; })}</div></section>
      <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--color-accent)]" /><h3 className="font-semibold">Order timeline</h3></div><div className="mt-5 space-y-4">{history.map((entry, index) => <div key={entry.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1 h-2.5 w-2.5 rounded-[4px] bg-[var(--color-accent)]" />{index < history.length - 1 ? <span className="mt-1 h-full w-px bg-black/10" /> : null}</div><div className="pb-4"><p className="text-sm font-semibold">{publicOrderStatusLabel(entry.public_status)}</p><p className="mt-1 text-xs leading-relaxed text-black/50">{entry.customer_message ?? "Order status updated."}</p><p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(entry.created_at)}</p></div></div>)}</div></section></div>
      <div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><ReceiptIndianRupee size={18} className="text-[var(--color-accent)]" /><h3 className="font-semibold">Payments</h3></div><div className="mt-5 space-y-3">{payments.map((payment) => <div key={payment.id} className="rounded-[4px] border border-black/7 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Payment {formatOrderDate(payment.created_at)}</p><span className="rounded-[4px] bg-black/5 px-2 py-1 text-[10px] font-semibold capitalize text-black/55">{payment.status}</span></div><p className="mt-2 text-sm text-black/50">{formatMoneyPaise(payment.amount_paise)} · {payment.purpose === "sample_full" ? "full sample payment" : "reservation"}</p></div>)}</div></section>
        {invoice?.pdf_file_id ? <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><ReceiptIndianRupee size={18} className="text-[var(--color-accent)]" /><h3 className="font-semibold">Invoice</h3></div><p className="mt-4 font-semibold">{invoice.document_number ?? "Invoice"}</p>{invoice.total_paise !== null ? <p className="mt-2 text-sm text-black/50">{formatMoneyPaise(invoice.total_paise)}</p> : null}<div className="mt-4"><InvoiceDownloadButton fileId={invoice.pdf_file_id} /></div></section> : null}
        <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><MapPin size={18} className="text-[var(--color-accent)]" /><h3 className="font-semibold">Delivery</h3></div><div className="mt-4 text-sm leading-relaxed text-black/55"><p className="font-semibold text-black/75">{String(shipping.recipientName ?? "Delivery contact")}</p><p className="mt-2">{String(address.line1 ?? "")}</p>{address.line2 ? <p>{String(address.line2)}</p> : null}<p>{String(address.city ?? "")}, {String(address.state ?? "")} {String(address.postalCode ?? "")}</p></div></section></div></div>
  </div>;
}
