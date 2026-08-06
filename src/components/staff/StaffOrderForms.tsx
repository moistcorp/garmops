"use client";

import { useActionState } from "react";
import {
  decideOrderCancellationAction,
  markShippingPaidAction,
  requestOrderCancellationAction,
  recordOrderRefundAction,
  reopenOrderConfigurationAction,
  setShippingPaymentLinkAction,
  transitionOrderAction,
  updateOrderConfigurationAction,
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

export function ConfigurationRevisionForm({ orderId, orderNumber, configuration }: { orderId: string; orderNumber: string; configuration: unknown }) {
  const [state, action, pending] = useActionState(updateOrderConfigurationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Configuration JSON<textarea name="configuration" defaultValue={JSON.stringify(configuration, null, 2)} rows={14} spellCheck={false} className="mt-1 w-full rounded border border-black/10 bg-[#fbfaf8] px-3 py-2 font-mono text-[11px]" /></label><label className="block text-xs font-semibold">Reason for change<textarea name="reason" required minLength={3} rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><p className="text-[11px] text-black/45">Garment type, quantity, and printing technique are immutable. A changed commercial specification requires cancellation and a new order.</p><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Saving…" : "Save revision"}</button><Result state={state} /></form>;
}

export function ShippingPaymentForm({ orderId, orderNumber, founder }: { orderId: string; orderNumber: string; founder: boolean }) {
  const [linkState, linkAction, linkPending] = useActionState(setShippingPaymentLinkAction, INITIAL_STAFF_ACTION_STATE);
  const [paidState, paidAction, paidPending] = useActionState(markShippingPaidAction, INITIAL_STAFF_ACTION_STATE);
  return (
    <div className="space-y-5">
      <form action={linkAction} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <label className="block text-xs font-semibold">
          Shipping amount (₹)
          <input name="amountRupees" type="number" min="1" step="0.01" required className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" />
        </label>
        <p className="text-[11px] leading-relaxed text-black/45">
          Garmops creates the PayU transaction internally. Staff cannot paste or redirect customers to an external payment URL.
        </p>
        <button disabled={linkPending} className="techpack-button w-full" type="submit">
          {linkPending ? "Creating…" : "Create secure PayU payment"}
        </button>
        <Result state={linkState} />
      </form>
      {founder ? (
        <form action={paidAction} className="space-y-3 border-t border-black/10 pt-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <label className="block text-xs font-semibold">
            Verified payment / bank reference
            <input name="reference" required minLength={3} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" />
          </label>
          <button disabled={paidPending} className="w-full rounded border border-black/10 px-3 py-2 text-xs font-semibold" type="submit">
            {paidPending ? "Recording…" : "Founder: mark shipping paid"}
          </button>
          <Result state={paidState} />
        </form>
      ) : null}
    </div>
  );
}


export function CancellationRequestForm({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(requestOrderCancellationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Cancellation reason<textarea name="reason" required minLength={3} rows={3} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" placeholder="Explain why the paid order must be cancelled and replaced." /></label><button disabled={pending} className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" type="submit">{pending ? "Submitting…" : "Request cancellation"}</button><Result state={state} /></form>;
}

export function CancellationDecisionForm({ requestId, orderNumber }: { requestId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(decideOrderCancellationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Founder decision<select name="decision" className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm"><option value="approve">Approve cancellation</option><option value="reject">Reject request</option></select></label><label className="block text-xs font-semibold">Decision note<textarea name="note" rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Saving…" : "Save Founder decision"}</button><Result state={state} /></form>;
}


export function ReopenConfigurationForm({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(reopenOrderConfigurationAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="block text-xs font-semibold">Founder reopen reason<textarea name="reason" required minLength={3} rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><button disabled={pending} className="w-full rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" type="submit">{pending ? "Reopening…" : "Reopen for one revision"}</button><Result state={state} /></form>;
}

export function RefundForm({ orderId, orderNumber, status }: { orderId: string; orderNumber: string; status: "cancelled" | "refund_pending" }) {
  const [state, action, pending] = useActionState(recordOrderRefundAction, INITIAL_STAFF_ACTION_STATE);
  const completing = status === "refund_pending";
  return <form action={action} className="space-y-3"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} /><input type="hidden" name="action" value={completing ? "complete" : "initiate"} /><label className="block text-xs font-semibold">PayU / bank refund reference<input name="reference" required minLength={3} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Reason / reconciliation note<textarea name="reason" required minLength={3} rows={2} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label><button disabled={pending} className="techpack-button w-full" type="submit">{pending ? "Saving…" : completing ? "Mark refund completed" : "Initiate refund"}</button><Result state={state} /></form>;
}
