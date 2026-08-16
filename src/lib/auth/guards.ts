import "server-only";

import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirects";
import type { StaffPermission } from "@/lib/staff/permissions";
import { medusaRequest, clearMedusaToken } from "@/lib/medusa/client";
import type { MedusaApiError } from "@/lib/medusa/types";

export type MedusaIdentity = { id: string; email: string; first_name?: string; last_name?: string };
export type StaffIdentity = { id: string; email: string; name: string; role: "founder" | "operations" };

async function currentCustomer(): Promise<MedusaIdentity | null> {
  try {
    const response = await medusaRequest<{ customer?: MedusaIdentity }>("/store/customers/me", { actor: "customer" });
    return response.customer ?? null;
  } catch { return null; }
}

export async function requireUser(next = "/account") {
  const user = await currentCustomer();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeInternalPath(next))}`);
  return { user, claims: { sub: user.id }, medusa: medusaRequest };
}

export async function requireVerifiedUser(next = "/account") { return requireUser(next); }

export async function requireCustomer(next = "/account") {
  const context = await requireUser(next);
  return { ...context, account: { type: "customer" as const } };
}

export async function requireStaffRecord(options?: { allowMfaPending?: boolean; next?: string }) {
  const next = options?.next ?? "/orders";
  try {
    const result = await medusaRequest<{ staff: StaffIdentity; mfaRequired?: boolean }>(`/foundry/session${options?.allowMfaPending ? "?allowMfaPending=true" : ""}`, { actor: "staff" });
    if (!result.staff) throw new Error("No staff session");
    return { user: { id: result.staff.id, email: result.staff.email }, staff: result.staff, medusa: medusaRequest };
  } catch (error) {
    await clearMedusaToken("staff");
    const code = (error as MedusaApiError)?.status === 403 ? "STAFF_ACCESS_DENIED" : "UNAUTHENTICATED";
    redirect(`/login?next=${encodeURIComponent(safeInternalPath(next, "/orders"))}&error=${code}`);
  }
}

export async function requireStaff() { return requireStaffRecord(); }

export async function requireStaffPermission(permission: StaffPermission) {
  const context = await requireStaff();
  const allowed: Record<StaffPermission, boolean> = {
    view_all_orders: true,
    review_artwork: true,
    change_order_status: true,
    manage_refunds: context.staff.role === "founder",
    manage_staff: context.staff.role === "founder",
    manage_discounts: context.staff.role === "founder",
    view_raw_payments: context.staff.role === "founder",
  };
  if (!allowed[permission]) redirect("/auth/error?code=STAFF_PERMISSION_DENIED");
  return { ...context, role: context.staff.role };
}
