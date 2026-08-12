"use server";


import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/auth/guards";
import {
  staffActionError,
  staffActionSuccess,
  type StaffActionState,
} from "@/lib/staff/actionState";
import { artworkReviewSchema, statusTransitionSchema } from "@/lib/staff/schema";
import { createAdminClient } from "@/lib/supabase/admin";

async function callRpc(client: unknown, name: string, args: Record<string, unknown>) {
  return (client as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);
}

export async function transitionOrderAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  void _state;
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
  const { error } = await callRpc(context.supabase, "staff_transition_order", {
    p_order_id: parsed.data.orderId,
    p_to_status: parsed.data.toStatus,
    p_customer_message: parsed.data.customerMessage ?? null,
    p_internal_note: parsed.data.internalNote ?? null,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) {
    const messages: Array<[RegExp, string]> = [
      [/INVALID_STATUS_TRANSITION/, "That status change is not allowed from the current stage."],
      [/VERIFIED_PAYMENT_REQUIRED/, "Full verified payment is required before production approval."],
      [/ARTWORK_APPROVAL_REQUIRED/, "Approve every required artwork file before production."],
      [/FOUNDER_APPROVAL_REQUIRED/, "Founder approval is required for cancellation or refunds."],
      [/REASON_REQUIRED/, "Add a reason for this status change."],
      [/CANCELLATION_PENDING/, "This order is on hold pending the Founder’s cancellation decision."],
      [/INVALID_HOLD_RESUME/, "Resume an on-hold order only to its saved prior stage."],
    ];
    return staffActionError(messages.find(([pattern]) => pattern.test(error.message))?.[1] ?? "The status could not be updated.");
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Order status updated.");
}

export async function reviewArtworkAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("review_artwork");
  const parsed = artworkReviewSchema.safeParse({
    fileId: formData.get("fileId"),
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return staffActionError("Add a valid artwork decision and reason.");
  const { error } = await callRpc(context.supabase, "review_artwork_file", {
    p_file_id: parsed.data.fileId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) {
    if (/ARTWORK_SCAN_REQUIRED/.test(error.message)) {
      return staffActionError("Artwork cannot be approved until its malware scan is clean or not required.");
    }
    return staffActionError("Artwork review could not be saved.");
  }
  revalidatePath("/artwork-review");
  revalidatePath("/orders");
  return staffActionSuccess("Artwork decision saved.");
}

export async function setStaffActiveAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_staff");
  const parsed = z.object({ userId: z.string().uuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Invalid staff account update.");
  const active = parsed.data.active === "true";
  const { error } = await callRpc(context.supabase, "set_staff_active", {
    p_user_id: parsed.data.userId,
    p_active: active,
  });
  if (error) {
    const message = /CANNOT_DISABLE_SELF/.test(error.message)
      ? "The active Founder cannot disable their own account."
      : /LAST_FOUNDER_REQUIRED/.test(error.message)
        ? "At least one active Founder account must remain."
        : /STAFF_(?:MEMBER|PRINCIPAL)_NOT_FOUND/.test(error.message)
          ? "The staff account is incomplete or no longer exists."
          : "Staff access could not be updated.";
    return staffActionError(message);
  }
  revalidatePath("/staff-management");
  return staffActionSuccess(active ? "Staff access restored." : "Staff access disabled.");
}

export async function createDiscountCodeAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_discounts");
  const parsed = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
    description: z.string().trim().max(300).optional(),
    kind: z.enum(["percentage", "fixed"]),
    value: z.coerce.number().positive(),
    minimumSubtotalRupees: z.coerce.number().min(0).default(0),
    maximumDiscountRupees: z.coerce.number().positive().optional(),
    maximumRedemptions: z.coerce.number().int().positive().optional(),
    perCustomer: z.coerce.number().int().positive().default(1),
    endsAt: z.string().optional(),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Check the discount-code fields.");
  if (parsed.data.kind === "percentage" && parsed.data.value > 100) return staffActionError("Percentage discount cannot exceed 100%.");
  const admin = createAdminClient();
  const result = await admin.from("discount_codes").insert({
    code: parsed.data.code,
    description: parsed.data.description || null,
    kind: parsed.data.kind,
    percentage_basis_points: parsed.data.kind === "percentage" ? Math.round(parsed.data.value * 100) : null,
    fixed_amount_paise: parsed.data.kind === "fixed" ? Math.round(parsed.data.value * 100) : null,
    maximum_discount_paise: parsed.data.maximumDiscountRupees ? Math.round(parsed.data.maximumDiscountRupees * 100) : null,
    minimum_subtotal_paise: Math.round(parsed.data.minimumSubtotalRupees * 100),
    maximum_redemptions: parsed.data.maximumRedemptions ?? null,
    maximum_redemptions_per_customer: parsed.data.perCustomer,
    ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
    created_by: context.user.id,
  });
  if (result.error) return staffActionError(result.error.code === "23505" ? "That discount code already exists." : "Discount code could not be created.");
  revalidatePath("/discounts");
  return staffActionSuccess("Discount code created.");
}

export async function requestOrderCancellationAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const parsed = z.object({
    orderId: z.string().uuid(),
    orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/),
    reason: z.string().trim().min(3).max(1000),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Add a clear cancellation reason.");
  const { error } = await callRpc(context.supabase, "request_order_cancellation", { p_order_id: parsed.data.orderId, p_reason: parsed.data.reason });
  if (error) return staffActionError(/CANCELLATION_ALREADY_PENDING/.test(error.message) ? "A cancellation request is already pending." : /CANCELLATION_NOT_AVAILABLE/.test(error.message) ? "Cancellation is not available from this order stage." : "Cancellation request could not be created.");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Cancellation sent to Founder for approval.");
}

export async function decideOrderCancellationAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_refunds");
  const parsed = z.object({
    requestId: z.string().uuid(),
    orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/),
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).optional(),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Check the cancellation decision.");
  const { error } = await callRpc(context.supabase, "decide_order_cancellation", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.decision === "approve",
    p_note: parsed.data.note || null,
  });
  if (error) return staffActionError(/STALE_CANCELLATION_REQUEST/.test(error.message) ? "This cancellation request is stale because the order is no longer on its requested hold." : "Cancellation decision could not be saved.");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  revalidatePath("/orders");
  return staffActionSuccess(parsed.data.decision === "approve" ? "Order cancelled. Refund workflow is now available." : "Cancellation request rejected.");
}

export async function recordOrderRefundAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_refunds");
  const parsed = z.object({
    orderId: z.string().uuid(), orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/),
    action: z.enum(["initiate", "complete"]), reference: z.string().trim().min(3).max(200), reason: z.string().trim().min(3).max(1000),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Add a refund reference and reason.");
  const { error } = await callRpc(context.supabase, "record_order_refund", { p_order_id: parsed.data.orderId, p_complete: parsed.data.action === "complete", p_reference: parsed.data.reference, p_reason: parsed.data.reason });
  if (error) return staffActionError(parsed.data.action === "complete" ? "Refund completion could not be recorded." : "Refund could not be initiated.");
  revalidatePath(`/orders/${parsed.data.orderNumber}`); revalidatePath("/orders");
  return staffActionSuccess(parsed.data.action === "complete" ? "Refund completed and recorded." : "Refund marked pending with provider reference.");
}

export async function recheckCheckoutPaymentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const attemptId = z.string().uuid().safeParse(formData.get("attemptId"));
  if (!attemptId.success) return staffActionError("Payment attempt is invalid.");
  const { reconcileCheckoutPayuAttempt } = await import("@/lib/domain/payments/processPayuEvent");
  const { finishSystemJobRun, startSystemJobRun } = await import("@/lib/jobs/health");
  const runId = await startSystemJobRun({
    jobName: "payu_reconciliation",
    triggerSource: "staff",
    triggerUserId: context.user.id,
  });
  try {
    const result = await reconcileCheckoutPayuAttempt(attemptId.data);
    await finishSystemJobRun({ runId, status: "completed", summary: { checked: 1, outcome: result.outcome } });
    revalidatePath("/orders");
    if (result.orderNumber) revalidatePath(`/orders/${result.orderNumber}`);
    return staffActionSuccess(
      result.outcome === "success"
        ? `Payment verified${result.orderNumber ? `; order ${result.orderNumber} is available` : ""}.`
        : result.outcome === "failure"
          ? "PayU confirmed that this payment failed."
          : "PayU still reports this payment as pending.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    await finishSystemJobRun({ runId, status: "failed", error: message, summary: { checked: 1, errors: 1 } });
    return staffActionError(`Payment could not be rechecked: ${message}`);
  }
}

export async function retryIntegrationJobAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const jobId = z.string().uuid().safeParse(formData.get("jobId"));
  if (!jobId.success) return staffActionError("Integration job is invalid.");
  const { data, error } = await callRpc(context.supabase, "retry_integration_job", { p_job_id: jobId.data });
  if (error || !data) return staffActionError("The job could not be queued for retry.");
  revalidatePath("/orders");
  return staffActionSuccess("Integration job queued for retry.");
}

