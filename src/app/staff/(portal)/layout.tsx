import PortalShell from "@/components/portal/PortalShell";
import { requireStaff } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/staff/orders", label: "Orders" },
];

export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, staff, supabase } = await requireStaff();
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
