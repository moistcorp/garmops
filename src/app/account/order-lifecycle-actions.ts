"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { createReorder } from "@/lib/domain/orders/reorder";
import { approvalResponseSchema, notificationIdSchema, reorderSchema } from "@/lib/domain/order-lifecycle/schema";
import { staffActionError, staffActionSuccess, type StaffActionState } from "@/lib/staff/actionState";

function rpc(client: unknown, name: string, args: Record<string, unknown> = {}) {
  return (client as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);
}

export async function respondApprovalAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = approvalResponseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Choose an approval decision.");
  const context = await requireOrganizationMember(`/account/orders/${parsed.data.orderNumber}`);
  const { data, error } = await rpc(context.supabase, "respond_order_approval", {
    p_approval_id: parsed.data.approvalId,
    p_decision: parsed.data.decision,
    p_response_note: parsed.data.responseNote ?? null,
  });
  if (error || !data) return staffActionError(error?.message ?? "Your approval response could not be recorded.");
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess(parsed.data.decision === "approved" ? "This exact artwork version is approved." : "Changes requested. The team has been notified.");
}

export async function markNotificationReadAction(formData: FormData) {
  const id = notificationIdSchema.safeParse(formData.get("notificationId"));
  if (!id.success) return;
  const context = await requireOrganizationMember("/account/notifications");
  await rpc(context.supabase, "mark_notification_read", { p_notification_id: id.data });
  revalidatePath("/account/notifications");
}

export async function markAllNotificationsReadAction() {
  const context = await requireOrganizationMember("/account/notifications");
  await rpc(context.supabase, "mark_all_notifications_read");
  revalidatePath("/account/notifications");
}

export async function createReorderAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = reorderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return staffActionError("Accept the reorder terms before continuing.");
  }

  let newOrderNumber: string;
  try {
    const context = await requireOrganizationMember(
      `/account/orders/${parsed.data.orderNumber}`,
    );
    const result = await createReorder({
      supabase: context.supabase,
      user: context.user,
      organizationId: context.membership.organization_id,
      sourceOrderNumber: parsed.data.orderNumber,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    newOrderNumber = result.orderNumber;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reorder could not be created.";
    const safeMessages = new Set([
      "Active buyer access is required",
      "Only delivered custom orders can be reordered",
      "Historical order data is incomplete",
      "Reorder design could not be created",
      "Reorder version could not be created",
      "Reorder could not be created",
    ]);
    return staffActionError(
      safeMessages.has(message)
        ? message
        : "The reorder could not be created. Refresh the page and try again.",
    );
  }

  redirect(`/account/orders/${encodeURIComponent(newOrderNumber)}`);
}
