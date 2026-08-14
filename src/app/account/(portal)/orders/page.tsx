import Link from "next/link";
import { ArrowRight, CalendarDays, ShoppingBag } from "lucide-react";
import PendingCheckoutRecovery from "@/components/payment/PendingCheckoutRecovery";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireCustomer } from "@/lib/auth/guards";
import { medusaRequest } from "@/lib/medusa/client";
import { formatMoneyPaise, formatOrderCode, formatOrderDate, publicOrderStatusLabel } from "@/lib/orders/format";

export const dynamic = "force-dynamic";
type OrderView = { id: string; publicOrderNumber: string; totalPaise: number; date: string; productionStatus: string; items?: Array<{ title?: string; product_title?: string; quantity?: number }> };

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string; payment?: string; checkoutAttempt?: string }> }) {
  await requireCustomer("/account/orders");
  const query = await searchParams;
  let orders: OrderView[] = [];
  try { orders = (await medusaRequest<{ orders: OrderView[] }>("/store/garmops/orders", { actor: "customer" })).orders ?? []; } catch { return <PortalPlaceholder title="Orders unavailable" description="Your private order history could not be loaded." />; }
  const payment = query.payment === "pending" || query.payment === "failure" ? query.payment : undefined;
  return <div className="space-y-6">
    <TechpackPageHeader eyebrow="Customer account" reference="Private order register" title="My orders" description="Only orders placed by this exact customer account are visible here." actions={<Link href="/configurator" className="inline-flex items-center gap-2 rounded bg-(--color-accent) px-4 py-2.5 text-sm font-semibold text-white"><ShoppingBag size={16}/>Start designing</Link>}/>
    {payment ? <PendingCheckoutRecovery outcome={payment} checkoutAttemptId={query.checkoutAttempt} retryHref="/checkout" retryLabel="Return to checkout"/> : null}
    {orders.length ? <div className="space-y-3">{orders.map((order) => <Link key={order.id} href={`/account/orders/${encodeURIComponent(order.publicOrderNumber)}`} className="group techpack-surface grid gap-5 rounded border p-5 transition hover:border-(--color-accent)/30 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{formatOrderCode(order.publicOrderNumber)}</h3><span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(order.productionStatus)}</span></div><p className="mt-2 text-sm text-black/50">{order.items?.[0]?.title || order.items?.[0]?.product_title || "Custom garment order"}</p></div><div><p className="text-xs text-black/40">Order total</p><p className="mt-1 font-semibold">{formatMoneyPaise(order.totalPaise)}</p></div><div className="flex items-center gap-2 text-sm text-black/50"><CalendarDays size={15}/>{formatOrderDate(order.date)} · {(order.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)} units</div><ArrowRight className="text-(--color-accent)" size={18}/></Link>)}</div> : <PortalPlaceholder title="No orders yet" description="Your first verified full-payment order will appear here."/>}
  </div>;
}
