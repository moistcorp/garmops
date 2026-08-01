"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createApprovalRequestAction,
  createShipmentAction,
  reviewEvidenceFileAction,
  revokeApprovalAction,
  updateShipmentAction,
} from "@/app/staff/order-lifecycle-actions";
import { createReorderAction, respondApprovalAction } from "@/app/account/order-lifecycle-actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

const input = "w-full rounded-[4px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#1D49B4]";
const button = "rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50";

function localDateTimeInputValue(iso: string) {
  const value = new Date(iso);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function Message({ state }: { state: typeof INITIAL_STAFF_ACTION_STATE }) {
  if (state.status === "idle" || !state.message) return null;
  return <p className={`mt-2 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</p>;
}

export function ApprovalRequestForm({ orderId, orderNumber, files, approvers, designVersions, defaultExpiresAt }: {
  orderId: string;
  orderNumber: string;
  files: Array<{ id: string; original_filename: string }>;
  approvers: Array<{ user_id: string; display_name: string; role: string }>;
  designVersions: Array<{ id: string; version_number: number; created_at: string }>;
  defaultExpiresAt: string;
}) {
  const [state, action, pending] = useActionState(createApprovalRequestAction, INITIAL_STAFF_ACTION_STATE);
  const expiryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expiryInputRef.current) {
      expiryInputRef.current.value = localDateTimeInputValue(defaultExpiresAt);
    }
  }, [defaultExpiresAt]);

  return <form action={action} className="space-y-3 rounded-[4px] border border-black/8 bg-white p-4">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} />
    <label className="block text-xs font-medium">Design version<select name="designVersionId" className={`${input} mt-1`} required><option value="">Select exact version</option>{designVersions.map((v) => <option key={v.id} value={v.id}>Version {v.version_number}</option>)}</select></label>
    <label className="block text-xs font-medium">Cleared immutable PDF<select name="approvalPdfFileId" className={`${input} mt-1`} required><option value="">Select approval PDF</option>{files.map((f) => <option key={f.id} value={f.id}>{f.original_filename}</option>)}</select></label>
    <label className="block text-xs font-medium">Recipient type<select name="recipientType" className={`${input} mt-1`} defaultValue="company"><option value="company">Company owner / approver</option><option value="external">External manager by secure email</option></select></label>
    <label className="block text-xs font-medium">Company approver<select name="requestedFromUserId" className={`${input} mt-1`} defaultValue=""><option value="">Select when using company approval</option>{approvers.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name} · {a.role}</option>)}</select></label>
    <label className="block text-xs font-medium">External approver email<input type="email" name="requestedFromEmail" className={`${input} mt-1`} placeholder="manager@company.com" /></label>
    <label className="block text-xs font-medium">Expires<input ref={expiryInputRef} type="datetime-local" name="expiresAtLocal" required className={`${input} mt-1`} onChange={(e) => { const hidden = e.currentTarget.form?.elements.namedItem("expiresAt") as HTMLInputElement | null; if (hidden && e.currentTarget.value) hidden.value = new Date(e.currentTarget.value).toISOString(); }} /></label>
    <input type="hidden" name="expiresAt" defaultValue={defaultExpiresAt} />
    <button className={button} disabled={pending || !files.length}>{pending ? "Creating…" : "Request approval"}</button>
    {!files.length ? <p className="text-xs text-amber-700">Upload, review, and make an approval PDF customer-visible first.</p> : null}<Message state={state} />
  </form>;
}

export function FileReviewForm({ fileId, orderNumber, kind }: { fileId: string; orderNumber: string; kind: string }) {
  const [state, action, pending] = useActionState(reviewEvidenceFileAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr_auto]">
    <input type="hidden" name="fileId" value={fileId} /><input type="hidden" name="orderNumber" value={orderNumber} /><input type="hidden" name="kind" value={kind} />
    <select name="scanStatus" className={input}><option value="clean">Clear</option><option value="rejected">Reject</option></select>
    <input name="reviewNote" className={input} placeholder="Record what was checked" required />
    <button className={button} disabled={pending}>{pending ? "Saving…" : "Review"}</button><div className="sm:col-span-3"><Message state={state} /></div>
  </form>;
}

export function RevokeApprovalForm({ approvalId, orderNumber }: { approvalId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(revokeApprovalAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="approvalId" value={approvalId} /><input type="hidden" name="orderNumber" value={orderNumber} /><input name="reason" className={input} placeholder="Revocation reason" required /><button className={button} disabled={pending}>Revoke</button><Message state={state} /></form>;
}

export function ShipmentCreateForm({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(createShipmentAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="orderNumber" value={orderNumber} />
    <label className="text-xs">Carrier<input name="carrier" className={`${input} mt-1`} /></label><label className="text-xs">Tracking number<input name="trackingNumber" className={`${input} mt-1`} /></label>
    <label className="text-xs sm:col-span-2">Tracking URL<input type="url" name="trackingUrl" className={`${input} mt-1`} placeholder="https://…" /></label>
    <label className="text-xs">Packages<input type="number" min="1" max="999" name="packageCount" className={`${input} mt-1`} /></label><label className="text-xs">Estimated delivery<input type="datetime-local" name="estimatedDeliveryAtLocal" className={`${input} mt-1`} onChange={(e) => { const hidden = e.currentTarget.form?.elements.namedItem("estimatedDeliveryAt") as HTMLInputElement | null; if (hidden) hidden.value = e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : ""; }} /></label><input type="hidden" name="estimatedDeliveryAt" />
    <label className="text-xs sm:col-span-2">Customer note<textarea name="customerVisibleNote" rows={2} className={`${input} mt-1`} /></label><div className="sm:col-span-2"><button className={button} disabled={pending}>{pending ? "Creating…" : "Create shipment"}</button><Message state={state} /></div>
  </form>;
}

export function ShipmentUpdateForm({ shipment, orderNumber }: { shipment: { id: string; status: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null; package_count: number | null; estimated_delivery_at: string | null; customer_visible_note: string | null }; orderNumber: string }) {
  const [state, action, pending] = useActionState(updateShipmentAction, INITIAL_STAFF_ACTION_STATE);
  const estimatedDeliveryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estimatedDeliveryInputRef.current && shipment.estimated_delivery_at) {
      estimatedDeliveryInputRef.current.value = localDateTimeInputValue(
        shipment.estimated_delivery_at,
      );
    }
  }, [shipment.estimated_delivery_at]);

  return <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="shipmentId" value={shipment.id} /><input type="hidden" name="orderNumber" value={orderNumber} />
    <label className="text-xs">Status<select name="status" defaultValue={shipment.status} className={`${input} mt-1`}><option value="preparing">Preparing</option><option value="dispatched">Dispatched</option><option value="in_transit">In transit</option><option value="out_for_delivery">Out for delivery</option><option value="exception">Delivery exception</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
    <label className="text-xs">Location<input name="eventLocation" className={`${input} mt-1`} /></label><label className="text-xs">Carrier<input name="carrier" defaultValue={shipment.carrier ?? ""} className={`${input} mt-1`} /></label><label className="text-xs">Tracking<input name="trackingNumber" defaultValue={shipment.tracking_number ?? ""} className={`${input} mt-1`} /></label>
    <label className="text-xs sm:col-span-2">Tracking URL<input type="url" name="trackingUrl" defaultValue={shipment.tracking_url ?? ""} className={`${input} mt-1`} /></label><label className="text-xs">Packages<input type="number" min="1" max="999" name="packageCount" defaultValue={shipment.package_count ?? ""} className={`${input} mt-1`} /></label><label className="text-xs">Estimated delivery<input ref={estimatedDeliveryInputRef} type="datetime-local" name="estimatedDeliveryAtLocal" className={`${input} mt-1`} onChange={(e) => { const h=e.currentTarget.form?.elements.namedItem("estimatedDeliveryAt") as HTMLInputElement|null; if(h)h.value=e.currentTarget.value?new Date(e.currentTarget.value).toISOString():""; }} /><input type="hidden" name="estimatedDeliveryAt" defaultValue={shipment.estimated_delivery_at ?? ""} /></label>
    <label className="text-xs sm:col-span-2">Customer update<textarea name="customerVisibleNote" defaultValue={shipment.customer_visible_note ?? ""} rows={2} className={`${input} mt-1`} /></label><label className="text-xs sm:col-span-2">Internal event note<textarea name="internalNote" rows={2} className={`${input} mt-1`} /></label><div className="sm:col-span-2"><button className={button} disabled={pending}>{pending ? "Saving…" : "Save shipment event"}</button><Message state={state} /></div>
  </form>;
}

export function CustomerApprovalForm({ approvalId, orderNumber }: { approvalId: string; orderNumber: string }) {
  const [state, action, pending] = useActionState(respondApprovalAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="space-y-3"><input type="hidden" name="approvalId" value={approvalId} /><input type="hidden" name="orderNumber" value={orderNumber} /><label className="text-xs">Decision<select name="decision" className={`${input} mt-1`}><option value="approved">Approve this exact version</option><option value="changes_requested">Request changes</option></select></label><label className="text-xs">Note<textarea name="responseNote" rows={3} className={`${input} mt-1`} /></label><button className={button} disabled={pending}>{pending ? "Recording…" : "Submit decision"}</button><Message state={state} /></form>;
}


export function ReorderForm({ orderNumber, idempotencyKey }: { orderNumber: string; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(
    createReorderAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="flex items-start gap-2 text-xs text-black/60">
        <input type="checkbox" name="acceptedTerms" required className="mt-0.5" />
        I understand current pricing and availability will be reviewed again and the old order will not be modified.
      </label>
      <button
        className="mt-4 rounded-[4px] bg-[#16212B] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Creating reorder…" : "Create new reorder"}
      </button>
      <Message state={state} />
    </form>
  );
}
