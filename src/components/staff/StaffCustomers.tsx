import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Mail, MapPin, ReceiptIndianRupee, Users } from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderTimestamp,
} from "@/lib/orders/format";
import { ORDER_STATUS_LABELS } from "@/lib/staff/statuses";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function StaffCustomerList({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { supabase } = await requireStaffPermission("view_organizations");
  const query = one(searchParams.q)?.trim().slice(0, 100) ?? "";
  const safeQuery = query.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
  let request = supabase
    .from("organizations")
    .select("id, legal_name, display_name, industry, website, gstin, billing_email, phone, status, zoho_contact_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (safeQuery) {
    request = request.or(
      `display_name.ilike.%${safeQuery}%,legal_name.ilike.%${safeQuery}%,billing_email.ilike.%${safeQuery}%`,
    );
  }
  const { data, error } = await request;

  return (
    <div className="space-y-5">
      <section className="techpack-surface rounded-[4px] border p-6">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-[#1D49B4]" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Customer organisations</h1>
        </div>
        <form method="get" className="mt-5 flex gap-2">
          <input name="q" defaultValue={query} className="min-w-0 flex-1 rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#1D49B4]" placeholder="Company name or billing email" />
          <button className="rounded-[4px] bg-[#16212B] px-5 py-2 text-xs font-semibold text-white">Search</button>
        </form>
      </section>
      <section className="techpack-surface overflow-hidden rounded-[4px] border">
        {error ? <p className="p-8 text-sm text-red-700">Customer organisations could not be loaded.</p> : (
          <div className="divide-y divide-black/7">
            {data?.length ? data.map((organization) => (
              <Link key={organization.id} href={`/staff/customers/${organization.id}`} className="flex items-center justify-between gap-4 px-5 py-5 transition hover:bg-white">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{organization.display_name}</p>
                  <p className="mt-1 truncate text-xs text-black/45">{organization.legal_name} · {organization.billing_email ?? "No billing email"}</p>
                  <p className="mt-1 text-xs capitalize text-black/35">{organization.status} · {organization.industry ?? "Industry not set"}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-[#1D49B4]" aria-hidden="true" />
              </Link>
            )) : <p className="p-12 text-center text-sm text-black/40">No customer organisations found.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

export async function StaffCustomerDetail({ organizationId }: { organizationId: string }) {
  const { supabase } = await requireStaffPermission("view_organizations");
  const [organization, members, addresses, orders, invoices, actions] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supabase.from("organization_members").select("user_id, role, status, accepted_at, profiles(first_name, last_name, phone, job_title, department)").eq("organization_id", organizationId).order("created_at"),
    supabase.from("addresses").select("id, label, contact_name, phone, line1, line2, city, state, postal_code, gstin, is_default_billing, is_default_shipping").eq("organization_id", organizationId).order("created_at"),
    supabase.from("orders").select("id, order_number, status, public_status, internal_priority, estimated_total_paise, amount_paid_paise, submitted_at").eq("organization_id", organizationId).order("submitted_at", { ascending: false }).limit(100),
    supabase.from("invoices").select("id, sync_status, document_number, total_paise, paid_paise, balance_paise, orders!inner(organization_id)").eq("orders.organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("order_comments").select("id, order_id, body, action_type, created_at, orders!inner(organization_id, order_number)").eq("orders.organization_id", organizationId).eq("action_required", true).is("resolved_at", null).order("created_at", { ascending: false }),
  ]);
  if (!organization.data) notFound();
  const invoiceTotals = (invoices.data ?? []).reduce(
    (totals, invoice) => ({
      total: totals.total + (invoice.total_paise ?? 0),
      paid: totals.paid + (invoice.paid_paise ?? 0),
      balance: totals.balance + (invoice.balance_paise ?? 0),
    }),
    { total: 0, paid: 0, balance: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="techpack-surface rounded-[4px] border p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1D49B4]">Customer organisation</p>
            <h1 className="mt-3 text-2xl font-semibold">{organization.data.display_name}</h1>
            <p className="mt-2 text-sm text-black/50">{organization.data.legal_name}</p>
          </div>
          <span className="rounded-[4px] bg-black/5 px-3 py-1 text-xs font-semibold capitalize text-black/55">{organization.data.status}</span>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-black/55 sm:grid-cols-2 xl:grid-cols-4">
          <p className="inline-flex items-center gap-2"><Mail size={15} className="text-[#1D49B4]" /> {organization.data.billing_email ?? "No billing email"}</p>
          <p>{organization.data.phone ?? "No phone"}</p>
          <p>GSTIN: {organization.data.gstin ?? "Not set"}</p>
          <p>Zoho: {organization.data.zoho_contact_id ?? "Not linked"}</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Members", members.data?.length ?? 0, Users],
          ["Orders", orders.data?.length ?? 0, Building2],
          ["Invoiced", formatMoneyPaise(invoiceTotals.total), ReceiptIndianRupee],
          ["Open actions", actions.data?.length ?? 0, MapPin],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Users;
          return <div key={String(label)} className="techpack-panel rounded-[4px] border p-5"><MetricIcon size={17} className="text-[#1D49B4]" /><p className="mt-4 text-[10px] uppercase tracking-wider text-black/35">{String(label)}</p><p className="mt-2 text-xl font-semibold">{String(value)}</p></div>;
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="techpack-surface rounded-[4px] border p-6">
          <h2 className="font-semibold">Members</h2>
          <div className="mt-4 space-y-3">
            {members.data?.map((member) => {
              const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
              return <div key={member.user_id} className="rounded-[4px] border border-black/8 bg-white p-4"><p className="text-sm font-semibold">{profile?.first_name} {profile?.last_name}</p><p className="mt-1 text-xs capitalize text-black/45">{member.role} · {member.status}</p><p className="mt-1 text-xs text-black/35">{profile?.job_title ?? "Role not set"} · {profile?.department ?? "Department not set"}</p></div>;
            })}
          </div>
        </section>
        <section className="techpack-surface rounded-[4px] border p-6">
          <h2 className="font-semibold">Addresses</h2>
          <div className="mt-4 space-y-3">
            {addresses.data?.map((address) => <div key={address.id} className="rounded-[4px] border border-black/8 bg-white p-4 text-sm leading-relaxed text-black/55"><p className="font-semibold text-black/75">{address.label ?? address.contact_name ?? "Address"}</p><p className="mt-2">{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p><p>{address.city}, {address.state} {address.postal_code}</p><p className="mt-1 text-xs">{address.is_default_billing ? "Default billing" : ""}{address.is_default_billing && address.is_default_shipping ? " · " : ""}{address.is_default_shipping ? "Default shipping" : ""}</p></div>)}
          </div>
        </section>
      </div>

      <section className="techpack-surface rounded-[4px] border p-6">
        <h2 className="font-semibold">Orders</h2>
        <div className="mt-4 divide-y divide-black/7">
          {orders.data?.map((order) => <Link key={order.id} href={`/staff/orders/${order.order_number}`} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold">{formatOrderCode(order.order_number)}</p><p className="mt-1 text-xs text-black/45">{ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]} · {formatOrderTimestamp(order.submitted_at)}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatMoneyPaise(order.estimated_total_paise)}</p><p className="mt-1 text-xs capitalize text-black/40">{order.internal_priority}</p></div></Link>)}
        </div>
      </section>

          {actions.data?.length ? <section className="techpack-surface rounded-[4px] border p-6"><h2 className="font-semibold">Open action requests</h2><div className="mt-4 space-y-3">{actions.data.map((action) => { const order = action.orders as unknown as { order_number: string }; return <Link key={action.id} href={`/staff/orders/${order.order_number}`} className="block rounded-[4px] border border-blue-200 bg-blue-50/60 p-4"><p className="text-sm font-semibold">{formatOrderCode(order.order_number)} · {action.action_type?.replaceAll("_", " ") ?? "General"}</p><p className="mt-2 text-sm text-black/60">{action.body}</p><p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(action.created_at)}</p></Link>; })}</div></section> : null}
    </div>
  );
}
