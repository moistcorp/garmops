import PortalShell from "@/components/portal/PortalShell";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

export const dynamic = "force-dynamic";

export default async function AccountPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership, supabase } = await requireOrganizationMember("/account");
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("display_name, legal_name")
      .eq("id", membership.organization_id)
      .maybeSingle(),
  ]);
  const nav = [
    { href: "/account/orders", label: "Orders" },
    ...(isFeatureEnabled("CLOUD_DESIGNS_ENABLED")
      ? [{ href: "/account/designs", label: "Saved designs" }]
      : []),
    { href: "/account/company", label: "Company details" },
  ];
  const customerName = `${profile?.first_name ?? "Customer"} ${profile?.last_name ?? ""}`.trim();

  return (
    <PortalShell
      kind="Customer workspace"
      title={organization?.display_name || organization?.legal_name || "Customer account"}
      subtitle={`${customerName} · ${membership.role.replaceAll("_", " ")}`}
      identity={user.email ?? user.id}
      nav={nav}
    >
      {children}
    </PortalShell>
  );
}
