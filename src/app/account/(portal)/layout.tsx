import PortalShell from "@/components/portal/PortalShell";
import { requireCustomer } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

export const dynamic = "force-dynamic";

export default async function AccountPortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireCustomer("/account");
  const nav = [
    { href: "/account/orders", label: "Orders" },
    ...(isFeatureEnabled("CLOUD_DESIGNS_ENABLED") ? [{ href: "/account/designs", label: "Saved designs" }] : []),
    { href: "/account/billing", label: "Billing & addresses" },
    { href: "/account/privacy", label: "Privacy" },
  ];
  return <PortalShell kind="Customer workspace" title={user.first_name || "Customer"} subtitle="Your private Garmops account" identity={user.email || user.id} nav={nav}>{children}</PortalShell>;
}
