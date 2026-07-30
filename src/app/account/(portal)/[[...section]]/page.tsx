import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import InvoiceDownloadButton from "@/components/account/InvoiceDownloadButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderDate } from "@/lib/orders/format";

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
  return status.replaceAll("_", " ");
}

async function DocumentsPage() {
  const { supabase, membership } = await requireOrganizationMember("/account/documents");
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, kind, sync_status, document_number, issue_date, total_paise, pdf_file_id, created_at, orders!inner(order_number, organization_id)")
    .eq("orders.organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (error) {
    return <PortalPlaceholder title="Documents unavailable" description="Your accounting documents could not be loaded." />;
  }

  return (
    <div className="space-y-5">
      <section className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Accounting documents</h2>
        <p className="mt-2 text-sm text-black/50">
          Official Zoho reservation documents are copied to private Garmops storage and remain linked to the immutable order.
        </p>
      </section>

      {invoices?.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {invoices.map((invoice) => {
            const order = invoice.orders as unknown as { order_number: string };
            return (
              <article key={invoice.id} className="liquid-glass-panel rounded-2xl border p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={17} className="text-[#4F8B92]" aria-hidden="true" />
                      <p className="text-sm font-semibold">{invoice.document_number ?? "Reservation document"}</p>
                    </div>
                    <p className="mt-2 text-xs text-black/45">Order {order.order_number}</p>
                  </div>
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold capitalize text-black/55">
                    {invoiceStatusCopy(invoice.sync_status)}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-black/7 pt-4 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-black/35">Amount</dt>
                    <dd className="mt-1 font-semibold">{invoice.total_paise === null ? "—" : formatMoneyPaise(invoice.total_paise)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-black/35">Document date</dt>
                    <dd className="mt-1 font-semibold">{invoice.issue_date ? formatOrderDate(`${invoice.issue_date}T00:00:00Z`) : "Pending"}</dd>
                  </div>
                </dl>
                <div className="mt-5">
                  {invoice.sync_status === "completed" && invoice.pdf_file_id ? (
                    <InvoiceDownloadButton fileId={invoice.pdf_file_id} />
                  ) : (
                    <p className="text-xs leading-relaxed text-black/45">
                      {invoice.sync_status === "permanent_failure"
                        ? "Our finance team needs to review this document. Your verified payment remains recorded."
                        : "The document will become downloadable after Zoho generation and secure PDF archival finish."}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <PortalPlaceholder title="No accounting documents yet" description="Reservation invoices will appear after a verified payment." />
      )}
    </div>
  );
}

export default async function AccountSectionPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const path = (await params).section?.join("/") ?? "";
  if (path === "documents") return <DocumentsPage />;
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
