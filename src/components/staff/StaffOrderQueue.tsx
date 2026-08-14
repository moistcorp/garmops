import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList } from "lucide-react";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireStaffPermission } from "@/lib/auth/guards";
import { medusaRequest } from "@/lib/medusa/client";
import { formatOrderCode, formatOrderTimestamp, publicOrderStatusLabel } from "@/lib/orders/format";

export default async function StaffOrderQueue() {
  await requireStaffPermission("view_all_orders");
  let rows: Array<Record<string, unknown>> = [];
  try { rows = ((await medusaRequest<{ orders: Array<Record<string, unknown>> }>("/foundry/orders", { actor: "staff" })).orders ?? []); } catch { return <div className="techpack-notice p-6" data-tone="error"><h1 className="text-xl font-semibold">Order queue unavailable</h1><p className="mt-2 text-sm text-black/50">The Medusa operations service could not be reached.</p></div>; }
  return <div className="space-y-5"><TechpackPageHeader eyebrow="Foundry" reference="Live order register" title="Order queue" description="Review paid orders and advance production through the backend-enforced workflow." actions={<span className="techpack-stamp" data-tone="accent">{rows.length} records</span>}/><section className="techpack-surface overflow-hidden rounded-sm border"><div className="divide-y divide-(--color-rule)">{rows.length ? rows.map((job) => { const id = String(job.id); const number = String(job.order_number ?? job.order_id); return <Link key={id} href={`/orders/${id}`} className="group grid gap-3 px-5 py-5 transition-colors hover:bg-(--color-cream-soft) sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center"><div><p className="font-semibold">{formatOrderCode(number)}</p><p className="mt-1 text-xs text-black/45">{String(job.order_type ?? "configured")} order</p></div><span className="techpack-stamp" data-tone="accent">{publicOrderStatusLabel(String(job.status ?? "pending"))}</span><div className="flex items-center gap-2 text-xs text-black/40"><CalendarDays size={13}/>{job.updated_at ? formatOrderTimestamp(String(job.updated_at)) : "Recently updated"}</div><ArrowRight size={16} className="text-(--color-accent)"/></Link>; }) : <div className="px-5 py-16 text-center"><ClipboardList className="mx-auto text-(--color-accent)" size={28}/><p className="mt-4 text-sm font-semibold">No paid orders yet</p></div>}</div></section></div>;
}
