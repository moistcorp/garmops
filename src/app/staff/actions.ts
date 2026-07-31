"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { z } from "zod";
import {
  STAFF_ROLES,
  actionError,
  actionSuccess,
  type AuthActionState,
} from "@/lib/auth/constants";
import { authCallbackUrl } from "@/lib/auth/redirects";
import { consumeAuthRateLimit } from "@/lib/auth/rateLimit";
import { requireStaffPermission } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerEnvironment } from "@/lib/config/env";
import {
  staffActionError,
  staffActionSuccess,
  type StaffActionState,
} from "@/lib/staff/actionState";
import {
  assignmentSchema,
  commentSchema,
  expectedDatesSchema,
  fileVisibilitySchema,
  prioritySchema,
  resolveActionSchema,
  statusTransitionSchema,
} from "@/lib/staff/schema";

const inviteSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  role: z.enum(STAFF_ROLES),
  team: z.string().trim().max(80),
});

export async function inviteStaffAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const context = await requireStaffPermission("manage_staff");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError(
      "Check the invitation details.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const rate = await consumeAuthRateLimit("staff_invite", parsed.data.email);
    if (!rate.allowed) return actionError("Invitation limit reached. Try again later.");
  } catch {
    return actionError("Staff invitations are temporarily unavailable.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: {
      redirectTo: authCallbackUrl("/reset-password?invite=1"),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });
  if (error || !data.user) {
    return actionError("We could not create that staff invitation.");
  }

  const { error: provisionError } = await context.supabase.rpc(
    "provision_staff_invitation",
    {
      p_user_id: data.user.id,
      p_first_name: parsed.data.firstName,
      p_last_name: parsed.data.lastName,
      p_role: parsed.data.role,
      p_team: parsed.data.team,
    },
  );
  if (provisionError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("We could not provision that staff member.");
  }

  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("Staff invitation email is not configured.");
  }
  const acceptUrl = new URL("/auth/callback", environment.NEXT_PUBLIC_APP_URL);
  acceptUrl.searchParams.set("token_hash", data.properties.hashed_token);
  acceptUrl.searchParams.set("type", "invite");
  acceptUrl.searchParams.set("next", "/reset-password?invite=1");
  const safeFirstName = parsed.data.firstName
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const safeAcceptUrl = acceptUrl.toString().replaceAll("&", "&amp;");
  const resend = new Resend(environment.RESEND_API_KEY);
  const { error: deliveryError } = await resend.emails.send({
    from: environment.RESEND_FROM_EMAIL,
    to: parsed.data.email,
    subject: "Your Garmops staff invitation",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
        <h1 style="font-size: 20px;">You have been invited to Garmops staff operations</h1>
        <p>Hi ${safeFirstName},</p>
        <p>Set your password using the secure, time-limited link below. Your staff access remains inactive until you enroll and verify an authenticator app.</p>
        <p style="margin: 28px 0;">
          <a href="${safeAcceptUrl}" style="background: #087f7b; color: white; padding: 12px 20px; border-radius: 999px; text-decoration: none;">Accept staff invitation</a>
        </p>
        <p style="font-size: 12px; color: #666666;">If you were not expecting this invitation, do not use or forward this link. Garmops will never ask for your password or authenticator code.</p>
      </div>
    `,
  });
  if (deliveryError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return actionError("We could not deliver that staff invitation.");
  }

  revalidatePath("/staff/settings/team");
  return actionSuccess("Invitation sent. Access remains inactive until TOTP MFA is verified.");
}

export async function deactivateStaffAction(formData: FormData) {
  const context = await requireStaffPermission("manage_staff");
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return;
  await context.supabase.rpc("deactivate_staff_member", {
    p_user_id: userId.data,
  });
  revalidatePath("/staff/settings/team");
}

export async function completeStaffMfaAction() {
  const supabase = await createClient();
  const [{ data: userData }, { data: assurance }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!userData.user || assurance?.currentLevel !== "aal2") {
    return { ok: false };
  }

  const { error: activationError } = await supabase.rpc("activate_invited_staff");
  if (activationError) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("active, deactivated_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!staff?.active || staff.deactivated_at) return { ok: false };
  }
  const { error } = await supabase.rpc("record_staff_login");
  return { ok: !error };
}


export async function retryInvoiceAction(formData: FormData) {
  const context = await requireStaffPermission("retry_invoice_job");
  const invoiceId = z.string().uuid().safeParse(formData.get("invoiceId"));
  if (!invoiceId.success) return;
  const { error } = await (context.supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)(
    "retry_invoice_integration_job",
    { p_invoice_id: invoiceId.data },
  );
  if (error) {
    console.error("Invoice retry request failed", {
      invoiceId: invoiceId.data,
      error: error.message,
    });
    return;
  }
  revalidatePath("/staff/invoices");
}

type StaffRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function staffRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  args: Record<string, unknown>,
) {
  return (supabase.rpc as unknown as StaffRpc)(name, args);
}

function mutationErrorMessage(message: string) {
  const known: Record<string, string> = {
    STAFF_PERMISSION_DENIED: "You do not have permission to make this change.",
    STATUS_ROLE_DENIED: "Your staff role cannot move the order to that stage.",
    INVALID_STATUS_TRANSITION: "That status change is not allowed from the current stage.",
    VERIFIED_PAYMENT_REQUIRED: "A verified payment is required before this stage.",
    APPROVAL_DOCUMENT_REQUIRED: "Upload and request the approval document before this stage.",
    APPROVED_ARTWORK_REQUIRED: "The current artwork version must be approved first.",
    SHIPMENT_REQUIRED: "Add shipment or carrier details before dispatching the order.",
    HIGH_IMPACT_PERMISSION_REQUIRED: "This high-impact change requires operations-admin approval.",
    CANCELLATION_REASON_REQUIRED: "A reason is required to cancel an order already in production.",
    REASSIGNMENT_REASON_REQUIRED: "A reassignment reason is required for priority orders.",
    ASSIGNEE_NOT_ACTIVE: "Select an active staff member.",
    PRIORITY_REASON_REQUIRED: "A reason is required for high or urgent priority.",
    EXPECTED_DATE_SEQUENCE_INVALID: "Expected dates must follow approval, production, QC, then dispatch order.",
    EXPECTED_DATE_BEFORE_ORDER: "Expected dates cannot be earlier than the order date.",
    ACTION_REQUEST_MUST_BE_CUSTOMER_VISIBLE: "Action requests must be customer-visible.",
    FILE_NOT_CLEARED_FOR_CUSTOMER: "This file cannot be shared until its safety review is complete.",
    VISIBILITY_REASON_REQUIRED: "Explain why the file visibility is changing.",
    PRIVATE_ORDER_FILE_CANNOT_BE_PUBLIC: "Private order files cannot be made permanently public.",
  };
  const code = Object.keys(known).find((entry) => message.includes(entry));
  return code ? known[code] : "The operation could not be completed. Refresh and try again.";
}

function revalidateStaffOrder(orderNumber: string) {
  revalidatePath("/staff");
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${orderNumber}`);
  revalidatePath(`/account/orders/${orderNumber}`);
}