export async function processIntegrationJobsNowAction(
  _state: StaffActionState,
  _formData: FormData,
): Promise<StaffActionState> {
  void _state;
  void _formData;
  const context = await requireStaffPermission("change_order_status");
  const { processIntegrationJobs } = await import("@/lib/jobs/service");
  const { finishSystemJobRun, startSystemJobRun } = await import("@/lib/jobs/health");
  const runId = await startSystemJobRun({
    jobName: "integration_jobs",
    triggerSource: "staff",
    triggerUserId: context.user.id,
  });
  try {
    const summary = await processIntegrationJobs({ batchSize: 25, workerId: `staff:${context.user.id}:${crypto.randomUUID()}` });
    await finishSystemJobRun({
      runId,
      status: summary.dead > 0 ? "failed" : "completed",
      summary,
      error: summary.dead > 0
        ? `${summary.dead} integration job(s) permanently failed`
        : null,
    });
    revalidatePath("/orders");
    const message = `Processed ${summary.claimed} job(s): ${summary.completed} completed, ${summary.retry} retrying, ${summary.dead} permanently failed.`;
    return summary.dead > 0 ? staffActionError(message) : staffActionSuccess(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job processing failed";
    await finishSystemJobRun({ runId, status: "failed", error: message });
    return staffActionError(`Integration jobs could not be processed: ${message}`);
  }
}
