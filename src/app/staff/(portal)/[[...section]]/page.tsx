import { notFound } from "next/navigation";
import { deactivateStaffAction } from "@/app/staff/actions";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import StaffInviteForm from "@/components/staff/StaffInviteForm";
import { requireStaffPermission } from "@/lib/auth/guards";

const sections: Record<string, { title: string; description: string }> = {
  "": { title: "Operations dashboard", description: "The MFA-protected operational overview for orders, approvals, production exceptions, and dispatch." },
  orders: { title: "All orders", description: "Cross-organization order operations will be connected here in the scheduled order phase." },
  customers: { title: "Customers", description: "Organization and customer account lookup belongs here." },
  invoices: { title: "Invoices", description: "Finance-authorized invoice operations belong here." },
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
        <p className="mb-6 mt-2 text-sm text-black/50">
          Invitations are inactive until the recipient sets a password and verifies TOTP MFA.
        </p>
        <StaffInviteForm />
      </section>
      <section className="liquid-glass-surface rounded-3xl border p-6">
        <h2 className="text-xl font-semibold">Staff access</h2>
        <div className="mt-5 space-y-3">
          {staff?.map((member) => {
            const profile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles;
            return (
              <div key={member.user_id} className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white/45 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="mt-1 text-xs text-black/40">
                    {member.role.replaceAll("_", " ")} · {member.active ? "active" : member.deactivated_at ? "deactivated" : "invited"}
                  </p>
                </div>
                {member.active && member.user_id !== user.id ? (
                  <form action={deactivateStaffAction}>
                    <input type="hidden" name="userId" value={member.user_id} />
                    <button className="text-xs font-medium text-red-700 hover:underline" type="submit">
                      Deactivate
                    </button>
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

export default async function StaffSectionPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const path = (await params).section?.join("/") ?? "";
  if (path === "settings/team") return <TeamSettings />;
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
