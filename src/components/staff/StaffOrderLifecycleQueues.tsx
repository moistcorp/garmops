import Link from "next/link";
import { ClipboardCheck, Truck } from "lucide-react";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatOrderCode, formatOrderTimestamp } from "@/lib/orders/format";

function approvalDisplayStatus(status: string, expiresAt: string | null) {
  if (["requested", "viewed"].includes(status) && expiresAt && new Date(expiresAt).getTime() <= Date.now()) return "expired";
  return status;
}

export async function StaffApprovalQueue() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Array<{ id: string; status: string; requested_from_email: string | null; expires_at: string | null; responded_at: string | null; created_at: string; order_number: string; organization_name: string }> | null; error: { message: string } | null }>)("staff_approval_queue", { p_limit: 200 });
  if (error) return <p className="text-sm text-red-700">Approval queue could not be loaded.</p>;
  return <div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#1D49B4]" /><h1 className="text-xl font-semibold">Approval queue</h1></div><p className="mt-2 text-sm text-black/50">Track immutable artwork approvals, expiries, change requests, and completed evidence.</p></section><div className="space-y-3">{data?.map((approval) => <article key={approval.id} className="techpack-panel rounded-[4px] border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{formatOrderCode(approval.order_number)}</p><p className="mt-1 text-xs text-black/45">{approval.organization_name} · {approval.requested_from_email ?? "Company approver"}</p><p className="mt-2 text-xs capitalize text-black/55">{approvalDisplayStatus(approval.status, approval.expires_at).replaceAll("_"," ")} · requested {formatOrderTimestamp(approval.created_at)}</p>{approval.expires_at ? <p className="mt-1 text-[10px] text-black/35">Expires {formatOrderTimestamp(approval.expires_at)}</p> : null}</div><Link href={`/staff/orders/${approval.order_number}`} className="rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white">Open order</Link></div></article>)}{!data?.length ? <p className="py-10 text-center text-sm text-black/40">No approval requests yet.</p> : null}</div></div>;
}

export async function StaffShipmentQueue() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const { data, error } = await supabase.from("shipments").select("id,shipment_number,status,carrier,tracking_number,estimated_delivery_at,updated_at,orders!inner(order_number,organizations(display_name))").neq("status","cancelled").order("updated_at", { ascending:false }).limit(200);
  if (error) return <p className="text-sm text-red-700">Shipment queue could not be loaded.</p>;
  return <div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><Truck size={18} className="text-[#1D49B4]" /><h1 className="text-xl font-semibold">Shipment queue</h1></div><p className="mt-2 text-sm text-black/50">Monitor preparation, dispatch, in-transit, and delivered packages across customer orders.</p></section><div className="space-y-3">{data?.map((shipment) => { const order=shipment.orders as unknown as { order_number:string; organizations:{display_name:string}|null }; return <article key={shipment.id} className="techpack-panel rounded-[4px] border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{shipment.shipment_number} · {formatOrderCode(order.order_number)}</p><p className="mt-1 text-xs text-black/45">{order.organizations?.display_name ?? "Customer"}</p><p className="mt-2 text-xs capitalize text-black/55">{shipment.status.replaceAll("_"," ")} · {shipment.carrier ?? "carrier pending"} · {shipment.tracking_number ?? "tracking pending"}</p>{shipment.estimated_delivery_at ? <p className="mt-1 text-[10px] text-black/35">ETA {formatOrderTimestamp(shipment.estimated_delivery_at)}</p> : null}</div><Link href={`/staff/orders/${order.order_number}`} className="rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white">Open order</Link></div></article>; })}{!data?.length ? <p className="py-10 text-center text-sm text-black/40">No active shipments yet.</p> : null}</div></div>;
}
