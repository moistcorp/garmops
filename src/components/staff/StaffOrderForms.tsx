"use client";

import { useActionState } from "react";

import {
  addOrderCommentAction,
  assignOrderAction,
  changeOrderFileVisibilityAction,
  resolveOrderActionRequestAction,
  setOrderDatesAction,
  setOrderPriorityAction,
  transitionOrderAction,
} from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
import type { AssignableStaff } from "@/lib/staff/dal";
import {
  ORDER_STATUS_LABELS,
  PUBLIC_STATUS_BY_INTERNAL,
  type OrderStatus,
} from "@/lib/staff/statuses";

const inputClass =
  "w-full rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1D49B4]";
const buttonClass =
  "inline-flex items-center justify-center rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1D49B4] disabled:cursor-wait disabled:opacity-50";

function Message({ state }: { state: typeof INITIAL_STAFF_ACTION_STATE }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      key={state.resetToken}
      className={`mt-3 text-xs leading-relaxed ${
        state.status === "error" ? "text-red-700" : "text-emerald-700"
      }`}
      role="status"
    >
      {state.message}
    </p>
  );
}

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
    return <p className="text-xs text-black/45">No further transitions are available from this state.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
          Current state
        </label>
        <p className="mt-1 text-sm font-semibold">{ORDER_STATUS_LABELS[currentStatus]}</p>
      </div>
      <label className="block text-xs font-medium text-black/60">
        Next state
        <select name="toStatus" className={`${inputClass} mt-1`} required>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]} · customer sees {PUBLIC_STATUS_BY_INTERNAL[status].replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-black/60">
        Customer message
        <textarea
          name="customerMessage"
          rows={3}
          className={`${inputClass} mt-1 resize-y`}
          placeholder="Optional. This is visible in the customer timeline and creates a portal notification."
        />
      </label>
      <label className="block text-xs font-medium text-black/60">
        Internal note
        <textarea
          name="internalNote"
          rows={2}
          className={`${inputClass} mt-1 resize-y`}
          placeholder="Optional. Staff only."
        />
      </label>
      <label className="block text-xs font-medium text-black/60">
        Reason
        <input
          name="reason"
          className={`${inputClass} mt-1`}
          placeholder="Required for cancellation; include the operational reason."
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Updating…" : "Update status"}
      </button>
      <p className="text-[10px] leading-relaxed text-black/35">
        Only valid next states are shown. Payment, approval, shipment and role guards are checked again by PostgreSQL.
      </p>
      <Message state={state} />
    </form>
  );
}

