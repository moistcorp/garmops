import PortalShell from "@/components/portal/PortalShell";
import { requireOrganizationMember } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/designs", label: "Designs" },
  { href: "/account/documents", label: "Documents" },
  { href: "/account/company", label: "Company" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/settings/profile", label: "Profile" },
  { href: "/account/settings/security", label: "Security" },
];

export default async function AccountPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase, membership } = await requireOrganizationMember("/account");
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single(),
    supabase
      .from("organizations")
      .select("display_name")
      .eq("id", membership.organization_id)
      .single(),
  ]);
  const displayName = organization?.display_name ?? "Company workspace";

  return (
    <PortalShell
      kind="Customer workspace"
      title={displayName}
      subtitle={`${profile?.first_name ?? "Customer"} ${profile?.last_name ?? ""} · ${membership.role}`}
      identity={user.email ?? user.id}
      nav={nav}
    >
      {children}
    </PortalShell>
  );
}
