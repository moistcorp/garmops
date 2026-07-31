import { ShieldCheck } from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import { formatOrderTimestamp } from "@/lib/orders/format";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffAudit({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireStaffPermission("view_audit");
  const action = one(searchParams.action)?.trim() ?? "";
  const orderNumber = one(searchParams.order)?.trim() ?? "";
  const actor = one(searchParams.actor)?.trim() ?? "";
  const from = one(searchParams.from) ?? "";
  const to = one(searchParams.to) ?? "";
  let query = supabase.from("audit_logs").select("id, actor_user_id, actor_type, action, target_type, target_id, organization_id, order_id, before_state, after_state, request_id, created_at, profiles(first_name, last_name), orders(order_number)").order("created_at", { ascending: false }).limit(200);
  if (action) query = query.ilike("action", `%${action}%`);
  if (actor) query = query.eq("actor_user_id", actor);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  const { data, error } = await query;
  const filtered = orderNumber ? (data ?? []).filter((entry) => { const order = entry.orders as unknown as { order_number: string } | null; return order?.order_number.toLowerCase().includes(orderNumber.toLowerCase()); }) : (data ?? []);

  return <div className="space-y-5"><section className="liquid-glass-surface rounded-3xl border p-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#4F8B92]" /><h1 className="text-xl font-semibold">Privileged audit log</h1></div><p className="mt-2 text-sm text-black/45">Sensitive provider payloads and unnecessary personal data are not displayed here.</p><form method="get" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input name="action" defaultValue={action} className="rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm" placeholder="Action contains…" /><input name="order" defaultValue={orderNumber} className="rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm" placeholder="Order number" /><input name="actor" defaultValue={actor} className="rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm" placeholder="Actor user UUID" /><div className="grid grid-cols-2 gap-2"><input type="date" name="from" defaultValue={from} className="rounded-xl border border-black/10 bg-white/75 px-2 py-2 text-xs" /><input type="date" name="to" defaultValue={to} className="rounded-xl border border-black/10 bg-white/75 px-2 py-2 text-xs" /></div><button className="rounded-full bg-[#16212B] px-4 py-2 text-xs font-semibold text-white xl:col-span-4 xl:justify-self-start">Apply filters</button></form></section><section className="liquid-glass-surface rounded-3xl border p-6">{error ? <p className="text-sm text-red-700">Audit records could not be loaded.</p> : <div className="space-y-3">{filtered.length ? filtered.map((entry) => { const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles; const order = entry.orders as unknown as { order_number: string } | null; return <article key={entry.id} className="rounded-2xl border border-black/8 bg-white/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{entry.action}</p><p className="mt-1 text-xs text-black/45">{entry.actor_type} · {profile ? `${profile.first_name} ${profile.last_name}` : entry.actor_user_id ?? "System"}{order ? ` · ${order.order_number}` : ""}</p></div><p className="text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(entry.created_at)}</p></div><details className="mt-3 text-xs text-black/50"><summary className="cursor-pointer font-semibold">State summary</summary><pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-black/[0.03] p-3 text-[10px] leading-relaxed">{JSON.stringify({ before: entry.before_state, after: entry.after_state, requestId: entry.request_id }, null, 2)}</pre></details></article>; }) : <p className="py-10 text-center text-sm text-black/40">No audit records match these filters.</p>}</div>}</section></div>;
}
