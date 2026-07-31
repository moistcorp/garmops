import { notFound } from "next/navigation";
import Link from "next/link";
import { Bell, FileText } from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/account/order-lifecycle-actions";
import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderDate,
} from "@/lib/orders/format";

export const dynamic = "force-dynamic";

const sections: Record<string, { title: string; description: string }> = {
  "": {
    title: "Workspace overview",
    description: "Track company orders, approvals, files, invoices, and production updates from one tenant-isolated workspace.",
  },
  company: { title: "Company", description: "Organization details, GST information, members, and addresses belong here." },
  notifications: { title: "Notifications", description: "Account-specific production and approval notices will appear here." },
  "settings/profile": { title: "Profile", description: "Maintain your own permitted profile fields here." },
  "settings/security": { title: "Security", description: "Password and session security controls belong here." },
};

function invoiceStatusCopy(status: string): string {
  if (status === "completed") return "Available";
  if (["queued", "processing", "retryable_failure"].includes(status)) return "Being generated";
  if (status === "permanent_failure") return "Finance review required";
  if (status === "not_required") return "Automation not enabled";
  return status.replaceAll("_", " ");
}

async function DocumentsPage() {
  const { supabase, membership } = await requireOrganizationMember("/account/documents");
  const [{ data: invoices, error }, { data: files, error: filesError }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, kind, sync_status, document_number, issue_date, total_paise, pdf_file_id, created_at, orders!inner(order_number, organization_id)")
      .eq("orders.organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_files")
      .select("id, kind, original_filename, created_at, orders!inner(order_number, organization_id)")
      .eq("visibility", "customer")
      .neq("kind", "invoice_pdf")
      .is("deleted_at", null)
      .in("scan_status", ["clean", "not_required"])
      .eq("orders.organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (error || filesError) return <PortalPlaceholder title="Documents unavailable" description="Your company document vault could not be loaded." />;

  return (
    <div className="space-y-5">
      <section className="techpack-surface rounded-[4px] border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Company document vault</h2>
        <p className="mt-2 text-sm text-black/50">Accounting documents, immutable approvals, purchase orders, selected QC evidence, and shipment files are kept under organisation access controls.</p>
      </section>

      <section className="techpack-surface rounded-[4px] border p-6">
        <h3 className="font-semibold">Order documents</h3>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {files?.map((file) => {
            const order = file.orders as unknown as { order_number: string };
            return <article key={file.id} className="rounded-[4px] border border-black/8 bg-white p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.original_filename}</p><p className="mt-1 text-xs capitalize text-black/45">{file.kind.replaceAll("_", " ")} · {formatOrderCode(order.order_number)}</p></div><InvoiceDownloadButton fileId={file.id} /></div></article>;
          })}
          {!files?.length ? <p className="text-sm text-black/40">No customer-visible order files yet.</p> : null}
        </div>
      </section>

      <section className="techpack-surface rounded-[4px] border p-6">
        <h3 className="font-semibold">Accounting documents</h3>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {invoices?.map((invoice) => {
            const order = invoice.orders as unknown as { order_number: string };
            return <article key={invoice.id} className="rounded-[4px] border border-black/8 bg-white p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><FileText size={17} className="text-[#1D49B4]" /><p className="text-sm font-semibold">{invoice.document_number ?? (invoice.kind === "sample_tax_invoice" ? "Sample tax document" : "Reservation document")}</p></div><p className="mt-2 text-xs text-black/45">{formatOrderCode(order.order_number)}</p><p className="mt-2 text-xs text-black/45">{invoice.total_paise === null ? "Amount pending" : formatMoneyPaise(invoice.total_paise)} · {invoiceStatusCopy(invoice.sync_status)}</p></div>{invoice.sync_status === "completed" && invoice.pdf_file_id ? <InvoiceDownloadButton fileId={invoice.pdf_file_id} /> : null}</div></article>;
          })}
        </div>
      </section>
    </div>
  );
}

async function NotificationsPage() {
  const { supabase } = await requireOrganizationMember("/account/notifications");
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, action_url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return <PortalPlaceholder title="Notifications unavailable" description="Your account notifications could not be loaded." />;
  const unread = notifications?.filter((n) => !n.read_at).length ?? 0;
  return <div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Bell size={18} className="text-[#1D49B4]" /><h2 className="text-xl font-semibold">Notifications</h2></div><p className="mt-2 text-sm text-black/50">Approval requests, customer actions, status updates, and shipment events appear here.</p></div>{unread ? <form action={markAllNotificationsReadAction}><button className="rounded-[4px] border border-black/10 bg-white px-4 py-2 text-xs font-semibold">Mark all read</button></form> : null}</div></section><div className="space-y-3">{notifications?.map((notification) => <article key={notification.id} className={`rounded-[4px] border p-5 ${notification.read_at ? "border-black/8 bg-white" : "border-[#1D49B4]/35 bg-[#1D49B4]/8"}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold">{notification.title}</p><p className="mt-2 text-sm leading-relaxed text-black/55">{notification.body}</p><p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">{formatOrderDate(notification.created_at)}</p></div><div className="flex gap-2">{notification.action_url ? <Link href={notification.action_url} className="rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white">Open</Link> : null}{!notification.read_at ? <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={notification.id} /><button className="rounded-[4px] border border-black/10 bg-white px-4 py-2 text-xs font-semibold">Mark read</button></form> : null}</div></div></article>)}{!notifications?.length ? <PortalPlaceholder title="No notifications" description="New approval, order, and shipment updates will appear here." /> : null}</div></div>;
}

async function AccountOverview() {
  const { supabase, membership } = await requireOrganizationMember("/account");
  const [{ data: orders }, { count: unread }, { count: documents }, { count: approvals }] = await Promise.all([
    supabase.from("orders").select("id,order_number,public_status,status,submitted_at,customer_reference").eq("organization_id", membership.organization_id).order("submitted_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("order_files").select("id,orders!inner(organization_id)", { count: "exact", head: true }).eq("visibility", "customer").is("deleted_at", null).in("scan_status", ["clean", "not_required"]).eq("orders.organization_id", membership.organization_id),
    supabase.from("approvals").select("id,orders!inner(organization_id)", { count: "exact", head: true }).in("status", ["requested", "viewed"]).eq("orders.organization_id", membership.organization_id),
  ]);
  const active = orders?.filter((o) => !["delivered", "cancelled", "refunded", "expired"].includes(o.status)).length ?? 0;
  const delivered = orders?.filter((o) => o.status === "delivered").length ?? 0;
  return <div className="space-y-5"><section className="techpack-surface rounded-[4px] border p-6 sm:p-8"><h2 className="text-xl font-semibold">Company operations overview</h2><p className="mt-2 text-sm text-black/50">Orders needing action, versioned approvals, shipments, notifications, and reusable historical configurations are collected here.</p></section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Active orders",active],["Approvals due",approvals ?? 0],["Unread updates",unread ?? 0],["Documents",documents ?? 0]].map(([label,value]) => <div key={String(label)} className="techpack-panel rounded-[4px] border p-5"><p className="text-[10px] uppercase tracking-wider text-black/35">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div><section className="techpack-surface rounded-[4px] border p-6"><div className="flex items-center justify-between gap-4"><h3 className="font-semibold">Recent orders</h3><Link href="/account/orders" className="text-xs font-semibold text-[#1D49B4] hover:underline">View all</Link></div><div className="mt-5 space-y-3">{orders?.map((order) => <Link key={order.id} href={`/account/orders/${order.order_number}`} className="flex items-center justify-between gap-4 rounded-[4px] border border-black/8 bg-white p-4 transition hover:border-[#1D49B4]/40"><div><p className="text-sm font-semibold">{formatOrderCode(order.order_number)}</p><p className="mt-1 text-xs text-black/45">{order.customer_reference ?? "Custom order"}</p></div><span className="techpack-stamp" data-tone="accent">{order.public_status.replaceAll("_", " ")}</span></Link>)}{!orders?.length ? <p className="text-sm text-black/40">No orders yet.</p> : null}</div>{delivered ? <p className="mt-4 text-xs text-black/45">Delivered orders include a reorder action that creates a fresh price and a new order number.</p> : null}</section></div>;
}

export default async function AccountSectionPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const path = (await params).section?.join("/") ?? "";
  if (path === "") return <AccountOverview />;
  if (path === "documents") return <DocumentsPage />;
  if (path === "notifications") return <NotificationsPage />;
  const section = sections[path];
  if (!section) notFound();
  return (
    <PortalPlaceholder
      {...section}
      metrics={path === "" ? [
        { label: "Open orders", value: "—" },
        { label: "Approvals due", value: "—" },
        { label: "In production", value: "—" },
        { label: "Documents", value: "—" },
      ] : undefined}
    />
  );
}
