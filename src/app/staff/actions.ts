"use server";

import { revalidatePath } from "next/cache";
import { requireStaffPermission } from "@/lib/auth/guards";
import { medusaRequest } from "@/lib/medusa/client";
import { founderRefundRequest } from "@/lib/staff/refund";
import { staffActionError, staffActionSuccess, type StaffActionState } from "@/lib/staff/actionState";
import { artworkReviewSchema, statusTransitionSchema } from "@/lib/staff/schema";

export async function transitionOrderAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requireStaffPermission("change_order_status");
  const parsed = statusTransitionSchema.safeParse({ orderId: formData.get("orderId"), orderNumber: formData.get("orderNumber"), toStatus: formData.get("toStatus"), reason: formData.get("reason") || undefined });
  if (!parsed.success) return staffActionError("Check the status update fields.");
  try { await medusaRequest(`/foundry/orders/${encodeURIComponent(parsed.data.orderId)}/status`, { method: "POST", actor: "staff", body: { status: parsed.data.toStatus, reason: parsed.data.reason } }); revalidatePath("/orders"); revalidatePath(`/orders/${parsed.data.orderNumber}`); return staffActionSuccess("Order status updated."); }
  catch { return staffActionError("That status change is not allowed from the current stage."); }
}

export async function reviewArtworkAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requireStaffPermission("review_artwork");
  const parsed = artworkReviewSchema.safeParse({ fileId: formData.get("fileId"), decision: formData.get("decision"), reason: formData.get("reason") || undefined });
  if (!parsed.success) return staffActionError("Add a valid artwork decision and reason.");
  try { await medusaRequest(`/foundry/orders/${encodeURIComponent(String(formData.get("orderId") ?? ""))}/artwork-review`, { method: "POST", actor: "staff", body: { fileId: parsed.data.fileId, decision: parsed.data.decision } }); revalidatePath("/artwork-review"); revalidatePath("/orders"); return staffActionSuccess("Artwork decision saved."); }
  catch { return staffActionError("Artwork review could not be saved."); }
}

export async function requestRefundAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requireStaffPermission("manage_refunds");
  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  if (!paymentId || !orderNumber) return staffActionError("A refundable payment could not be identified.");
  try {
    const request = founderRefundRequest(paymentId, crypto.randomUUID());
    await medusaRequest(request.path, { method: "POST", actor: "staff", body: request.body });
    revalidatePath(`/orders/${orderNumber}`);
    return staffActionSuccess("Refund requested.");
  } catch { return staffActionError("The refund could not be requested."); }
}

export async function setStaffActiveAction(): Promise<StaffActionState> { return staffActionError("Staff accounts are provisioned from the Medusa backend CLI."); }
export async function requestOrderCancellationAction(): Promise<StaffActionState> { return staffActionError("Cancellation is not present in the Stage 3 backend contract."); }
export async function decideOrderCancellationAction(): Promise<StaffActionState> { return staffActionError("Cancellation is not present in the Stage 3 backend contract."); }

export async function recheckCheckoutPaymentAction(): Promise<StaffActionState> { return staffActionError("Payment reconciliation runs in the Medusa worker."); }
export async function retryIntegrationJobAction(): Promise<StaffActionState> { return staffActionError("Integration job recovery runs in the Medusa worker."); }
export async function processIntegrationJobsNowAction(): Promise<StaffActionState> { return staffActionError("Integration job processing runs in the Medusa worker."); }
