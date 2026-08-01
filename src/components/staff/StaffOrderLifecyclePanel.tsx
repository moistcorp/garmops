import { ClipboardCheck, Images, Truck } from "lucide-react";
import type { StaffRole } from "@/lib/auth/constants";
import { roleCan } from "@/lib/staff/permissions";
import { formatOrderTimestamp } from "@/lib/orders/format";
import PrivateFileDownloadButton from "@/components/staff/PrivateFileDownloadButton";
import StaffEvidenceUploader from "@/components/staff/StaffEvidenceUploader";
import { ApprovalRequestForm, FileReviewForm, RevokeApprovalForm, ShipmentCreateForm, ShipmentUpdateForm } from "@/components/order-lifecycle/OrderLifecycleForms";

function approvalDisplayStatus(approval: { status: string; expires_at: string | null }, nowIso: string) {
  if (["requested", "viewed"].includes(approval.status) && approval.expires_at && approval.expires_at <= nowIso) return "expired";
  return approval.status;
}

export default function StaffOrderLifecyclePanel({ order, role, files, approvals, approvers, designVersions, shipments, shipmentEvents }: {
  order: { id: string; order_number: string; order_type: string };
  role: StaffRole;
  files: Array<{ id: string; kind: string; visibility: string; original_filename: string; scan_status: string; upload_status?: string }>;
  approvals: Array<{ id: string; status: string; approval_pdf_file_id: string | null; requested_from_email: string | null; requested_from_user_id: string | null; expires_at: string | null; responded_at: string | null; response_note: string | null; created_at: string }>;
  approvers: Array<{ user_id: string; display_name: string; role: string }>;
  designVersions: Array<{ id: string; version_number: number; created_at: string }>;
  shipments: Array<{ id: string; shipment_number: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string; package_count: number | null; dispatched_at: string | null; estimated_delivery_at: string | null; delivered_at: string | null; customer_visible_note: string | null; created_at: string }>;
  shipmentEvents: Array<{ id: string; shipment_id: string; status: string; occurred_at: string; location: string | null; customer_message: string | null; internal_note: string | null }>;
}) {
  const sampleOrder = order.order_type === "sample_purchase";
  const nowIso = new Date().toISOString();
  const defaultApprovalExpiry = new Date(
    new Date(nowIso).getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const approvalFiles = files.filter((f) => f.kind === "approval_pdf");
  const clearedApprovalFiles = approvalFiles.filter((f) => ["clean", "not_required"].includes(f.scan_status) && f.visibility === "customer");
  const evidenceFiles = files.filter((f) => ["approval_pdf", "qc_photo", "packing_list", "shipping_label", "shipment_document"].includes(f.kind));
  const canReview = (kind: string) =>
    kind === "approval_pdf"
      ? roleCan(role, "manage_approvals")
      : kind === "qc_photo"
        ? roleCan(role, "upload_qc_evidence")
        : roleCan(role, "manage_shipments");
  return <div className="space-y-6">
    {!sampleOrder ? <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#1D49B4]" /><h2 className="text-lg font-semibold">Versioned artwork approval</h2></div>
      <p className="mt-2 text-sm text-black/50">Every request is bound to the order’s immutable design version and the PDF SHA-256 evidence.</p>
      {roleCan(role, "manage_approvals") ? <div className="mt-5 grid gap-4 xl:grid-cols-2"><StaffEvidenceUploader orderId={order.id} kind="approval_pdf" visibility="customer" /><ApprovalRequestForm orderId={order.id} orderNumber={order.order_number} files={clearedApprovalFiles} approvers={approvers} designVersions={designVersions} defaultExpiresAt={defaultApprovalExpiry} /></div> : null}
      <div className="mt-5 space-y-3">{approvals.map((a) => <article key={a.id} className="rounded-[4px] border border-black/8 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-semibold capitalize">{approvalDisplayStatus(a, nowIso).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-black/45">{a.requested_from_email ?? (a.requested_from_user_id ? "Company approver" : "Approver")} · requested {formatOrderTimestamp(a.created_at)}</p>{a.response_note ? <p className="mt-2 text-sm text-black/60">{a.response_note}</p> : null}</div>{a.approval_pdf_file_id ? <PrivateFileDownloadButton fileId={a.approval_pdf_file_id} /> : null}</div>{roleCan(role, "manage_approvals") && ["requested","viewed"].includes(a.status) && (!a.expires_at || a.expires_at > nowIso) ? <RevokeApprovalForm approvalId={a.id} orderNumber={order.order_number} /> : null}</article>)}{!approvals.length ? <p className="py-5 text-center text-sm text-black/40">No approval request yet.</p> : null}</div>
    </section> : null}

    <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><Images size={18} className="text-[#1D49B4]" /><h2 className="text-lg font-semibold">QC and historical evidence</h2></div>
      {roleCan(role, "upload_qc_evidence") ? <div className="mt-5"><StaffEvidenceUploader orderId={order.id} kind="qc_photo" visibility="staff_only" /></div> : null}
      <div className="mt-5 space-y-3">{evidenceFiles.map((f) => <article key={f.id} className="rounded-[4px] border border-black/8 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{f.original_filename}</p><p className="mt-1 text-xs capitalize text-black/45">{f.kind.replaceAll("_"," ")} · {f.visibility.replaceAll("_"," ")} · {f.scan_status.replaceAll("_"," ")}</p></div>{["clean","not_required"].includes(f.scan_status) ? <PrivateFileDownloadButton fileId={f.id} /> : null}</div>{["pending","manual_review"].includes(f.scan_status) && canReview(f.kind) ? <FileReviewForm fileId={f.id} orderNumber={order.order_number} kind={f.kind} /> : null}</article>)}</div>
    </section>

    <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><Truck size={18} className="text-[#1D49B4]" /><h2 className="text-lg font-semibold">Shipments and tracking</h2></div>
      {roleCan(role, "manage_shipments") ? <div className="mt-5"><ShipmentCreateForm orderId={order.id} orderNumber={order.order_number} /></div> : null}
      <div className="mt-5 space-y-4">{shipments.map((s) => <article key={s.id} className="rounded-[4px] border border-black/8 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{s.shipment_number}</p><p className="mt-1 text-xs capitalize text-black/45">{s.status.replaceAll("_"," ")} · {s.carrier ?? "carrier pending"} · {s.tracking_number ?? "tracking pending"}</p></div>{s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1D49B4] hover:underline">Open tracking</a> : null}</div><div className="mt-4 space-y-2 border-l-2 border-[#1D49B4]/25 pl-4">{shipmentEvents.filter((e) => e.shipment_id === s.id).map((e) => <div key={e.id}><p className="text-xs font-semibold capitalize">{e.status.replaceAll("_"," ")}{e.location ? ` · ${e.location}` : ""}</p><p className="text-[10px] text-black/35">{formatOrderTimestamp(e.occurred_at)}</p>{e.customer_message ? <p className="mt-1 text-xs text-black/55">Customer: {e.customer_message}</p> : null}</div>)}</div>{roleCan(role,"manage_shipments") ? <ShipmentUpdateForm shipment={s} orderNumber={order.order_number} /> : null}</article>)}</div>
      {roleCan(role,"manage_shipments") && shipments.length ? <div className="mt-4"><StaffEvidenceUploader orderId={order.id} kind="shipment_document" visibility="staff_only" /></div> : null}
    </section>
  </div>;
}
