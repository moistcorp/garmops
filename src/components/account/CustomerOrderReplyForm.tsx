"use client";

import { useActionState } from "react";

import { addCustomerOrderReplyAction } from "@/app/account/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

export default function CustomerOrderReplyForm({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [state, action, pending] = useActionState(
    addCustomerOrderReplyAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <textarea
        name="body"
        rows={3}
        required
        className="w-full resize-y rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[#4F8B92]"
        placeholder="Reply to the Garmops team or provide the requested information."
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#16212B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#315F66] disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reply"}
      </button>
      {state.message ? (
        <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
