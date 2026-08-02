"use client";

import { useActionState } from "react";

import { transitionOrderAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
import {
  ORDER_STATUS_LABELS,
  PUBLIC_STATUS_BY_INTERNAL,
  type OrderStatus,
} from "@/lib/staff/statuses";

const fieldClass =
  "techpack-control mt-1 w-full rounded-[4px] border px-3 py-2 text-sm outline-none focus:!border-[var(--color-accent)]";

export function StatusTransitionForm({
  orderId,
  orderNumber,
  currentStatus,
  nextStatuses,
}: {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  nextStatuses: OrderStatus[];
}) {
  const [state, action, pending] = useActionState(
    transitionOrderAction,
    INITIAL_STAFF_ACTION_STATE,
  );

  if (!nextStatuses.length) {
    return (
      <div className="techpack-notice p-3 text-xs" data-tone="info">
        No further status changes are available.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-black/40">
          Current internal state
        </p>
        <span className="techpack-stamp mt-2" data-tone="accent">
          {ORDER_STATUS_LABELS[currentStatus]}
        </span>
      </div>
      <label className="block text-xs font-medium text-black/60">
        Next status
        <select name="toStatus" className={fieldClass} required>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]} · customer sees{" "}
              {PUBLIC_STATUS_BY_INTERNAL[status].replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-black/60">
        Customer update
        <textarea
          name="customerMessage"
          rows={3}
          className={fieldClass}
          placeholder="Optional status update shown in the customer timeline."
        />
      </label>
      <label className="block text-xs font-medium text-black/60">
        Reason
        <input
          name="reason"
          className={fieldClass}
          placeholder="Required when cancelling."
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[4px] bg-[var(--color-navy)] px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-white disabled:opacity-50"
      >
        {pending ? "Updating…" : "Record status update"}
      </button>
      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          data-tone={state.status === "error" ? "error" : "success"}
          className="techpack-notice p-3 text-xs"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
