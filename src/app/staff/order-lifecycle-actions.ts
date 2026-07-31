"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireStaffPermission } from "@/lib/auth/guards";
import { getServerEnvironment } from "@/lib/config/env";
import { createApprovalToken } from "@/lib/domain/approvals/approval";
import {
  approvalRequestSchema,
  fileReviewSchema,
  revokeApprovalSchema,
  shipmentCreateSchema,
  shipmentUpdateSchema,
} from "@/lib/domain/order-lifecycle/schema";
import { staffActionError, staffActionSuccess, type StaffActionState } from "@/lib/staff/actionState";

function rpc(client: unknown, name: string, args: Record<string, unknown>) {
  return (client as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);
}

function dateOrNull(value: string | undefined) {
  return value ? value : null;
}

export async function createApprovalRequestAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_approvals");
  const parsed = approvalRequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError(parsed.error.issues[0]?.message ?? "Check the approval request.");

  const external = parsed.data.recipientType === "external";
  const token = external ? createApprovalToken() : null;
  const { data, error } = await rpc(context.supabase, "staff_create_approval_request", {
    p_order_id: parsed.data.orderId,
    p_design_version_id: parsed.data.designVersionId,
    p_approval_pdf_file_id: parsed.data.approvalPdfFileId,
    p_requested_from_user_id: external ? null : parsed.data.requestedFromUserId,
    p_requested_from_email: external ? parsed.data.requestedFromEmail : null,
    p_secure_token_hash: token?.hash ?? null,
    p_expires_at: parsed.data.expiresAt,
  });
  if (error || !data) return staffActionError(error?.message ?? "The approval request could not be created.");

  if (external && token) {
    const approvalId = String(data);
    const revokeUndeliveredRequest = async (reason: string) => {
      await rpc(context.supabase, "staff_revoke_approval", {
        p_approval_id: approvalId,
        p_reason: reason,
      });
    };
    const env = getServerEnvironment();
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      await revokeUndeliveredRequest("External approval email was not configured; request automatically revoked.");
      revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
      return staffActionError("External approval email is not configured. The unusable request was revoked automatically.");
    }
    const approvalUrl = new URL(`/approve/${token.token}`, env.NEXT_PUBLIC_APP_URL).toString();
    const safeUrl = approvalUrl.replaceAll("&", "&amp;");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: parsed.data.requestedFromEmail,
      subject: `Artwork approval requested for ${parsed.data.orderNumber}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#15212b"><h1 style="font-size:22px">Artwork approval requested</h1><p>Garmops has prepared an immutable approval document for order <strong>${parsed.data.orderNumber}</strong>.</p><p>Review the PDF and either approve the exact version or request changes using the secure link below.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#16212b;color:white;padding:12px 20px;border-radius:999px;text-decoration:none">Review approval document</a></p><p style="font-size:12px;color:#666">This link is private, time-limited and applies only to the attached artwork version. Do not forward it.</p></div>`,
    });
    if (emailError) {
      await revokeUndeliveredRequest("External approval email delivery failed; request automatically revoked.");
      revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
      return staffActionError("The external email could not be delivered. The unusable request was revoked automatically.");
    }
  }

  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess(external ? "Secure external approval request sent." : "Company approver was notified.");
}

export async function revokeApprovalAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_approvals");
  const parsed = revokeApprovalSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("A revocation reason is required.");
  const { data, error } = await rpc(context.supabase, "staff_revoke_approval", {
    p_approval_id: parsed.data.approvalId,
    p_reason: parsed.data.reason,
  });
  if (error || !data) return staffActionError(error?.message ?? "Approval could not be revoked.");
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Approval request revoked. The secure link can no longer be used.");
}

export async function reviewEvidenceFileAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = fileReviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Select a decision and provide a review note.");
  const permission = formData.get("kind") === "qc_photo" ? "upload_qc_evidence" : formData.get("kind") === "approval_pdf" ? "manage_approvals" : "manage_shipments";
  const context = await requireStaffPermission(permission);
  const { data, error } = await rpc(context.supabase, "review_file_scan", {
    p_file_id: parsed.data.fileId,
    p_scan_status: parsed.data.scanStatus,
    p_review_note: parsed.data.reviewNote,
  });
  if (error || !data) return staffActionError("The file review could not be recorded.");
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess(parsed.data.scanStatus === "clean" ? "File cleared for controlled use." : "File rejected and blocked from download.");
}

export async function createShipmentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_shipments");
  const parsed = shipmentCreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError(parsed.error.issues[0]?.message ?? "Check the shipment details.");
  const { data, error } = await rpc(context.supabase, "staff_create_shipment", {
    p_order_id: parsed.data.orderId,
    p_carrier: parsed.data.carrier ?? null,
    p_tracking_number: parsed.data.trackingNumber ?? null,
    p_tracking_url: parsed.data.trackingUrl ?? null,
    p_package_count: parsed.data.packageCount ?? null,
    p_estimated_delivery_at: dateOrNull(parsed.data.estimatedDeliveryAt),
    p_customer_visible_note: parsed.data.customerVisibleNote ?? null,
  });
  if (error || !data) return staffActionError(error?.message ?? "Shipment could not be created.");
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Shipment record created. Add a dispatch event when the package leaves.");
}

export async function updateShipmentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_shipments");
  const parsed = shipmentUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError(parsed.error.issues[0]?.message ?? "Check the shipment update.");
  const { data, error } = await rpc(context.supabase, "staff_update_shipment", {
    p_shipment_id: parsed.data.shipmentId,
    p_status: parsed.data.status,
    p_carrier: parsed.data.carrier ?? null,
    p_tracking_number: parsed.data.trackingNumber ?? null,
    p_tracking_url: parsed.data.trackingUrl ?? null,
    p_package_count: parsed.data.packageCount ?? null,
    p_estimated_delivery_at: dateOrNull(parsed.data.estimatedDeliveryAt),
    p_customer_visible_note: parsed.data.customerVisibleNote ?? null,
    p_event_location: parsed.data.eventLocation ?? null,
    p_internal_note: parsed.data.internalNote ?? null,
  });
  if (error || !data) return staffActionError(error?.message ?? "Shipment update could not be saved.");
  revalidatePath(`/staff/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Shipment status and tracking history updated.");
}
