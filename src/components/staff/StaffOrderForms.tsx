"use client";

import { useActionState } from "react";
import { transitionOrderAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
import { ORDER_STATUS_LABELS, PUBLIC_STATUS_BY_INTERNAL, type OrderStatus } from "@/lib/staff/statuses";

export function StatusTransitionForm({ orderId, orderNumber, currentStatus, nextStatuses }: { orderId: string; orderNumber: string; currentStatus: OrderStatus; nextStatuses: OrderStatus[] }) {
  const [state, action, pending] = useActionState(transitionOrderAction, INITIAL_STAFF_ACTION_STATE);
  if (!nextStatuses.length) return <p className="text-xs text-black/45">No further status changes are available.</p>;
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><p className="text-sm font-semibold">{ORDER_STATUS_LABELS[currentStatus]}</p><label className="block text-xs font-medium text-black/60">Next status<select name="toStatus" className="mt-1 w-full rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm" required>{nextStatuses.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]} · customer sees {PUBLIC_STATUS_BY_INTERNAL[status].replaceAll("_", " ")}</option>)}</select></label><label className="block text-xs font-medium text-black/60">Customer update<textarea name="customerMessage" rows={3} className="mt-1 w-full rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm" placeholder="Optional status update shown in the customer timeline." /></label><label className="block text-xs font-medium text-black/60">Reason<input name="reason" className="mt-1 w-full rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm" placeholder="Required when cancelling." /></label><button type="submit" disabled={pending} className="rounded-[4px] bg-[var(--color-navy)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Updating…" : "Update status"}</button>{state.status !== "idle" && state.message ? <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}</form>;
}
