import PortalShell from "@/components/portal/PortalShell";
import { requireStaffMfa } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/orders", label: "Orders" },
  { href: "/staff/customers", label: "Customers" },
  { href: "/staff/invoices", label: "Invoices" },
  { href: "/staff/approvals", label: "Approvals" },
  { href: "/staff/shipments", label: "Shipments" },
  { href: "/staff/files", label: "Files" },
  { href: "/staff/audit", label: "Audit" },
  { href: "/staff/settings/team", label: "Team" },
  { href: "/staff/settings/security", label: "Security" },
  { href: "/staff/settings/integrations", label: "Integrations" },
];

export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, staff, supabase } = await requireStaffMfa();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  return (
    <PortalShell
      kind="Staff operations"
      title="Operations control"
      subtitle={`${profile?.first_name ?? "Staff"} ${profile?.last_name ?? ""} · ${staff.role.replaceAll("_", " ")}`}
      identity={user.email ?? user.id}
      nav={nav}
    >
      {children}
    </PortalShell>
  );
}
