import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, ReceiptIndianRupee } from "lucide-react";

import { deactivateStaffAction } from "@/app/staff/actions";
import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import StaffInviteForm from "@/components/staff/StaffInviteForm";
import InvoiceRetryButton from "@/components/staff/InvoiceRetryButton";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderTimestamp } from "@/lib/orders/format";

const sections: Record<string, { title: string; description: string }> = {
  "": { title: "Operations dashboard", description: "The MFA-protected operational overview for orders, approvals, production exceptions, and dispatch." },
  orders: { title: "All orders", description: "Cross-organization order operations will be connected here in the scheduled order phase." },
  customers: { title: "Customers", description: "Organization and customer account lookup belongs here." },
  files: { title: "Files", description: "Private, signed, malware-scanned order files belong here." },
  audit: { title: "Audit log", description: "Append-only privileged action history belongs here." },
  "settings/security": { title: "Staff security", description: "Authenticator and active-session security controls belong here." },
};

async function TeamSettings() {
  const { supabase, user } = await requireStaffPermission("manage_staff");
  const { data: staff } = await supabase
    .from("staff_members")
    .select("user_id, role, team, active, invited_at, activated_at, deactivated_at, profiles(first_name, last_name)")
    .order("created_at");

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="liquid-glass-surface rounded-3xl border p-6">
        <h2 className="text-xl font-semibold">Invite staff</h2>
        <p className="mb-6 mt-2 text-sm text-black/50">Invitations are inactive until the recipient sets a password and verifies TOTP MFA.</p>
        <StaffInviteForm />
      </section>
      <section className="liquid-glass-surface rounded-3xl border p-6">
        <h2 className="text-xl font-semibold">Staff access</h2>
        <div className="mt-5 space-y-3">
          {staff?.map((member) => {
            const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
            return (
              <div key={member.user_id} className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white/45 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile?.first_name} {profile?.last_name}</p>
                  <p className="mt-1 text-xs text-black/40">{member.role.replaceAll("_", " ")} · {member.active ? "active" : member.deactivated_at ? "deactivated" : "invited"}</p>
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
      .select("id, sync_status, document_number, total_paise, attempt_count, last_error_code, last_error_message, pdf_file_id, created_at, updated_at, orders!inner(order_number, organizations(display_name))")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.rpc("staff_has_permission", { p_permission_name: "retry_invoice_job" }),
  ]);
  if (error) return <PortalPlaceholder title="Invoice queue unavailable" description="The finance integration queue could not be loaded." />;

  const counts = {
    ready: invoices?.filter((entry) => entry.sync_status === "completed").length ?? 0,
    active: invoices?.filter((entry) => ["queued", "processing", "retryable_failure"].includes(entry.sync_status)).length ?? 0,
    exceptions: invoices?.filter((entry) => entry.sync_status === "permanent_failure").length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Completed", value: counts.ready },
          { label: "Queued / retrying", value: counts.active },
          { label: "Finance exceptions", value: counts.exceptions },
        ].map((metric) => (
          <div key={metric.label} className="liquid-glass-panel rounded-2xl border p-5">
            <p className="text-[10px] uppercase tracking-wider text-black/35">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="liquid-glass-surface rounded-3xl border p-6">
        <div className="flex items-center gap-2">
          <ReceiptIndianRupee size={18} className="text-[#4F8B92]" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Zoho reservation invoice queue</h2>
        </div>
        <div className="mt-5 space-y-3">
          {invoices?.length ? invoices.map((invoice) => {
            const order = invoice.orders as unknown as { order_number: string; organizations: { display_name: string } | null };
            const Icon = statusIcon(invoice.sync_status);
            return (
              <article key={invoice.id} className="rounded-2xl border border-black/8 bg-white/45 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <Icon size={18} className={invoice.sync_status === "permanent_failure" ? "mt-0.5 text-red-700" : "mt-0.5 text-[#4F8B92]"} aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{invoice.document_number ?? order.order_number}</p>
                      <p className="mt-1 text-xs text-black/45">{order.organizations?.display_name ?? "Customer"} · {order.order_number}</p>
                      <p className="mt-2 text-sm text-black/55">{invoice.total_paise === null ? "Amount pending" : formatMoneyPaise(invoice.total_paise)} · {invoice.sync_status.replaceAll("_", " ")}</p>
                      {invoice.last_error_message ? <p className="mt-2 max-w-2xl text-xs leading-relaxed text-red-700">{invoice.last_error_code ? `${invoice.last_error_code}: ` : ""}{invoice.last_error_message}</p> : null}
                      <p className="mt-2 text-[10px] uppercase tracking-wider text-black/30">Attempts {invoice.attempt_count} · updated {formatOrderTimestamp(invoice.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {invoice.pdf_file_id ? <InvoiceDownloadButton fileId={invoice.pdf_file_id} /> : null}
                    {canRetry && invoice.sync_status !== "completed" ? <InvoiceRetryButton invoiceId={invoice.id} /> : null}
                  </div>
                </div>
              </article>
            );
          }) : <p className="py-8 text-center text-sm text-black/40">No reservation invoice records yet.</p>}
        </div>
      </section>
    </div>
  );
}

export default async function StaffSectionPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const path = (await params).section?.join("/") ?? "";
  if (path === "settings/team") return <TeamSettings />;
  if (path === "invoices") return <FinanceInvoices />;
  const section = sections[path];
  if (!section) notFound();
  return (
    <PortalPlaceholder
      {...section}
      metrics={path === "" ? [
        { label: "Orders needing action", value: "—" },
        { label: "Approvals waiting", value: "—" },
        { label: "Production exceptions", value: "—" },
        { label: "Dispatch today", value: "—" },
      ] : undefined}
    />
  );
}
