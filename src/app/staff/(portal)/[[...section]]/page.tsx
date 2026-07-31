import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, ReceiptIndianRupee } from "lucide-react";

import { deactivateStaffAction } from "@/app/staff/actions";
import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import StaffAudit from "@/components/staff/StaffAudit";
import { StaffCustomerDetail, StaffCustomerList } from "@/components/staff/StaffCustomers";
import StaffDashboard from "@/components/staff/StaffDashboard";
import StaffFiles from "@/components/staff/StaffFiles";
import StaffInviteForm from "@/components/staff/StaffInviteForm";
import InvoiceRetryButton from "@/components/staff/InvoiceRetryButton";
import StaffOrderQueue from "@/components/staff/StaffOrderQueue";
import StaffOrderWorkspace from "@/components/staff/StaffOrderWorkspace";
import { StaffApprovalQueue, StaffShipmentQueue } from "@/components/staff/StaffOrderLifecycleQueues";
import { requireStaffPermission } from "@/lib/auth/guards";
import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderTimestamp,
} from "@/lib/orders/format";

export const dynamic = "force-dynamic";

async function TeamSettings() {
  const { supabase, user } = await requireStaffPermission("manage_staff");
  const { data: staff } = await supabase
    .from("staff_members")
    .select("user_id, role, team, active, invited_at, activated_at, deactivated_at, profiles(first_name, last_name)")
    .order("created_at");

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="techpack-surface rounded-[4px] border p-6">
        <h1 className="text-xl font-semibold">Invite staff</h1>
        <p className="mb-6 mt-2 text-sm text-black/50">Invitations are inactive until the recipient sets a password and verifies TOTP MFA.</p>
        <StaffInviteForm />
      </section>
      <section className="techpack-surface rounded-[4px] border p-6">
        <h2 className="text-xl font-semibold">Staff access</h2>
        <div className="mt-5 space-y-3">
          {staff?.map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            return (
              <div key={member.user_id} className="flex items-center justify-between gap-4 rounded-[4px] border border-black/8 bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile?.first_name} {profile?.last_name}</p>
                  <p className="mt-1 text-xs text-black/40">{member.role.replaceAll("_", " ")} · {member.team ?? "no team"} · {member.active ? "active" : member.deactivated_at ? "deactivated" : "invited"}</p>
                </div>
                {member.active && member.user_id !== user.id ? (
                  <form action={deactivateStaffAction}>
                    <input type="hidden" name="userId" value={member.user_id} />
                    <button className="text-xs font-medium text-red-700 hover:underline" type="submit">Deactivate</button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function statusIcon(status: string) {
  if (status === "completed") return CheckCircle2;
  if (status === "permanent_failure") return AlertTriangle;
  return Clock3;
}

async function FinanceInvoices() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const [{ data: invoices, error }, { data: canRetry }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, kind, sync_status, document_number, total_paise, attempt_count, last_error_code, last_error_message, pdf_file_id, created_at, updated_at, orders!inner(order_number, organizations(display_name))")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.rpc("staff_has_permission", { p_permission_name: "retry_invoice_job" }),
  ]);
  if (error) return <PortalPlaceholder title="Invoice queue unavailable" description="The finance integration queue could not be loaded." />;

  const counts = {
    ready: invoices?.filter((entry) => entry.sync_status === "completed").length ?? 0,
    active: invoices?.filter((entry) => ["queued", "processing", "retryable_failure"].includes(entry.sync_status)).length ?? 0,
    exceptions: invoices?.filter((entry) => entry.sync_status === "permanent_failure").length ?? 0,
    deferred: invoices?.filter((entry) => entry.sync_status === "not_required").length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Completed", value: counts.ready },
          { label: "Queued / retrying", value: counts.active },
          { label: "Finance exceptions", value: counts.exceptions },
          { label: "Configured later", value: counts.deferred },
        ].map((metric) => (
          <div key={metric.label} className="techpack-panel rounded-[4px] border p-5">
            <p className="text-[10px] uppercase tracking-wider text-black/35">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="techpack-surface rounded-[4px] border p-6">
        <div className="flex items-center gap-2">
          <ReceiptIndianRupee size={18} className="text-[#1D49B4]" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Accounting document queue</h1>
        </div>
        <div className="mt-5 space-y-3">
          {invoices?.length ? invoices.map((invoice) => {
            const order = invoice.orders as unknown as { order_number: string; organizations: { display_name: string } | null };
            const Icon = statusIcon(invoice.sync_status);
            return (
              <article key={invoice.id} className="rounded-[4px] border border-black/8 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <Icon size={18} className={invoice.sync_status === "permanent_failure" ? "mt-0.5 text-red-700" : "mt-0.5 text-[#1D49B4]"} aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{invoice.document_number ?? (invoice.kind === "sample_tax_invoice" ? `Sample tax document · ${formatOrderCode(order.order_number)}` : formatOrderCode(order.order_number))}</p>
                      <p className="mt-1 text-xs text-black/45">{order.organizations?.display_name ?? "Customer"} · {formatOrderCode(order.order_number)}</p>
                      <p className="mt-2 text-sm text-black/55">{invoice.total_paise === null ? "Amount pending" : formatMoneyPaise(invoice.total_paise)} · {invoice.sync_status.replaceAll("_", " ")}</p>
                      {invoice.last_error_message ? <p className="mt-2 max-w-2xl text-xs leading-relaxed text-red-700">{invoice.last_error_code ? `${invoice.last_error_code}: ` : ""}{invoice.last_error_message}</p> : null}
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">Attempts {invoice.attempt_count} · updated {formatOrderTimestamp(invoice.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {invoice.pdf_file_id ? <InvoiceDownloadButton fileId={invoice.pdf_file_id} /> : null}
                    {canRetry && ["queued", "processing", "retryable_failure", "permanent_failure"].includes(invoice.sync_status) ? <InvoiceRetryButton invoiceId={invoice.id} /> : null}
                  </div>
                </div>
              </article>
            );
          }) : <p className="py-8 text-center text-sm text-black/40">No accounting document records yet.</p>}
        </div>
      </section>
    </div>
  );
}

async function StaffSecurity() {
  await requireStaffPermission("view_all_orders");
  return (
    <PortalPlaceholder
      title="Staff security"
      description="Staff access is invite-only, database-role controlled and requires authenticator-app MFA at AAL2 for every staff page and action. Session-management enhancements remain part of the final hardening phase."
      metrics={[
        { label: "Authentication", value: "Supabase Auth" },
        { label: "Staff MFA", value: "TOTP required" },
        { label: "Authorisation", value: "RLS + RPC" },
        { label: "Audit", value: "Append only" },
      ]}
    />
  );
}

export default async function StaffSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pathParts = (await params).section ?? [];
  const path = pathParts.join("/");
  const query = await searchParams;

  if (path === "") return <StaffDashboard />;
  if (path === "orders") return <StaffOrderQueue searchParams={query} />;
  if (pathParts[0] === "orders" && pathParts.length === 2) {
    return <StaffOrderWorkspace orderNumber={pathParts[1]} />;
  }
  if (path === "customers") return <StaffCustomerList searchParams={query} />;
  if (pathParts[0] === "customers" && pathParts.length === 2) {
    return <StaffCustomerDetail organizationId={pathParts[1]} />;
  }
  if (path === "invoices") return <FinanceInvoices />;
  if (path === "approvals") return <StaffApprovalQueue />;
  if (path === "shipments") return <StaffShipmentQueue />;
  if (path === "files") return <StaffFiles searchParams={query} />;
  if (path === "audit") return <StaffAudit searchParams={query} />;
  if (path === "settings/team") return <TeamSettings />;
  if (path === "settings/security") return <StaffSecurity />;
  if (path === "settings/integrations") {
    await requireStaffPermission("view_jobs");
    return (
      <PortalPlaceholder
        title="Integration health"
        description="PayU verification, reconciliation, Zoho invoice jobs, R2 file archival and transactional email remain independently retryable. Use the invoice and order exception views for operational action."
        metrics={[
          { label: "Payments", value: "PayU verified" },
          { label: "Accounting", value: "Zoho queued" },
          { label: "Files", value: "Private R2" },
          { label: "Jobs", value: "PostgreSQL" },
        ]}
      />
    );
  }

  notFound();
}
