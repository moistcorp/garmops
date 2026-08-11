import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList } from "lucide-react";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import SystemRecoveryPanel from "@/components/staff/SystemRecoveryPanel";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderCode, formatOrderTimestamp } from "@/lib/orders/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/staff/statuses";

type QueueOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  public_status: string;
  order_type: string;
  order_source: string;
  customer_snapshot: Record<string, unknown>;
  total_paise: number;
  amount_paid_paise: number;
  updated_at: string;
  order_items: Array<{ quantity: number }> | null;
};

function text(snapshot: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = snapshot?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Customer";
}

export default async function StaffOrderQueue() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const result = await supabase
    .from("orders")
    .select("id, order_number, status, public_status, order_type, order_source, customer_snapshot, total_paise, amount_paid_paise, updated_at, order_items(quantity)")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (result.error) {
    return <div className="techpack-notice p-6" data-tone="error"><h1 className="text-xl font-semibold">Order queue unavailable</h1><p className="mt-2 text-sm text-black/50">{result.error.message}</p></div>;
  }

  const rows = (result.data ?? []) as unknown as QueueOrder[];
  return (
    <div className="space-y-5">
      <TechpackPageHeader eyebrow="Foundry" reference="Live order register" title="Order queue" description="Review paid orders, approve artwork, and advance production through the database-enforced workflow." actions={<span className="techpack-stamp" data-tone="accent">{rows.length.toLocaleString("en-IN")} records</span>} />
      <SystemRecoveryPanel />
      <section className="techpack-surface overflow-hidden rounded-sm border">
        <div className="hidden grid-cols-[1.25fr_1fr_0.55fr_0.7fr_auto] gap-3 border-b border-(--color-rule) bg-(--color-cream-soft) px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-black/40 sm:grid">
          <span>Order / customer</span><span>Production state</span><span>Units</span><span>Paid</span><span>Updated</span>
        </div>
        <div className="divide-y divide-(--color-rule)">
          {rows.length ? rows.map((order) => {
            const quantity = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
            const customer = text(order.customer_snapshot, "name", "contactName", "fullName", "email");
            return (
              <Link key={order.id} href={`/orders/${order.order_number}`} className="group grid gap-3 px-5 py-5 transition-colors hover:bg-(--color-cream-soft) sm:grid-cols-[1.25fr_1fr_0.55fr_0.7fr_auto] sm:items-center">
                <div><p className="font-semibold">{formatOrderCode(order.order_number)}</p><p className="mt-1 text-xs text-black/45">{customer}</p></div>
                <div><span className="techpack-stamp" data-tone="accent">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span><p className="mt-1.5 text-xs capitalize text-black/40">{order.order_source.replaceAll("_", " ")}</p></div>
                <p className="font-mono text-xs text-black/55">{quantity.toLocaleString("en-IN")}</p>
                <p className="text-xs font-semibold text-black/65">{formatMoneyPaise(order.amount_paid_paise)}<span className="block text-xs font-normal text-black/35">of {formatMoneyPaise(order.total_paise)}</span></p>
                <div className="flex items-center gap-3 text-xs text-black/40"><CalendarDays size={13} aria-hidden="true" />{formatOrderTimestamp(order.updated_at)}<ArrowRight size={16} className="text-(--color-accent) transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></div>
              </Link>
            );
          }) : <div className="px-5 py-16 text-center"><ClipboardList className="mx-auto text-(--color-accent)" size={28} aria-hidden="true" /><p className="mt-4 text-sm font-semibold">No paid orders yet</p><p className="mt-1 text-xs text-black/40">Verified customer and staff-created orders will enter this queue.</p></div>}
        </div>
      </section>
    </div>
  );
}
