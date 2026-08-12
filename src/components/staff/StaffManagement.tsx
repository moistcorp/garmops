import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import StaffManagementForms from "@/components/staff/StaffManagementForms";
import { requireStaffPermission } from "@/lib/auth/guards";
import type { Tables } from "@/types/database.generated";
type StaffRow = Pick<Tables<"staff_members">, "user_id" | "email" | "role" | "active" | "mfa_enrolled_at" | "last_staff_login_at" | "created_at"> & { profiles: { first_name: string; last_name: string } | Array<{ first_name: string; last_name: string }> | null };
export default async function StaffManagement() {
  const { supabase } = await requireStaffPermission("manage_staff");
  const result = await supabase.from("staff_members").select("user_id, email, role, active, mfa_enrolled_at, last_staff_login_at, created_at, profiles(first_name,last_name)").order("created_at");
  const staff = (result.data ?? []) as unknown as StaffRow[];
  return <div className="space-y-5"><TechpackPageHeader eyebrow="Founder" reference="Access control" title="Staff management" description="Manage existing staff access. New staff accounts are provisioned outside this application and must complete TOTP before Foundry access." /><section className="techpack-surface rounded border p-5"><h2 className="font-semibold">Active directory</h2><div className="mt-4 divide-y divide-black/10">{staff.map((member) => { const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles; return <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{profile?.first_name} {profile?.last_name}</p><p className="text-xs text-black/45">{member.email} · {member.role} · MFA {member.mfa_enrolled_at ? "enrolled" : "pending"}</p></div><StaffManagementForms userId={member.user_id} active={member.active} /></div>; })}</div></section></div>;
}
