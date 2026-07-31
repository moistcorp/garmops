"use server";

import { revalidatePath } from "next/cache";

import { requireOrganizationMember } from "@/lib/auth/guards";
import {
  staffActionError,
  staffActionSuccess,
  type StaffActionState,
} from "@/lib/staff/actionState";
import { customerReplySchema } from "@/lib/staff/schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addCustomerOrderReplyAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = customerReplySchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    body: formData.get("body"),
  });
  if (!parsed.success) return staffActionError("Write a reply before sending.");

  const context = await requireOrganizationMember(
    `/account/orders/${parsed.data.orderNumber}`,
  );
  const { data: order, error: orderError } = await context.supabase
    .from("orders")
    .select("id, organization_id")
    .eq("id", parsed.data.orderId)
    .eq("order_number", parsed.data.orderNumber)
    .eq("organization_id", context.membership.organization_id)
    .maybeSingle();
  if (orderError || !order) return staffActionError("Order access could not be verified.");

  const { data: comment, error } = await context.supabase
    .from("order_comments")
    .insert({
      order_id: order.id,
      author_user_id: context.user.id,
      visibility: "customer",
      body: parsed.data.body,
      action_required: false,
    })
    .select("id")
    .single();
  if (error || !comment) return staffActionError("Your reply could not be sent.");

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_user_id: context.user.id,
    actor_type: "customer",
    action: "order.customer_reply_added",
    target_type: "order_comment",
    target_id: comment.id,
    organization_id: order.organization_id,
    order_id: order.id,
    after_state: { visibility: "customer" },
  });

  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Reply sent to the Garmops team.");
}