export function AssignmentForm({
  orderId,
  orderNumber,
  currentAssignee,
  currentTeam,
  assignees,
}: {
  orderId: string;
  orderNumber: string;
  currentAssignee: string | null;
  currentTeam: string | null;
  assignees: AssignableStaff[];
}) {
  const [state, action, pending] = useActionState(
    assignOrderAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <label className="block text-xs font-medium text-black/60">
        Primary owner
        <select
          name="assignedStaffUserId"
          defaultValue={currentAssignee ?? ""}
          className={`${inputClass} mt-1`}
        >
          <option value="">Unassigned</option>
          {assignees.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name} · {member.role.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-black/60">
        Team
        <input
          name="assignedTeam"
          defaultValue={currentTeam ?? ""}
          className={`${inputClass} mt-1`}
          placeholder="Operations, artwork, production…"
        />
      </label>
      <label className="block text-xs font-medium text-black/60">
        Reassignment reason
        <input
          name="reason"
          className={`${inputClass} mt-1`}
          placeholder="Required when moving a high/urgent order."
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save assignment"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function PriorityForm({
  orderId,
  orderNumber,
  priority,
}: {
  orderId: string;
  orderNumber: string;
  priority: string;
}) {
  const [state, action, pending] = useActionState(
    setOrderPriorityAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <label className="block text-xs font-medium text-black/60">
        Priority
        <select name="priority" defaultValue={priority} className={`${inputClass} mt-1`}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-black/60">
        Reason
        <input
          name="reason"
          className={`${inputClass} mt-1`}
          placeholder="Required for high or urgent."
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save priority"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ExpectedDatesForm({
  orderId,
  orderNumber,
  values,
}: {
  orderId: string;
  orderNumber: string;
  values: {
    expectedApprovalAt: string;
    expectedProductionAt: string;
    expectedQcAt: string;
    estimatedDispatchAt: string;
  };
}) {
  const [state, action, pending] = useActionState(
    setOrderDatesAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {[
        ["expectedApprovalAt", "Approval expected", values.expectedApprovalAt],
        ["expectedProductionAt", "Production expected", values.expectedProductionAt],
        ["expectedQcAt", "QC expected", values.expectedQcAt],
        ["estimatedDispatchAt", "Dispatch expected", values.estimatedDispatchAt],
      ].map(([name, label, value]) => (
        <label key={name} className="block text-xs font-medium text-black/60">
          {label}
          <input
            type="datetime-local"
            name={name}
            defaultValue={value}
            className={`${inputClass} mt-1`}
          />
        </label>
      ))}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save expected dates"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function OrderCommentComposer({
  orderId,
  orderNumber,
  visibility,
}: {
  orderId: string;
  orderNumber: string;
  visibility: "customer" | "staff_only";
}) {
  const [state, action, pending] = useActionState(
    addOrderCommentAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  const customer = visibility === "customer";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="visibility" value={visibility} />
      <textarea
        name="body"
        rows={4}
        className={`${inputClass} resize-y`}
        placeholder={
          customer
            ? "Write exactly what the customer should see."
            : "Add an internal operational note. This will never be shown to the customer."
        }
        required
      />
      {customer ? (
        <>
          <label className="flex items-center gap-2 text-xs font-medium text-black/60">
            <input type="checkbox" name="actionRequired" />
            Customer action is required
          </label>
          <label className="block text-xs font-medium text-black/60">
            Action type
            <select name="actionType" className={`${inputClass} mt-1`} defaultValue="">
              <option value="">General response</option>
              <option value="upload_artwork">Upload artwork</option>
              <option value="replace_artwork">Replace artwork</option>
              <option value="provide_purchase_order">Provide purchase order</option>
              <option value="confirm_sizes">Confirm sizes</option>
              <option value="approve_artwork">Approve artwork</option>
              <option value="approve_quote">Approve quote</option>
              <option value="update_address">Update address</option>
              <option value="pay_balance">Pay balance</option>
              <option value="other">Other</option>
            </select>
          </label>
          <p className="text-[10px] leading-relaxed text-black/35">
            Customer-visible updates create a portal notification. Preview the message before publishing.
          </p>
        </>
      ) : (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Staff only — not visible to customers
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : customer ? "Publish customer update" : "Add internal note"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ResolveActionForm({
  commentId,
  orderNumber,
}: {
  commentId: string;
  orderNumber: string;
}) {
  const [state, action, pending] = useActionState(
    resolveOrderActionRequestAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input
        name="resolutionNote"
        className={inputClass}
        placeholder="Optional internal resolution note"
      />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Resolving…" : "Resolve"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function FileVisibilityForm({
  fileId,
  orderNumber,
  visibility,
  canShare,
}: {
  fileId: string;
  orderNumber: string;
  visibility: "customer" | "staff_only" | "public";
  canShare: boolean;
}) {
  const [state, action, pending] = useActionState(
    changeOrderFileVisibilityAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
      <input type="hidden" name="fileId" value={fileId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <select
        name="visibility"
        defaultValue={visibility === "public" ? "staff_only" : visibility}
        className={inputClass}
      >
        <option value="staff_only">Staff only</option>
        <option value="customer" disabled={!canShare}>
          Customer visible
        </option>
      </select>
      <input name="reason" className={inputClass} placeholder="Reason for visibility change" required />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Change"}
      </button>
      <div className="sm:col-span-3"><Message state={state} /></div>
    </form>
  );
}
