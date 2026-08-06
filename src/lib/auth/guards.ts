import "server-only";

import { redirect } from "next/navigation";
import { ensureCustomerAccount } from "@/lib/auth/ensurePersonalCustomerAccount";
import { safeInternalPath } from "@/lib/auth/redirects";
import type { StaffPermission } from "@/lib/staff/permissions";
import { createClient } from "@/lib/supabase/server";

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

export async function requireCustomer(next = "/account") {
  const context = await requireVerifiedUser(next);
  const { data: principal, error } = await context.supabase
    .from("account_principals")
    .select("account_type, active")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) redirect("/auth/error?code=ACCOUNT_ACCESS_FAILED");
  if (principal?.account_type === "staff") {
    await context.supabase.auth.signOut();
    redirect("/auth/error?code=CUSTOMER_ACCESS_DENIED");
  }
  if (!principal) {
    try {
      await ensureCustomerAccount(context.supabase);
    } catch {
      await context.supabase.auth.signOut();
      redirect("/auth/error?code=ACCOUNT_ACCESS_FAILED");
    }
  } else if (!principal.active) {
    await context.supabase.auth.signOut();
    redirect("/auth/error?code=ACCOUNT_ACCESS_DENIED");
  }

  return { ...context, account: { type: "customer" as const } };
}

export async function requireStaffRecord(options?: {
  allowMfaPending?: boolean;
  next?: string;
}) {
  const next = options?.next ?? "/orders";
  const context = await requireVerifiedUser(next);
  const { data, error } = await context.supabase.rpc("get_staff_access_context");
  const staff = data?.[0];

  if (error || !staff || !staff.active) {
    await context.supabase.auth.signOut();
    redirect("/auth/error?code=STAFF_ACCESS_DENIED");
  }
  if (
    staff.must_use_mfa &&
    !staff.mfa_satisfied &&
    !options?.allowMfaPending
  ) {
    redirect(`/settings/security?next=${encodeURIComponent(safeInternalPath(next, "/orders"))}`);
  }

  return { ...context, staff };
}

export async function requireStaff() {
  return requireStaffRecord();
}

export async function requireStaffPermission(permission: StaffPermission) {
  const context = await requireStaff();
  const { data, error } = await context.supabase.rpc("staff_has_permission", {
    p_permission: permission,
  });
  if (error || !data) redirect("/auth/error?code=STAFF_PERMISSION_DENIED");
  return { ...context, role: context.staff.role };
}
