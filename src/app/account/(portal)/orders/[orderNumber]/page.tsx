import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, Shirt, Truck } from "lucide-react";
import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import { requireCustomer } from "@/lib/auth/guards";
import { medusaRequest } from "@/lib/medusa/client";
import { formatMoneyPaise, formatOrderCode, formatOrderDate, publicOrderStatusLabel } from "@/lib/orders/format";

export const dynamic = "force-dynamic";
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  await requireCustomer(`/account/orders/${orderNumber}`);
  let result: { order: Record<string, unknown> };
  try { result = await medusaRequest(`/store/garmops/orders/${encodeURIComponent(orderNumber)}`, { actor: "customer" }) as { order: Record<string, unknown> }; } catch { notFound(); }
  const order = result!.order;
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const snapshots = Array.isArray(order.snapshots) ? order.snapshots as Array<Record<string, unknown>> : [];
  const shipping = record(order.shippingAddress);
  const invoice = record(order.invoice);
  return <div className="space-y-6"><Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-black/50"><ArrowLeft size={15}/>Back to orders</Link><section className="techpack-surface rounded border p-6"><span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(text(order.productionStatus))}</span><h1 className="mt-4 text-2xl font-semibold">{formatOrderCode(text(order.publicOrderNumber))}</h1><p className="mt-2 text-sm text-black/50">Payment confirmed {formatOrderDate(text(order.date))}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-black/40">Total</dt><dd className="font-semibold">{formatMoneyPaise(Number(order.totalPaise ?? 0))}</dd></div><div><dt className="text-black/40">Delivery</dt><dd>{text(order.requestedDeliveryDate) || "Not recorded"}</dd></div><div><dt className="text-black/40">Tracking</dt><dd>{text(record(order.tracking).number) || "Not dispatched"}</dd></div></dl></section><div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"><div className="space-y-5"><section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><Shirt size={18} className="text-(--color-accent)"/><h2 className="font-semibold">Configured products</h2></div><div className="mt-4 space-y-3">{items.map((item) => <div key={String(item.id)} className="rounded border border-black/8 p-4"><p className="font-semibold">{text(item.title) || text(item.product_title) || "Configured product"}</p><p className="mt-1 text-sm text-black/50">{Number(item.quantity ?? 0)} units · {formatMoneyPaise(Number(item.unit_price ?? 0) * Number(item.quantity ?? 0))}</p></div>)}</div></section><section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><FileText size={18} className="text-(--color-accent)"/><h2 className="font-semibold">Frozen configuration</h2></div><pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs text-black/60">{JSON.stringify(snapshots, null, 2)}</pre></section></div><div className="space-y-5"><section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><MapPin size={18} className="text-(--color-accent)"/><h2 className="font-semibold">Delivery</h2></div><p className="mt-3 text-sm">{text(shipping.address_1) || text(shipping.address1)}</p><p className="mt-1 text-sm text-black/60">{[text(shipping.city), text(shipping.province), text(shipping.postal_code)].filter(Boolean).join(", ")}</p></section><section className="techpack-surface rounded border p-6"><div className="flex items-center gap-2"><Truck size={18} className="text-(--color-accent)"/><h2 className="font-semibold">Production</h2></div><p className="mt-3 text-sm font-semibold">{publicOrderStatusLabel(text(order.productionStatus))}</p></section><section className="techpack-surface rounded border p-6"><h2 className="font-semibold">Invoice</h2>{invoice.id ? <div className="mt-3"><p className="text-sm">{text(invoice.invoiceNumber) || "Invoice"}</p><InvoiceDownloadButton invoiceId={text(invoice.id)}/></div> : <p className="mt-3 text-sm text-black/45">Invoice generation is pending.</p>}</section></div></div></div>;
}
