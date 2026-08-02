import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList } from "lucide-react";

import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatOrderCode, formatOrderTimestamp } from "@/lib/orders/format";
import { ORDER_STATUS_LABELS } from "@/lib/staff/statuses";

export default async function StaffOrderQueue() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, public_status, order_type, submitted_at, updated_at, organizations(display_name), order_items(quantity)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="techpack-notice p-6" data-tone="error">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#A62D2D]">
          Queue / Unavailable
        </p>
        <h1 className="mt-2 text-xl font-semibold">Order queue unavailable</h1>
        <p className="mt-2 text-sm text-black/50">
          The order queue could not be loaded.
        </p>
      </div>
    );
  }

  const rows = orders ?? [];
  return (
    <div className="space-y-5">
      <TechpackPageHeader
        eyebrow="Staff operations"
        reference="Live order register"
        title="Order queue"
        description="Review customer specifications and advance orders through their permitted production states."
        actions={<span className="techpack-stamp" data-tone="accent">{rows.length.toLocaleString("en-IN")} records</span>}
      />

      <section className="techpack-surface overflow-hidden rounded-[4px] border">
        <div className="hidden grid-cols-[1.1fr_1fr_0.55fr_auto] gap-3 border-b border-[var(--color-rule)] bg-[var(--color-cream-soft)] px-5 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]/40 sm:grid">
          <span>Order / Customer</span>
          <span>Production state</span>
          <span>Units</span>
          <span>Last update</span>
        </div>
        <div className="divide-y divide-[var(--color-rule)]">
          {rows.length ? (
            rows.map((order) => {
              const organization = Array.isArray(order.organizations)
                ? order.organizations[0]
                : order.organizations;
              const quantity = (order.order_items ?? []).reduce(
                (total, item) => total + item.quantity,
                0,
              );
              return (
                <Link
                  key={order.id}
                  href={`/staff/orders/${order.order_number}`}
                  className="group grid gap-3 px-5 py-5 transition-colors hover:bg-[var(--color-cream-soft)] sm:grid-cols-[1.1fr_1fr_0.55fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">{formatOrderCode(order.order_number)}</p>
                    <p className="mt-1 text-xs text-black/45">
                      {organization?.display_name ?? "Customer"}
                    </p>
                  </div>
                  <div>
                    <span className="techpack-stamp" data-tone="accent">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <p className="mt-1.5 text-[10px] capitalize text-black/40">
                      {order.order_type.replaceAll("_", " ")}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-black/55">
                    {quantity.toLocaleString("en-IN")}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-black/40">
                    <CalendarDays size={13} aria-hidden="true" />
                    {formatOrderTimestamp(order.updated_at)}
                    <ArrowRight
                      size={16}
                      className="text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="px-5 py-16 text-center">
              <ClipboardList className="mx-auto text-[var(--color-accent)]" size={28} aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold">No orders yet</p>
              <p className="mt-1 text-xs text-black/40">New durable orders will enter this register.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
