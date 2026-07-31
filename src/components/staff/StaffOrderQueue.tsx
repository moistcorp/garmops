import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Filter, Search } from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import { formatOrderTimestamp } from "@/lib/orders/format";
import {
  listAssignableStaff,
  parseStaffQueueFilters,
  searchStaffOrders,
} from "@/lib/staff/dal";
import {
  ORDER_STATUS_LABELS,
  PUBLIC_STATUS_LABELS,
} from "@/lib/staff/statuses";

const selectClass =
  "rounded-[4px] border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#1D49B4]";

function paramsWith(
  current: Record<string, string | string[] | undefined>,
  changes: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const selected = Array.isArray(value) ? value[0] : value;
    if (selected) params.set(key, selected);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  return `/staff/orders?${params.toString()}`;
}

export default async function StaffOrderQueue({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const filters = parseStaffQueueFilters(searchParams);
  const [rows, staff] = await Promise.all([
    searchStaffOrders(supabase, filters),
    listAssignableStaff(supabase),
  ]);
  const total = rows[0]?.total_count ?? 0;
  const pageSize = 40;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <section className="techpack-surface rounded-[4px] border p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Filter size={17} className="text-[#1D49B4]" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Order work queue</h1>
        </div>
        <form method="get" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative md:col-span-2 xl:col-span-4">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-black/35" aria-hidden="true" />
            <input
              name="q"
              defaultValue={filters.query ?? ""}
              className="w-full rounded-[4px] border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#1D49B4]"
              placeholder="Order, company, email, PO, PayU, Zoho or tracking reference"
            />
          </label>
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">All internal states</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="publicStatus" defaultValue={filters.publicStatus ?? ""} className={selectClass}>
            <option value="">All customer states</option>
            {Object.entries(PUBLIC_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="orderType" defaultValue={filters.orderType ?? ""} className={selectClass}>
            <option value="">All order types</option>
            <option value="custom_bulk">Custom bulk</option>
            <option value="sample_purchase">Sample purchase</option>
            <option value="reorder">Reorder</option>
          </select>
          <select name="priority" defaultValue={filters.priority ?? ""} className={selectClass}>
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          <select name="assignee" defaultValue={filters.assignee ?? ""} className={selectClass}>
            <option value="">All assignees</option>
            {staff.map((member) => (
              <option key={member.user_id} value={member.user_id}>{member.display_name}</option>
            ))}
          </select>
          <input name="team" defaultValue={filters.team ?? ""} className={selectClass} placeholder="Team" />
          <select name="paymentState" defaultValue={filters.paymentState ?? ""} className={selectClass}>
            <option value="">All payment states</option>
            {['created','initiated','pending','paid','failed','cancelled','refunded','partially_refunded','disputed'].map((value) => (
              <option key={value} value={value}>{value.replaceAll('_',' ')}</option>
            ))}
          </select>
          <select name="invoiceState" defaultValue={filters.invoiceState ?? ""} className={selectClass}>
            <option value="">All invoice states</option>
            {['not_required','queued','processing','completed','retryable_failure','permanent_failure','voided'].map((value) => (
              <option key={value} value={value}>{value.replaceAll('_',' ')}</option>
            ))}
          </select>
          <select name="missing" defaultValue={filters.missing ?? ""} className={selectClass}>
            <option value="">No missing-data filter</option>
            <option value="artwork">Missing artwork</option>
            <option value="po">Missing PO</option>
            <option value="gstin">Missing GSTIN</option>
            <option value="approval">Missing approval</option>
          </select>
          <select name="shipmentState" defaultValue={filters.shipmentState ?? ""} className={selectClass}>
            <option value="">All shipment states</option>
            {['preparing','dispatched','in_transit','delivered','cancelled'].map((value) => (
              <option key={value} value={value}>{value.replaceAll('_',' ')}</option>
            ))}
          </select>
          <label className="text-[10px] uppercase tracking-wider text-black/40">
            Submitted from
            <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} className={`${selectClass} mt-1 w-full`} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-black/40">
            Submitted to
            <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} className={`${selectClass} mt-1 w-full`} />
          </label>
          <div className="flex flex-wrap items-center gap-4 md:col-span-2 xl:col-span-4">
            {[
              ["myOrders", "My orders", filters.myOrders],
              ["overdue", "Overdue", filters.overdue],
              ["atRisk", "At risk", filters.atRisk],
            ].map(([name, label, checked]) => (
              <label key={String(name)} className="flex items-center gap-2 text-xs font-medium text-black/60">
                <input type="checkbox" name={String(name)} value="true" defaultChecked={Boolean(checked)} />
                {String(label)}
              </label>
            ))}
            <button className="rounded-[4px] bg-[#16212B] px-5 py-2 text-xs font-semibold text-white" type="submit">
              Apply filters
            </button>
            <Link href="/staff/orders" className="text-xs font-semibold text-black/45 hover:underline">Reset</Link>
          </div>
        </form>
      </section>

      <section className="techpack-surface overflow-hidden rounded-[4px] border">
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <div>
            <h2 className="font-semibold">{total.toLocaleString("en-IN")} orders</h2>
            <p className="mt-1 text-xs text-black/40">Page {filters.page} of {pages}</p>
          </div>
        </div>
        <div className="divide-y divide-black/7">
          {rows.length ? rows.map((order) => (
            <Link
              key={order.order_id}
              href={`/staff/orders/${order.order_number}`}
              className="grid gap-4 px-5 py-5 transition hover:bg-white lg:grid-cols-[1.1fr_1fr_0.8fr_0.7fr_auto] lg:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{order.order_number}</p>
                  <span className={`rounded-[4px] px-2 py-0.5 text-[10px] font-semibold ${order.internal_priority === 'urgent' ? 'bg-red-100 text-red-700' : order.internal_priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-black/5 text-black/50'}`}>
                    {order.internal_priority}
                  </span>
                  {order.open_action_count > 0 ? <span className="rounded-[4px] bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{order.open_action_count} open action</span> : null}
                </div>
                <p className="mt-1 text-xs text-black/45">{order.organization_name} · {order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">{ORDER_STATUS_LABELS[order.status]}</p>
                <p className="mt-1 text-xs text-black/40">Customer: {PUBLIC_STATUS_LABELS[order.public_status]}</p>
              </div>
              <div>
                <p className="text-xs font-medium capitalize">{order.assignee_name ?? "Unassigned"}</p>
                <p className="mt-1 text-xs text-black/40">{order.assigned_team ?? "No team"}</p>
              </div>
              <div className="text-xs text-black/50">
                <p>{order.quantity_total.toLocaleString("en-IN")} units</p>
                <p className="mt-1 capitalize">Payment {order.payment_status ?? "unknown"}</p>
                <p className="mt-1 capitalize">Invoice {order.invoice_status?.replaceAll("_", " ") ?? "not created"}</p>
              </div>
              <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                <span className="inline-flex items-center gap-1 text-xs text-black/40"><CalendarDays size={13} /> {formatOrderTimestamp(order.updated_at)}</span>
                <ArrowRight size={16} className="text-[#1D49B4] lg:ml-auto lg:mt-2" aria-hidden="true" />
              </div>
            </Link>
          )) : (
            <p className="px-5 py-16 text-center text-sm text-black/40">No orders match these filters.</p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        {filters.page > 1 ? (
          <Link href={paramsWith(searchParams, { page: filters.page - 1 })} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D49B4]"><ArrowLeft size={15} /> Previous</Link>
        ) : <span />}
        {filters.page < pages ? (
          <Link href={paramsWith(searchParams, { page: filters.page + 1 })} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D49B4]">Next <ArrowRight size={15} /></Link>
        ) : null}
      </div>
    </div>
  );
}
