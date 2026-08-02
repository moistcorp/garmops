"use server";

import { revalidatePath } from "next/cache";
import { requireStaffPermission } from "@/lib/auth/guards";
import { staffActionError, staffActionSuccess, type StaffActionState } from "@/lib/staff/actionState";
import { statusTransitionSchema } from "@/lib/staff/schema";

export async function transitionOrderAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const parsed = statusTransitionSchema.safeParse({ orderId: formData.get("orderId"), orderNumber: formData.get("orderNumber"), toStatus: formData.get("toStatus"), customerMessage: formData.get("customerMessage") || undefined, reason: formData.get("reason") || undefined });
  if (!parsed.success) return staffActionError("Check the status update fields.");
  const { error } = await (context.supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("staff_transition_order", { p_order_id: parsed.data.orderId, p_to_status: parsed.data.toStatus, p_customer_message: parsed.data.customerMessage ?? null, p_internal_note: null, p_reason: parsed.data.reason ?? null });
  if (error) {
    if (error.message.includes("INVALID_STATUS_TRANSITION")) return staffActionError("That status change is not allowed from the current stage.");
    if (error.message.includes("VERIFIED_PAYMENT_REQUIRED")) return staffActionError("A verified payment is required before this stage.");
    return staffActionError("The status could not be updated.");
  }
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Order status updated.");
}
