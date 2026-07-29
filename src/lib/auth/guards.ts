import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/auth/redirects";
import type { StaffRole } from "@/lib/auth/constants";

export async function requireUser(next = "/account") {
  const supabase = await createClient();
  const [{ data: claimsData, error: claimsError }, { data: userData }] =
    await Promise.all([supabase.auth.getClaims(), supabase.auth.getUser()]);

  if (claimsError || !claimsData?.claims?.sub || !userData.user) {
    redirect(`/login?next=${encodeURIComponent(safeInternalPath(next))}`);
  }

  return { supabase, user: userData.user, claims: claimsData.claims };
}

export async function requireVerifiedUser(next = "/account") {
  const context = await requireUser(next);
  if (!context.user.email_confirmed_at) redirect("/verify-email");
  return context;
}

export async function requireOrganizationMember(next = "/account") {
  const context = await requireVerifiedUser(next);
  const { data, error } = await context.supabase
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) redirect("/auth/error?code=ACCOUNT_ACCESS_FAILED");
  if (!data) redirect("/account/onboarding");
  return { ...context, membership: data };
}

export async function requireOrganizationRole(
  organizationId: string,
  allowedRoles: Array<"owner" | "buyer" | "approver" | "finance" | "viewer">,
) {
  const context = await requireVerifiedUser("/account");
  const { data, error } = await context.supabase.rpc("has_organization_role", {
    p_organization_id: organizationId,
    p_allowed_roles: allowedRoles,
  });
  if (error || !data) redirect("/auth/error?code=ACCOUNT_ACCESS_DENIED");
  return context;
}

export async function requireStaffRecord(options?: { allowInvited?: boolean }) {
  const context = await requireVerifiedUser("/staff");
  const { data: staff, error } = await context.supabase
    .from("staff_members")
    .select(
      "user_id, role, team, active, must_use_mfa, invited_at, activated_at, deactivated_at",
    )
    .eq("user_id", context.user.id)
    .maybeSingle();

  const invited =
    Boolean(options?.allowInvited) &&
    staff &&
    !staff.active &&
    Boolean(staff.invited_at) &&
    !staff.activated_at &&
    !staff.deactivated_at;

  if (error || !staff || staff.deactivated_at || (!staff.active && !invited)) {
    redirect("/auth/error?code=STAFF_ACCESS_DENIED");
  }

  return { ...context, staff };
}

export async function requireStaff() {
  return requireStaffRecord();
}

export async function requireStaffMfa() {
  const context = await requireStaff();
  const { data, error } =
    await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) redirect("/auth/error?code=MFA_CHECK_FAILED");
  if (data.currentLevel !== "aal2") {
    redirect(data.nextLevel === "aal2" ? "/staff/mfa/challenge" : "/staff/mfa/enrol");
  }
  return context;
}

export async function requireStaffPermission(permission: string) {
  const context = await requireStaffMfa();
  const { data, error } = await context.supabase.rpc("staff_has_permission", {
    p_permission_name: permission,
  });
  if (error || !data) redirect("/auth/error?code=STAFF_PERMISSION_DENIED");
  return { ...context, role: context.staff.role as StaffRole };
}
