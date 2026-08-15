"use client";

import { useActionState } from "react";
import {
  decideOrderCancellationAction,
  requestRefundAction,
  requestOrderCancellationAction,
  setTrackingAction,
  transitionOrderAction,
} from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/staff/statuses";

function Result({ state }: { state: typeof INITIAL_STAFF_ACTION_STATE }) {
  if (state.status === "idle") return null;
  return <p className={`mt-3 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</p>;
}

export function StatusTransitionForm({ orderId, orderNumber, nextStatuses }: { orderId: string; orderNumber: string; currentStatus?: OrderStatus; nextStatuses: readonly OrderStatus[] }) {
  const [state, action, pending] = useActionState(transitionOrderAction, INITIAL_STAFF_ACTION_STATE);
  if (!nextStatuses.length) return <p className="text-sm text-black/45">No further status change is available.</p>;
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Next stage<select name="toStatus" required className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm">{nextStatuses.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select></label><label className="block text-xs font-semibold">Customer update<textarea name="customerMessage" rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" placeholder="Optional customer-visible update" /></label><label className="block text-xs font-semibold">Internal note<textarea name="internalNote" rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Reason<textarea name="reason" rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" placeholder="Required for holds, cancellations, and overrides" /></label><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Updating…" : "Advance order"}</button><Result state={state} /></form>;
}

export function CancellationRequestForm({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(requestOrderCancellationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Cancellation reason<textarea name="reason" required minLength={3} rows={3} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" placeholder="Explain why the paid order must be cancelled and replaced." /></label><button disabled={pending} className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" type="submit">{pending ? "Submitting…" : "Request cancellation"}</button><Result state={state} /></form>;
}

export function CancellationDecisionForm({ requestId, orderNumber }: { requestId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(decideOrderCancellationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Founder decision<select name="decision" className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm"><option value="approve">Approve cancellation</option><option value="reject">Reject request</option></select></label><label className="block text-xs font-semibold">Decision note<textarea name="note" rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Saving…" : "Save Founder decision"}</button><Result state={state} /></form>;
}

export function RefundForm({ paymentId, orderNumber }: { paymentId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(requestRefundAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="paymentId" value={paymentId} /><input type="hidden" name="orderNumber" value={orderNumber} /><p className="text-sm text-black/55">Request a full refund through the protected PayU boundary.</p><button disabled={pending} className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" type="submit">{pending ? "Requesting…" : "Request full refund"}</button><Result state={state} /></form>;
}

export function TrackingForm({ orderId, orderNumber, trackingNumber, trackingUrl }: { orderId: string; orderNumber: string; trackingNumber?: string; trackingUrl?: string }) {
  const [state, action, pending] = useActionState(setTrackingAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Tracking number<input name="trackingNumber" required defaultValue={trackingNumber ?? ""} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Tracking URL<input name="trackingUrl" type="url" defaultValue={trackingUrl ?? ""} placeholder="https://carrier.example/track/…" className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Saving…" : "Save tracking"}</button><Result state={state} /></form>;
}
