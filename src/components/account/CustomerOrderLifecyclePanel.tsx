import { randomUUID } from "node:crypto";
import { ClipboardCheck, FileArchive, RefreshCcw, Truck } from "lucide-react";
import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import { CustomerApprovalForm, ReorderForm } from "@/components/order-lifecycle/OrderLifecycleForms";
import { formatMoneyPaise, formatOrderDate, formatOrderTimestamp } from "@/lib/orders/format";

type ReorderAssessment = Readonly<{
  available: boolean;
  previousEstimatePaise: number;
  currentEstimatePaise: number | null;
  pricingChanged: boolean;
  pricingVersionChanged: boolean;
  message: string;
}>;

function approvalDisplayStatus(approval: { status: string; expires_at: string | null }, nowIso: string) {
  if (["requested", "viewed"].includes(approval.status) && approval.expires_at && approval.expires_at <= nowIso) return "expired";
  return approval.status;
}

export default function CustomerOrderLifecyclePanel({
  order,
  membershipRole,
  approvals,
  shipments,
  shipmentEvents,
  files,
  reorderAssessment,
}: {
  order: { order_number: string; status: string; order_type: string };
  membershipRole: string;
  approvals: Array<{ id: string; design_version_id: string; approval_pdf_file_id: string | null; status: string; expires_at: string | null; responded_at: string | null; response_note: string | null; snapshot_sha256: string | null; revoked_at: string | null; created_at: string }>;
  shipments: Array<{ id: string; shipment_number: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string; package_count: number | null; dispatched_at: string | null; estimated_delivery_at: string | null; delivered_at: string | null; customer_visible_note: string | null; created_at: string }>;
  shipmentEvents: Array<{ id: string; shipment_id: string; status: string; occurred_at: string; location: string | null; customer_message: string | null }>;
  files: Array<{ id: string; kind: string; original_filename: string; created_at: string }>;
  reorderAssessment: ReorderAssessment | null;
}) {
  const nowIso = new Date().toISOString();
  const activeApproval = approvals.find((approval) => ["requested", "viewed"].includes(approval.status) && Boolean(approval.expires_at) && (approval.expires_at as string) > nowIso);
  const canRespond = Boolean(activeApproval && ["owner", "approver"].includes(membershipRole));

  const sampleOrder = order.order_type === "sample_purchase";

  return <div className="space-y-5">
    {!sampleOrder ? <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#1D49B4]" /><h3 className="font-semibold">Artwork approval</h3></div>
      <div className="mt-5 space-y-3">{approvals.map((approval) => <article key={approval.id} className="rounded-[4px] border border-black/8 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold capitalize">{approvalDisplayStatus(approval, nowIso).replaceAll("_", " ")}</p><p className="mt-1 text-xs text-black/40">Requested {formatOrderTimestamp(approval.created_at)} · exact immutable design version</p>{approval.response_note ? <p className="mt-2 text-sm text-black/60">{approval.response_note}</p> : null}</div>{approval.approval_pdf_file_id ? <InvoiceDownloadButton fileId={approval.approval_pdf_file_id} /> : null}</div>{canRespond && activeApproval?.id === approval.id ? <div className="mt-4 border-t border-black/8 pt-4"><CustomerApprovalForm approvalId={approval.id} orderNumber={order.order_number} /></div> : null}</article>)}{!approvals.length ? <p className="text-sm text-black/40">No approval request has been issued yet.</p> : null}</div>
    </section> : null}

    <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><Truck size={18} className="text-[#1D49B4]" /><h3 className="font-semibold">Shipment tracking</h3></div>
      <div className="mt-5 space-y-4">{shipments.map((shipment) => <article key={shipment.id} className="rounded-[4px] border border-black/8 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{shipment.shipment_number}</p><p className="mt-1 text-xs capitalize text-black/45">{shipment.status.replaceAll("_", " ")} · {shipment.carrier ?? "Carrier pending"}</p>{shipment.tracking_number ? <p className="mt-1 text-xs text-black/55">Tracking: {shipment.tracking_number}</p> : null}</div>{shipment.tracking_url ? <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1D49B4] hover:underline">Track parcel</a> : null}</div>{shipment.estimated_delivery_at ? <p className="mt-3 text-xs text-black/45">Estimated delivery {formatOrderDate(shipment.estimated_delivery_at)}</p> : null}{shipment.customer_visible_note ? <p className="mt-3 text-sm text-black/60">{shipment.customer_visible_note}</p> : null}<div className="mt-4 space-y-3 border-l-2 border-[#1D49B4]/25 pl-4">{shipmentEvents.filter((e) => e.shipment_id === shipment.id).map((event) => <div key={event.id}><p className="text-xs font-semibold capitalize">{event.status.replaceAll("_", " ")}{event.location ? ` · ${event.location}` : ""}</p><p className="text-[10px] text-black/35">{formatOrderTimestamp(event.occurred_at)}</p>{event.customer_message ? <p className="mt-1 text-xs text-black/55">{event.customer_message}</p> : null}</div>)}</div></article>)}{!shipments.length ? <p className="text-sm text-black/40">Shipment details will appear after dispatch preparation begins.</p> : null}</div>
    </section>

    <section className="techpack-surface rounded-[4px] border p-6">
      <div className="flex items-center gap-2"><FileArchive size={18} className="text-[#1D49B4]" /><h3 className="font-semibold">Order documents and QC evidence</h3></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{files.map((file) => <article key={file.id} className="rounded-[4px] border border-black/8 bg-white p-4"><p className="truncate text-sm font-semibold">{file.original_filename}</p><p className="mt-1 text-xs capitalize text-black/40">{file.kind.replaceAll("_", " ")}</p><div className="mt-3"><InvoiceDownloadButton fileId={file.id} /></div></article>)}{!files.length ? <p className="text-sm text-black/40">No customer-visible documents yet.</p> : null}</div>
    </section>

    {!sampleOrder && order.status === "delivered" && ["owner", "buyer"].includes(membershipRole) ? <section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center gap-2"><RefreshCcw size={18} className="text-[#1D49B4]" /><h3 className="font-semibold">Reorder this configuration</h3></div><p className="mt-2 text-sm text-black/50">A reorder creates a new design version, recalculates current pricing server-side, and receives a new order number and date. This historical order remains unchanged.</p>{reorderAssessment ? <div className={`mt-4 rounded-[4px] border p-4 text-sm ${reorderAssessment.available && !reorderAssessment.pricingChanged && !reorderAssessment.pricingVersionChanged ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="font-semibold">Current availability review</p><p className="mt-1 text-xs leading-relaxed">{reorderAssessment.message}</p>{reorderAssessment.currentEstimatePaise !== null ? <p className="mt-2 text-xs">Historical estimate: {formatMoneyPaise(reorderAssessment.previousEstimatePaise)} · Current estimate: {formatMoneyPaise(reorderAssessment.currentEstimatePaise)}</p> : null}</div> : null}{reorderAssessment?.available ? <ReorderForm orderNumber={order.order_number} idempotencyKey={randomUUID()} /> : <p className="mt-4 text-xs font-medium text-amber-800">Contact Garmops to review an equivalent current product before reordering.</p>}</section> : null}
  </div>;
}
