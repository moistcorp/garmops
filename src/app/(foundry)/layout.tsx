import PortalShell from "@/components/portal/PortalShell";
import { requireStaff } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export default async function FoundryPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requireStaff();
  const nav = [{ href: "/orders", label: "Orders" }, { href: "/artwork-review", label: "Artwork review" }, { href: "/payments", label: "Payments" }, ...(staff.role === "founder" ? [{ href: "/staff-management", label: "Staff" }] : [])];
  return <PortalShell kind="Staff operations" title="Production workflow" subtitle={`${staff.name} · ${staff.role}`} identity={user.email} nav={nav}>{children}</PortalShell>;
}