export async function transitionOrderAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const parsed = statusTransitionSchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    toStatus: formData.get("toStatus"),
    customerMessage: formData.get("customerMessage") || undefined,
    internalNote: formData.get("internalNote") || undefined,
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return staffActionError("Check the status update fields.");

  const { error } = await staffRpc(context.supabase, "staff_transition_order", {
    p_order_id: parsed.data.orderId,
    p_to_status: parsed.data.toStatus,
    p_customer_message: parsed.data.customerMessage ?? null,
    p_internal_note: parsed.data.internalNote ?? null,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess("Order status updated.");
}

export async function assignOrderAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("assign_order");
  const parsed = assignmentSchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    assignedStaffUserId: formData.get("assignedStaffUserId") ?? "",
    assignedTeam: formData.get("assignedTeam") || undefined,
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return staffActionError("Check the assignment details.");

  const { error } = await staffRpc(context.supabase, "staff_assign_order", {
    p_order_id: parsed.data.orderId,
    p_assigned_staff_user_id: parsed.data.assignedStaffUserId || null,
    p_assigned_team: parsed.data.assignedTeam ?? null,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess("Assignment updated.");
}

export async function setOrderPriorityAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("set_order_priority");
  const parsed = prioritySchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    priority: formData.get("priority"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return staffActionError("Check the priority details.");

  const { error } = await staffRpc(context.supabase, "staff_set_order_priority", {
    p_order_id: parsed.data.orderId,
    p_priority: parsed.data.priority,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess("Priority updated.");
}

function formDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const trimmed = value.trim();
  const indiaLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00+05:30`
    : trimmed;
  const parsed = new Date(indiaLocal);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export async function setOrderDatesAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("set_expected_dates");
  const parsed = expectedDatesSchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    expectedApprovalAt: formDate(formData.get("expectedApprovalAt")),
    expectedProductionAt: formDate(formData.get("expectedProductionAt")),
    expectedQcAt: formDate(formData.get("expectedQcAt")),
    estimatedDispatchAt: formDate(formData.get("estimatedDispatchAt")),
  });
  if (!parsed.success) return staffActionError("Check the expected dates.");

  const { error } = await staffRpc(context.supabase, "staff_set_order_dates", {
    p_order_id: parsed.data.orderId,
    p_expected_approval_at: parsed.data.expectedApprovalAt || null,
    p_expected_production_at: parsed.data.expectedProductionAt || null,
    p_expected_qc_at: parsed.data.expectedQcAt || null,
    p_estimated_dispatch_at: parsed.data.estimatedDispatchAt || null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess("Expected dates updated.");
}

export async function addOrderCommentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const visibility = formData.get("visibility");
  const context = await requireStaffPermission(
    visibility === "staff_only" ? "add_internal_note" : "send_customer_update",
  );
  const parsed = commentSchema.safeParse({
    orderId: formData.get("orderId"),
    orderNumber: formData.get("orderNumber"),
    visibility,
    body: formData.get("body"),
    actionRequired: formData.get("actionRequired") === "on",
    actionType: formData.get("actionType") || undefined,
  });
  if (!parsed.success) return staffActionError("Write a valid note or customer update.");

  const { error } = await staffRpc(context.supabase, "staff_add_order_comment", {
    p_order_id: parsed.data.orderId,
    p_visibility: parsed.data.visibility,
    p_body: parsed.data.body,
    p_action_required: parsed.data.actionRequired,
    p_action_type: parsed.data.actionType ?? null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess(
    parsed.data.visibility === "customer"
      ? "Customer update published."
      : "Internal note added.",
  );
}

export async function resolveOrderActionRequestAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_action_requests");
  const parsed = resolveActionSchema.safeParse({
    commentId: formData.get("commentId"),
    orderNumber: formData.get("orderNumber"),
    resolutionNote: formData.get("resolutionNote") || undefined,
  });
  if (!parsed.success) return staffActionError("Check the action request.");

  const { error } = await staffRpc(context.supabase, "staff_resolve_order_action", {
    p_comment_id: parsed.data.commentId,
    p_resolution_note: parsed.data.resolutionNote ?? null,
  });
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  return staffActionSuccess("Action request resolved.");
}

export async function changeOrderFileVisibilityAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_file_visibility");
  const parsed = fileVisibilitySchema.safeParse({
    fileId: formData.get("fileId"),
    orderNumber: formData.get("orderNumber"),
    visibility: formData.get("visibility"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return staffActionError("Check the file visibility change.");

  const { error } = await staffRpc(
    context.supabase,
    "staff_change_order_file_visibility",
    {
      p_file_id: parsed.data.fileId,
      p_visibility: parsed.data.visibility,
      p_reason: parsed.data.reason,
    },
  );
  if (error) return staffActionError(mutationErrorMessage(error.message));

  revalidateStaffOrder(parsed.data.orderNumber);
  revalidatePath("/staff/files");
  return staffActionSuccess("File visibility updated.");
}
