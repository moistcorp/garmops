import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileText,
  History,
  MessageSquareText,
  Package,
  ShieldAlert,
  Truck,
  UserRoundCog,
} from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import {
  formatMoneyPaise,
  formatOrderDate,
  formatOrderTimestamp,
} from "@/lib/orders/format";
import { roleCan } from "@/lib/staff/permissions";
import { getStaffOrderWorkspace } from "@/lib/staff/dal";
import {
  allowedNextStatusesForRole,
  ORDER_STATUS_LABELS,
  PUBLIC_STATUS_LABELS,
} from "@/lib/staff/statuses";
import type { StaffRole } from "@/lib/auth/constants";
import {
  AssignmentForm,
  ExpectedDatesForm,
  FileVisibilityForm,
  OrderCommentComposer,
  PriorityForm,
  ResolveActionForm,
  StatusTransitionForm,
} from "@/components/staff/StaffOrderForms";
import PrivateFileDownloadButton from "@/components/staff/PrivateFileDownloadButton";
import StaffOrderLifecyclePanel from "@/components/staff/StaffOrderLifecyclePanel";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

function statusTone(status: string) {
  if (["delivered", "completed", "paid", "approved"].includes(status)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["failed", "permanent_failure", "cancelled", "refunded"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  if (["needs_customer_action", "action_required", "urgent"].includes(status)) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-[#4F8B92]/12 text-[#315F66]";
}

export default async function StaffOrderWorkspace({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const context = await requireStaffPermission("view_all_orders");
  const role = context.role as StaffRole;
  const workspace = await getStaffOrderWorkspace(context.supabase, orderNumber);
  if (!workspace.order) return notFound();
  const order = workspace.order;
  const customer = object(order.customer_snapshot);
  const company = object(order.company_snapshot);
  const shipping = object(order.shipping_snapshot);
  const shippingAddress = object(shipping.address);
  const nextStatuses = allowedNextStatusesForRole(order.status, role, order.order_type);
  const openActions = workspace.comments.filter(
    (comment) => comment.action_required && !comment.resolved_at,
  );
  const invoice = workspace.invoices[0];

  return (
    <div className="space-y-6">
      <Link
        href="/staff/orders"
        className="inline-flex items-center gap-2 text-sm font-semibold text-black/50 hover:text-[#315F66]"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to work queue
      </Link>

      <section className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(order.status)}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(order.internal_priority)}`}>
                {order.internal_priority} priority
              </span>
              {openActions.length ? (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {openActions.length} open action{openActions.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {order.order_number}
            </h1>
            <p className="mt-2 text-sm text-black/50">
              {order.organizations?.display_name ?? String(company.displayName ?? "Customer")} · {String(customer.name ?? "Customer")}
            </p>
            <p className="mt-1 text-xs text-black/35">
              Submitted {formatOrderTimestamp(order.submitted_at)} · Customer sees {PUBLIC_STATUS_LABELS[order.public_status]}
            </p>
          </div>
          <div className="rounded-2xl bg-white/45 px-4 py-3 text-sm text-black/55">
            Customer-facing status: <span className="font-semibold text-black/75">{PUBLIC_STATUS_LABELS[order.public_status]}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Estimated order", formatMoneyPaise(order.estimated_total_paise), CircleDollarSign],
          [order.order_type === "sample_purchase" ? "Sample payment" : "Reservation paid", formatMoneyPaise(order.amount_paid_paise), CheckCircle2],
          ["Quantity", `${workspace.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("en-IN")} units`, Package],
          ["Requested delivery", order.requested_delivery_date ? formatOrderDate(`${order.requested_delivery_date}T00:00:00Z`) : "Not set", CalendarClock],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Package;
          return (
            <div key={String(label)} className="liquid-glass-panel rounded-2xl border p-5">
              <MetricIcon size={17} className="text-[#4F8B92]" aria-hidden="true" />
              <p className="mt-4 text-[10px] uppercase tracking-wider text-black/35">{String(label)}</p>
              <p className="mt-2 font-semibold">{String(value)}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <div className="space-y-6">
          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-[#4F8B92]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Immutable order specification</h2>
            </div>
            <div className="mt-5 space-y-4">
              {workspace.items.map((item) => {
                const colour = object(item.colour_snapshot);
                const product = object(item.product_snapshot);
                const sizes = object(item.size_breakdown);
                const decoration = object(item.decoration_snapshot);
                return (
                  <article key={item.id} className="rounded-2xl border border-black/8 bg-white/45 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{item.product_name}</h3>
                        <p className="mt-1 text-sm text-black/50">
                          {order.order_type === "sample_purchase"
                            ? `${String(product.gsm ?? "Catalogue")} GSM sample`
                            : String(colour.name ?? "Colour pending review")} · {item.quantity.toLocaleString("en-IN")} units
                        </p>
                        <p className="mt-2 text-xs text-black/40">
                          {[product.fit, product.gsm, decoration.technique].filter(Boolean).map(String).join(" · ") || "Configuration snapshot stored"}
                        </p>
                      </div>
                      {item.line_total_paise !== null ? <p className="text-sm font-semibold">{formatMoneyPaise(item.line_total_paise)}</p> : null}
                    </div>
                    <div className="mt-4 border-t border-black/7 pt-4 text-xs leading-relaxed text-black/55">
                      {Object.entries(sizes).map(([size, quantity]) => `${size}: ${quantity}`).join(" · ")}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <StaffOrderLifecyclePanel
            order={{ id: order.id, order_number: order.order_number, order_type: order.order_type }}
            role={role}
            files={workspace.files}
            approvals={workspace.approvals}
            approvers={workspace.approvers}
            designVersions={workspace.designVersions}
            shipments={workspace.shipments}
            shipmentEvents={workspace.shipmentEvents}
          />

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <MessageSquareText size={18} className="text-[#4F8B92]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Customer updates and action requests</h2>
            </div>
            <div className="mt-5 space-y-4">
              {workspace.comments.filter((comment) => comment.visibility === "customer").map((comment) => (
                <article key={comment.id} className={`rounded-2xl border p-4 ${comment.action_required && !comment.resolved_at ? "border-blue-200 bg-blue-50/60" : "border-black/8 bg-white/45"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">Customer-visible</span>
                      {comment.action_required ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{comment.resolved_at ? "Resolved" : "Action required"}</span> : null}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(comment.created_at)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-black/65">{comment.body}</p>
                  {comment.action_type ? <p className="mt-2 text-xs capitalize text-black/40">Type: {comment.action_type.replaceAll("_", " ")}</p> : null}
                  {comment.action_required && !comment.resolved_at && roleCan(role, "manage_action_requests") ? (
                    <ResolveActionForm commentId={comment.id} orderNumber={order.order_number} />
                  ) : null}
                </article>
              ))}
              {!workspace.comments.some((comment) => comment.visibility === "customer") ? <p className="py-6 text-center text-sm text-black/40">No customer updates yet.</p> : null}
            </div>
            {roleCan(role, "send_customer_update") ? (
              <div className="mt-6 border-t border-black/8 pt-6">
                <h3 className="mb-3 text-sm font-semibold">Publish customer update</h3>
                <OrderCommentComposer orderId={order.id} orderNumber={order.order_number} visibility="customer" />
              </div>
            ) : null}
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-700" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Internal notes</h2>
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-700">Never visible to customers</p>
            <div className="mt-5 space-y-3">
              {workspace.comments.filter((comment) => comment.visibility === "staff_only").map((comment) => (
                <article key={comment.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/65">{comment.body}</p>
                  <p className="mt-3 text-[10px] uppercase tracking-wider text-black/30">{formatOrderTimestamp(comment.created_at)}</p>
                </article>
              ))}
              {!workspace.comments.some((comment) => comment.visibility === "staff_only") ? <p className="py-4 text-center text-sm text-black/40">No internal notes.</p> : null}
            </div>
            {roleCan(role, "add_internal_note") ? (
              <div className="mt-6 border-t border-black/8 pt-6">
                <OrderCommentComposer orderId={order.id} orderNumber={order.order_number} visibility="staff_only" />
              </div>
            ) : null}
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#4F8B92]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Order files</h2>
            </div>
            <div className="mt-5 space-y-4">
              {workspace.files.map((file) => (
                <article key={file.id} className="rounded-2xl border border-black/8 bg-white/45 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{file.original_filename}</p>
                      <p className="mt-1 text-xs capitalize text-black/45">{file.kind.replaceAll("_", " ")} · {file.visibility.replaceAll("_", " ")} · scan {file.scan_status.replaceAll("_", " ")}</p>
                    </div>
                    {file.scan_status === "clean" || file.scan_status === "not_required" ? (
                      <PrivateFileDownloadButton fileId={file.id} />
                    ) : (
                      <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        Awaiting security review
                      </span>
                    )}
                  </div>
                  {roleCan(role, "change_file_visibility") ? (
                    <FileVisibilityForm
                      fileId={file.id}
                      orderNumber={order.order_number}
                      visibility={file.visibility}
                      canShare={["clean", "not_required"].includes(file.scan_status)}
                    />
                  ) : null}
                </article>
              ))}
              {!workspace.files.length ? <p className="py-6 text-center text-sm text-black/40">No files attached to this order.</p> : null}
            </div>
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-6">
            <div className="flex items-center gap-2">
              <History size={18} className="text-[#4F8B92]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Status and audit history</h2>
            </div>
            <div className="mt-5 space-y-4">
              {workspace.history.map((entry) => (
                <div key={entry.id} className="border-l-2 border-[#4F8B92]/30 pl-4">
                  <p className="text-sm font-semibold">{ORDER_STATUS_LABELS[entry.to_status as keyof typeof ORDER_STATUS_LABELS]}</p>
                  {entry.customer_message ? <p className="mt-1 text-xs leading-relaxed text-black/55">Customer: {entry.customer_message}</p> : null}
                  {entry.internal_note ? <p className="mt-1 text-xs leading-relaxed text-amber-700">Internal: {entry.internal_note}</p> : null}
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">{entry.actor_type} · {formatOrderTimestamp(entry.created_at)}</p>
                </div>
              ))}
            </div>
            {roleCan(role, "view_audit") && workspace.audit.length ? (
              <details className="mt-6 rounded-2xl border border-black/8 bg-white/40 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Recent privileged audit records</summary>
                <div className="mt-4 space-y-3">
                  {workspace.audit.map((entry) => (
                    <div key={entry.id} className="text-xs text-black/55">
                      <p className="font-semibold">{entry.action}</p>
                      <p className="mt-1">{formatOrderTimestamp(entry.created_at)} · {entry.actor_type}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          {roleCan(role, "change_order_status") ? (
            <section className="liquid-glass-surface rounded-3xl border p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><Clock3 size={17} className="text-[#4F8B92]" /> Status</h2>
              <StatusTransitionForm orderId={order.id} orderNumber={order.order_number} currentStatus={order.status} nextStatuses={nextStatuses} />
            </section>
          ) : null}

          {roleCan(role, "assign_order") ? (
            <section className="liquid-glass-surface rounded-3xl border p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><UserRoundCog size={17} className="text-[#4F8B92]" /> Assignment</h2>
              <AssignmentForm orderId={order.id} orderNumber={order.order_number} currentAssignee={order.assigned_staff_user_id} currentTeam={order.assigned_team} assignees={workspace.assignees} />
            </section>
          ) : null}

          {roleCan(role, "set_order_priority") ? (
            <section className="liquid-glass-surface rounded-3xl border p-5">
              <h2 className="mb-4 font-semibold">Priority</h2>
              <PriorityForm orderId={order.id} orderNumber={order.order_number} priority={order.internal_priority} />
            </section>
          ) : null}

          {roleCan(role, "set_expected_dates") ? (
            <section className="liquid-glass-surface rounded-3xl border p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><CalendarClock size={17} className="text-[#4F8B92]" /> Expected dates</h2>
              <ExpectedDatesForm
                orderId={order.id}
                orderNumber={order.order_number}
                values={{
                  expectedApprovalAt: toDateTimeLocal(order.expected_approval_at),
                  expectedProductionAt: toDateTimeLocal(order.expected_production_at),
                  expectedQcAt: toDateTimeLocal(order.expected_qc_at),
                  estimatedDispatchAt: toDateTimeLocal(order.estimated_dispatch_at),
                }}
              />
            </section>
          ) : null}

          <section className="liquid-glass-surface rounded-3xl border p-5">
            <h2 className="flex items-center gap-2 font-semibold"><CircleDollarSign size={17} className="text-[#4F8B92]" /> Payment and invoice</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-white/45 p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/35">Payment</p>
                <p className="mt-1 font-semibold capitalize">{workspace.payment?.status ?? "Unavailable"}</p>
                <p className="mt-1 text-xs text-black/45">{workspace.payment ? `${formatMoneyPaise(workspace.payment.amount_paise)} · ${workspace.payment.attempt_count} attempt${workspace.payment.attempt_count === 1 ? "" : "s"}` : "Safe provider summary unavailable"}</p>
              </div>
              <div className="rounded-2xl bg-white/45 p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/35">Invoice</p>
                <p className="mt-1 font-semibold capitalize">{invoice?.sync_status.replaceAll("_", " ") ?? "Not created"}</p>
                {invoice?.document_number ? <p className="mt-1 text-xs text-black/45">{invoice.document_number}</p> : null}
                {invoice?.last_error_message ? <p className="mt-2 text-xs text-red-700">{invoice.last_error_message}</p> : null}
              </div>
            </div>
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Truck size={17} className="text-[#4F8B92]" /> Shipment</h2>
            {workspace.shipments[0] ? (
              <div className="mt-4 text-sm text-black/55">
                <p className="font-semibold capitalize text-black/75">{workspace.shipments[0].status.replaceAll("_", " ")}</p>
                <p className="mt-1">{workspace.shipments[0].carrier ?? "Carrier not set"}</p>
                <p className="mt-1">{workspace.shipments[0].tracking_number ?? "Tracking not set"}</p>
              </div>
            ) : <p className="mt-4 text-sm text-black/40">No shipment record yet. Shipment creation is completed in Phase 11.</p>}
          </section>

          <section className="liquid-glass-surface rounded-3xl border p-5">
            <h2 className="font-semibold">Customer and company</h2>
            <div className="mt-4 space-y-2 text-sm leading-relaxed text-black/55">
              <p className="font-semibold text-black/75">{String(customer.name ?? "Customer")}</p>
              <p>{String(customer.email ?? customer.accountEmail ?? "Email unavailable")}</p>
              <p>{String(customer.phone ?? "Phone unavailable")}</p>
              <p className="pt-2 font-semibold text-black/75">{String(company.legalName ?? company.displayName ?? "Company")}</p>
              <p>GSTIN: {String(company.submittedGstin ?? company.gstin ?? "Not supplied")}</p>
              <p>PO: {order.po_number ?? "Not supplied"}</p>
              <p className="pt-2">{String(shippingAddress.city ?? "")}, {String(shippingAddress.state ?? "")} {String(shippingAddress.postalCode ?? "")}</p>
            </div>
            <Link href={`/staff/customers/${order.organization_id}`} className="mt-4 inline-block text-xs font-semibold text-[#315F66] hover:underline">Open organisation</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
