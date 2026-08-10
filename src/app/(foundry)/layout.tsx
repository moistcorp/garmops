import PortalShell from "@/components/portal/PortalShell";
import { requireStaff } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function FoundryPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, staff, supabase } = await requireStaff();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();
  const nav = [
    { href: "/orders", label: "Orders" },
    { href: "/artwork-review", label: "Artwork review" },
    { href: "/payments", label: "Payments" },
    ...(staff.role === "founder"
      ? [
          { href: "/discounts", label: "Discounts" },
          { href: "/analytics", label: "Analytics" },
          { href: "/staff-management", label: "Staff" },
        ]
      : []),
  ];

  return (
    <PortalShell
      kind="Staff operations"
      title="Production workflow"
      subtitle={`${profile?.first_name ?? "Staff"} ${profile?.last_name ?? ""} · ${staff.role}`}
      identity={user.email ?? user.id}
      nav={nav}
    >
      {children}
    </PortalShell>
  );
}
