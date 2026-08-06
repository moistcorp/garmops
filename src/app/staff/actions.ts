"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/auth/guards";
import { customerAppUrl, staffAppUrl } from "@/lib/config/appSurface";
import { getServerEnvironment } from "@/lib/config/env";
import { calculateTaxPaise } from "@/lib/tax";
import { configuredGstRateBasisPoints } from "@/lib/tax.server";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "@/lib/orders/pricing";
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
      [/SHIPPING_PAYMENT_REQUIRED/, "Record or waive the shipping payment before dispatch."],
      [/FOUNDER_APPROVAL_REQUIRED/, "Founder approval is required for cancellation or refunds."],
      [/REASON_REQUIRED/, "Add a reason for this status change."],
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
  if (error) return staffActionError("Artwork review could not be saved.");
  revalidatePath("/artwork-review");
  revalidatePath("/orders");
  return staffActionSuccess("Artwork decision saved.");
}

export async function updateOrderConfigurationAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("edit_order_configuration");
  const orderId = z.string().uuid().safeParse(formData.get("orderId"));
  const orderNumber = z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/).safeParse(formData.get("orderNumber"));
  const reason = z.string().trim().min(3).max(1000).safeParse(formData.get("reason"));
  let snapshot: unknown;
  try { snapshot = JSON.parse(String(formData.get("configuration") ?? "")); } catch { return staffActionError("Configuration JSON is invalid."); }
  if (!orderId.success || !orderNumber.success || !reason.success || !snapshot || typeof snapshot !== "object") {
    return staffActionError("Check the configuration and reason.");
  }
  const { error } = await callRpc(context.supabase, "update_order_configuration", {
    p_order_id: orderId.data,
    p_next_snapshot: snapshot,
    p_reason: reason.data,
  });
  if (error) {
    const message = /GARMENT_TYPE_IMMUTABLE/.test(error.message)
      ? "Garment type cannot be changed after payment. Cancel and place a new order."
      : /ORDER_QUANTITY_IMMUTABLE/.test(error.message)
        ? "Order quantity cannot be changed after payment. Cancel and place a new order."
        : /PRINTING_TECHNIQUE_IMMUTABLE/.test(error.message)
          ? "Printing technique cannot be changed after payment. Cancel and place a new order."
          : /ORDER_LINE_(?:STRUCTURE|IDENTITY)_IMMUTABLE/.test(error.message)
            ? "Cart lines and their paid design identities cannot be added, removed, or replaced after payment."
            : /LOCKED/.test(error.message)
              ? "This order is locked against configuration edits."
              : "Configuration changes could not be saved.";
    return staffActionError(message);
  }
  revalidatePath(`/orders/${orderNumber.data}`);
  return staffActionSuccess("Configuration revision saved with an audit trail.");
}

export async function setShippingPaymentLinkAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_shipping_payments");
  const parsed = z.object({
    orderId: z.string().uuid(),
    orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/),
    amountRupees: z.coerce.number().positive().max(10_000_000),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Enter a valid shipping amount.");
  const { error } = await callRpc(context.supabase, "create_shipping_payment_attempt", {
    p_order_id: parsed.data.orderId,
    p_amount_paise: Math.round(parsed.data.amountRupees * 100),
  });
  if (error) {
    const message = /SHIPPING_PAYMENT_IN_PROGRESS/.test(error.message)
      ? "A shipping payment is already in progress. Reconcile it before replacing the quote."
      : /SHIPPING_ALREADY_PAID/.test(error.message)
        ? "Shipping has already been paid."
        : /SHIPPING_ALREADY_SETTLED/.test(error.message)
          ? "Shipping is already waived or marked not required."
          : /ORDER_NOT_PAYABLE/.test(error.message)
            ? "This order cannot receive a new shipping charge."
            : "The secure shipping payment could not be created.";
    return staffActionError(message);
  }
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  revalidatePath(`/account/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Secure PayU shipping payment created for the customer.");
}

export async function markShippingPaidAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_refunds");
  const parsed = z.object({
    orderId: z.string().uuid(),
    orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/),
    reference: z.string().trim().min(3).max(200),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Add the verified PayU or bank reference.");
  const { error } = await callRpc(context.supabase, "mark_shipping_payment_received", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.reference,
  });
  if (error) {
    const message = /SHIPPING_PAYMENT_IN_PROGRESS/.test(error.message)
      ? "A PayU shipping payment is already in progress. Reconcile it before recording a manual payment."
      : /SHIPPING_ALREADY_PAID/.test(error.message)
        ? "Shipping has already been marked paid."
        : "Shipping payment could not be marked received.";
    return staffActionError(message);
  }
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Shipping payment recorded.");
}

const inviteSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["founder", "operations"]),
});

export async function inviteStaffAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_staff");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Check the staff invitation details.");
  const admin = createAdminClient();
  const { data: existing } = await admin.from("account_principals").select("account_type").eq("normalized_email", parsed.data.email).maybeSingle();
  if (existing) return staffActionError("That email is already reserved as a customer or staff account.");

  const invite = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${staffAppUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName, account_type: "staff" },
  });
  const user = invite.data?.user;
  if (invite.error || !user) return staffActionError("The Supabase invitation could not be sent.");

  try {
    const now = new Date().toISOString();
    const profile = await admin.from("profiles").insert({ id: user.id, first_name: parsed.data.firstName, last_name: parsed.data.lastName });
    if (profile.error) throw new Error(profile.error.message);
    const principal = await admin.from("account_principals").insert({ user_id: user.id, normalized_email: parsed.data.email, account_type: "staff", active: true, created_by: context.user.id });
    if (principal.error) throw new Error(principal.error.message);
    const staff = await admin.from("staff_members").insert({ user_id: user.id, email: parsed.data.email, role: parsed.data.role, active: true, must_use_mfa: true, invited_by: context.user.id, invited_at: now });
    if (staff.error) throw new Error(staff.error.message);
    await admin.from("staff_invitations").insert({ email: parsed.data.email, role: parsed.data.role, invited_by: context.user.id, auth_user_id: user.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  } catch {
    await admin.auth.admin.deleteUser(user.id);
    return staffActionError("The staff account could not be reserved safely. No account was kept.");
  }
  revalidatePath("/staff-management");
  return staffActionSuccess("Staff invitation sent. Foundry access will require TOTP setup.");
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

const quoteAddressSchema = z.object({
  country: z.literal("India"),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  zip: z.string().trim().regex(/^[1-9][0-9]{5}$/),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
});

const createStaffQuoteSchema = z.object({
  customerEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  customerName: z.string().trim().min(1).max(160),
  customerPhone: z.string().trim().regex(/^(?:\+91|91|0)?[6-9][0-9]{9}$/),
  configuration: z.string().min(2),
  sizeQuantities: z.string().min(2),
  deliveryType: z.enum(["rush", "standard", "flexible"]),
  billingEntity: z.string().trim().min(1).max(200),
  billingEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  billingGstin: z.string().trim().toUpperCase().optional(),
  billingAddressLine1: z.string(),
  billingAddressLine2: z.string().optional(),
  billingZip: z.string(),
  billingCity: z.string(),
  billingState: z.string(),
  shippingRecipientName: z.string().trim().min(1).max(160),
  shippingAddressLine1: z.string(),
  shippingAddressLine2: z.string().optional(),
  shippingZip: z.string(),
  shippingCity: z.string(),
  shippingState: z.string(),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0/, "").replace(/^91(?=[6-9]\d{9}$)/, "");
  return `+91${digits}`;
}

export async function createStaffQuoteAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("create_staff_quote");
  const parsed = createStaffQuoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Check the customer, specification, size, billing, and delivery fields.");

  let rawConfiguration: unknown;
  let rawSizes: unknown;
  try {
    rawConfiguration = JSON.parse(parsed.data.configuration);
    rawSizes = JSON.parse(parsed.data.sizeQuantities);
  } catch {
    return staffActionError("Configuration and size allocation must be valid JSON.");
  }
  const configuration = cloudDesignSnapshotSchema.safeParse(rawConfiguration);
  const sizeQuantities = z.record(z.string().min(1).max(20), z.number().int().min(0).max(1_000_000)).safeParse(rawSizes);
  if (!configuration.success) return staffActionError("The configurator snapshot is incomplete or invalid.");
  if (!sizeQuantities.success) return staffActionError("The size allocation must map each size to a whole-number quantity.");

  let priced: ReturnType<typeof priceCustomOrder>;
  try {
    priced = priceCustomOrder({ snapshot: configuration.data, sizeQuantities: sizeQuantities.data, deliveryType: parsed.data.deliveryType });
  } catch (error) {
    return staffActionError(error instanceof Error ? error.message : "The quotation could not be priced.");
  }

  const billingAddress = quoteAddressSchema.safeParse({
    country: "India",
    addressLine1: parsed.data.billingAddressLine1,
    addressLine2: parsed.data.billingAddressLine2 || undefined,
    zip: parsed.data.billingZip,
    city: parsed.data.billingCity,
    state: parsed.data.billingState,
  });
  const shippingAddress = quoteAddressSchema.safeParse({
    country: "India",
    addressLine1: parsed.data.shippingAddressLine1,
    addressLine2: parsed.data.shippingAddressLine2 || undefined,
    zip: parsed.data.shippingZip,
    city: parsed.data.shippingCity,
    state: parsed.data.shippingState,
  });
  if (!billingAddress.success || !shippingAddress.success) return staffActionError("Check the Indian billing and delivery addresses.");

  const gstin = parsed.data.billingGstin?.trim() || null;
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return staffActionError("GSTIN format is invalid.");
  }

  const admin = createAdminClient();
  const { data: existingPrincipal } = await admin.from("account_principals")
    .select("account_type")
    .eq("normalized_email", parsed.data.customerEmail)
    .maybeSingle();
  if (existingPrincipal?.account_type === "staff") return staffActionError("That email is reserved for Foundry staff and cannot receive a customer quotation.");

  const taxRateBasisPoints = configuredGstRateBasisPoints();
  const taxPaise = calculateTaxPaise(priced.subtotalPaise, taxRateBasisPoints);
  const totalPaise = priced.subtotalPaise + taxPaise;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const numberResult = await admin.rpc("next_number", { p_namespace: "quote", p_prefix: "EST" });
  if (numberResult.error || !numberResult.data) return staffActionError("Quote number could not be generated.");

  const configurationSnapshot = {
    schemaVersion: configuration.data.schemaVersion,
    design: configuration.data,
    sizeQuantities: sizeQuantities.data,
    deliveryType: parsed.data.deliveryType,
    commercialFieldsLockedAfterPayment: ["quantity", "garment", "printingTechnique"],
  };
  const billingSnapshot = {
    entity: parsed.data.billingEntity,
    email: parsed.data.billingEmail,
    gstin,
    address: billingAddress.data,
    business: gstin ? { legalBusinessName: parsed.data.billingEntity, gstin } : {},
  };
  const shippingSnapshot = {
    recipientName: parsed.data.shippingRecipientName,
    address: shippingAddress.data,
    pricing: "quoted_separately",
  };
  const result = await admin.from("staff_quotes").insert({
    quote_number: numberResult.data,
    created_by: context.user.id,
    customer_email: parsed.data.customerEmail,
    customer_name: parsed.data.customerName,
    customer_phone: normalizeIndianPhone(parsed.data.customerPhone),
    configuration_snapshot: configurationSnapshot,
    pricing_snapshot: {
      pricingVersion: CUSTOM_ORDER_PRICING_VERSION,
      gstRateBasisPoints: taxRateBasisPoints,
      items: [priced.item],
    },
    billing_snapshot: billingSnapshot,
    shipping_snapshot: shippingSnapshot,
    subtotal_paise: priced.subtotalPaise,
    discount_paise: 0,
    tax_paise: taxPaise,
    total_paise: totalPaise,
    payment_token_hash: tokenHash,
    expires_at: new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString(),
    status: "sent",
    sent_at: new Date().toISOString(),
  }).select("id, quote_number").single();
  if (result.error || !result.data) return staffActionError("Staff quotation could not be created.");

  const paymentUrl = `${customerAppUrl()}/quote/${encodeURIComponent(token)}`;
  const job = await admin.from("integration_jobs").insert({
    job_type: "send_staff_quote",
    deduplication_key: `staff-quote:${result.data.id}`,
    payload: { quoteId: result.data.id, quoteNumber: result.data.quote_number, customerEmail: parsed.data.customerEmail, paymentUrl },
  });
  revalidatePath("/quotes");
  if (job.error) return staffActionSuccess(`Quotation ${result.data.quote_number} created. Copy payment link: ${paymentUrl}`);
  return staffActionSuccess(`Quotation ${result.data.quote_number} created and queued for email. Payment link: ${paymentUrl}`);
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
  if (error) return staffActionError(/CANCELLATION_ALREADY_PENDING/.test(error.message) ? "A cancellation request is already pending." : "Cancellation request could not be created.");
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
  if (error) return staffActionError("Cancellation decision could not be saved.");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  revalidatePath("/orders");
  return staffActionSuccess(parsed.data.decision === "approve" ? "Order cancelled. Refund workflow is now available." : "Cancellation request rejected.");
}

export async function finalizeStaffQuoteOfflinePaymentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("manage_refunds");
  const parsed = z.object({
    quoteId: z.string().uuid(),
    quoteNumber: z.string().regex(/^EST-\d{4}-\d{6}$/),
    reference: z.string().trim().min(3).max(200),
    proofFileId: z.string().uuid(),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Add the bank reference and finalized payment proof.");
  const env = getServerEnvironment();
  const sellerSnapshot = {
    legalName: env.INVOICE_SELLER_LEGAL_NAME,
    gstin: env.INVOICE_SELLER_GSTIN,
    state: env.INVOICE_SELLER_STATE,
    address: env.INVOICE_SELLER_ADDRESS,
  };
  const { data, error } = await callRpc(context.supabase, "finalize_staff_quote_offline_payment", {
    p_quote_id: parsed.data.quoteId,
    p_reference: parsed.data.reference,
    p_proof_file_id: parsed.data.proofFileId,
    p_seller_snapshot: sellerSnapshot,
  });
  if (error) {
    const message = /CUSTOMER_ACCOUNT_REQUIRED/.test(error.message)
      ? "The quoted customer must create and verify their customer account first."
      : /PAYMENT_PROOF_REQUIRED/.test(error.message)
        ? "Upload and finalize payment proof before recording the bank payment."
        : "Offline payment could not be finalized.";
    return staffActionError(message);
  }
  const first = Array.isArray(data) ? data[0] : null;
  revalidatePath("/quotes");
  revalidatePath("/orders");
  return staffActionSuccess(`Offline payment verified${first?.order_number ? `; order ${first.order_number} created` : ""}.`);
}

export async function reopenOrderConfigurationAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("override_order_workflow");
  const parsed = z.object({ orderId: z.string().uuid(), orderNumber: z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/), reason: z.string().trim().min(3).max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return staffActionError("Add a clear reason to reopen this dispatched configuration.");
  const { error } = await callRpc(context.supabase, "reopen_order_configuration", { p_order_id: parsed.data.orderId, p_reason: parsed.data.reason });
  if (error) return staffActionError("Configuration could not be reopened.");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  return staffActionSuccess("Configuration reopened for one audited revision.");
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

export async function recheckCustomCheckoutPaymentAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const context = await requireStaffPermission("change_order_status");
  const attemptId = z.string().uuid().safeParse(formData.get("attemptId"));
  if (!attemptId.success) return staffActionError("Payment attempt is invalid.");
  const { reconcileCustomCheckoutPayuAttempt } = await import("@/lib/domain/payments/processPayuEvent");
  const { finishSystemJobRun, startSystemJobRun } = await import("@/lib/jobs/health");
  const runId = await startSystemJobRun({
    jobName: "payu_reconciliation",
    triggerSource: "staff",
    triggerUserId: context.user.id,
  });
  try {
    const result = await reconcileCustomCheckoutPayuAttempt(attemptId.data);
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
