import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/lib/config/env";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colourRules";
import {
  getRequestedDeliveryDateError,
  RUSH_DELIVERY_SURCHARGE_PAISE,
} from "@/lib/configurator/delivery";
import { cloudDesignSnapshotSchema } from "@/lib/designs/schema";
import { currentCustomTermsEvidence } from "@/lib/orders/terms";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "./pricing";
import type { SubmitCustomOrderRequest } from "./schema";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

function adminClient(): AdminClient {
  return createAdminClient();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashOrderRequest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function phoneE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return `+91${national}`;
}

function addressSnapshot(
  address: SubmitCustomOrderRequest["billing"]["address"],
  contactName: string,
  phone: string,
): Json {
  return {
    contactName,
    phone: phoneE164(phone),
    line1: address.addressLine1,
    line2: address.addressLine2 ?? null,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    countryCode: "IN",
  };
}

function sellerSnapshot(): Json {
  const env = getServerEnvironment();
  return {
    legalName: env.INVOICE_SELLER_LEGAL_NAME,
    address: env.INVOICE_SELLER_ADDRESS,
    gstin: env.INVOICE_SELLER_GSTIN,
    state: env.INVOICE_SELLER_STATE,
    countryCode: "IN",
  };
}

type PreparedCheckout = {
  requestHash: string;
  payload: Json;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  discountCodeId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  expiresAt: string;
};

async function assertCustomerPrincipal(user: User): Promise<void> {
  if (!user.email || !user.email_confirmed_at) throw new Error("Verified customer login required");
  const admin = adminClient();
  const { data, error } = await admin.from("account_principals")
    .select("account_type, active, normalized_email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.active || data.account_type !== "customer") {
    throw new Error("This email is not permitted to use the customer portal");
  }
  if (normalizeEmail(data.normalized_email) !== normalizeEmail(user.email)) {
    throw new Error("Account email does not match its reserved customer identity");
  }
}

async function validateDesignFiles(input: {
  admin: AdminClient;
  userId: string;
  designProjectId: string;
  fileIds: string[];
}) {
  if (input.fileIds.length > 10) throw new Error("A design can contain at most 10 uploaded files");
  if (input.fileIds.length === 0) return;

  const { data, error } = await input.admin.from("order_files")
    .select("id, byte_size, upload_status, deleted_at, uploaded_by, design_project_id")
    .in("id", input.fileIds);
  if (error) throw new Error(error.message);
  if (!data || data.length !== input.fileIds.length) throw new Error("One or more artwork files are unavailable");

  let totalBytes = 0;
  for (const file of data) {
    if (
      file.uploaded_by !== input.userId ||
      file.design_project_id !== input.designProjectId ||
      file.upload_status !== "finalized" ||
      file.deleted_at
    ) {
      throw new Error("Artwork file ownership or upload state is invalid");
    }
    totalBytes += Number(file.byte_size);
  }
  if (totalBytes > 250 * 1024 * 1024) throw new Error("Artwork files exceed the 250 MB order limit");
}

async function prepareCustomOrder(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitCustomOrderRequest;
}): Promise<PreparedCheckout> {
  const { request, user, supabase } = input;
  await assertCustomerPrincipal(user);
  if (normalizeEmail(request.contact.email) !== normalizeEmail(user.email ?? "")) {
    throw new Error("Checkout email must match the logged-in customer email");
  }

  const [{ data: project, error: projectError }, { data: version, error: versionError }] = await Promise.all([
    supabase.from("design_projects")
      .select("id, created_by, title, status, schema_version")
      .eq("id", request.designProjectId)
      .eq("created_by", user.id)
      .maybeSingle(),
    supabase.from("design_project_versions")
      .select("id, design_project_id, version_number, configuration_snapshot")
      .eq("design_project_id", request.designProjectId)
      .eq("version_number", request.designVersion)
      .maybeSingle(),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (versionError) throw new Error(versionError.message);
  if (!project || !version || version.design_project_id !== project.id) throw new Error("Saved design version is unavailable");

  const snapshot = cloudDesignSnapshotSchema.parse(version.configuration_snapshot);
  const deliveryDateError = getRequestedDeliveryDateError({
    deliveryType: request.deliveryType,
    requestedDeliveryDate: request.requestedDeliveryDate,
    extraLeadTimeDays:
      snapshot.configuration.colour.type === "custom_dye"
        ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
        : 0,
  });
  if (deliveryDateError) throw new Error(deliveryDateError);

  const priced = priceCustomOrder({
    snapshot,
    sizeQuantities: request.sizeQuantities,
    deliveryType: request.deliveryType,
  });
  const admin = adminClient();
  await validateDesignFiles({ admin, userId: user.id, designProjectId: project.id, fileIds: priced.fileIds });

  let discountCodeId: string | null = null;
  let normalizedDiscountCode: string | null = null;
  let discountPaise = 0;
  if (request.discountCode) {
    const { data, error } = await admin.rpc("validate_discount_code", {
      p_code: request.discountCode,
      p_customer_user_id: user.id,
      p_subtotal_paise: priced.subtotalPaise,
    });
    const result = data?.[0];
    if (error || !result) throw new Error("Discount code is invalid or unavailable");
    discountCodeId = result.discount_code_id;
    normalizedDiscountCode = result.normalized_code;
    discountPaise = Number(result.discount_paise);
  }

  const taxablePaise = priced.subtotalPaise - discountPaise;
  const taxRateBasisPoints = getServerEnvironment().INVOICE_GST_RATE_BASIS_POINTS;
  const taxPaise = Math.round((taxablePaise * taxRateBasisPoints) / 10_000);
  const totalPaise = taxablePaise + taxPaise;
  if (totalPaise <= 0) throw new Error("Order total must be greater than zero");

  const customerName = `${request.contact.firstName} ${request.contact.lastName}`.trim();
  const billingSnapshot: Json = {
    entity: request.billing.entity,
    email: request.billing.accountsPayableEmail,
    gstin: request.billing.gstin ?? null,
    address: addressSnapshot(request.billing.address, request.billing.entity, request.contact.phone),
  };
  const shippingSnapshot: Json = {
    recipientName: request.shipping.recipientName,
    address: addressSnapshot(request.shipping.address, request.shipping.recipientName, request.contact.phone),
    multipleLocations: request.shipping.multipleLocations,
    multipleLocationsNotes: request.shipping.multipleLocationsNotes ?? null,
    pricing: "quoted_separately",
  };
  const customerSnapshot: Json = {
    userId: user.id,
    firstName: request.contact.firstName,
    lastName: request.contact.lastName,
    name: customerName,
    email: normalizeEmail(request.contact.email),
    phone: phoneE164(request.contact.phone),
    department: request.contact.department ?? null,
    receiveEmails: request.receiveEmails,
  };
  const terms = currentCustomTermsEvidence();
  if (
    request.acceptedTermsVersion !== terms.version ||
    request.acceptedPrivacyVersion !== terms.privacyVersion
  ) {
    throw new Error("Terms have changed. Review and accept the latest version");
  }

  const configurationSnapshot: Json = {
    design: snapshot,
    sizeQuantities: request.sizeQuantities,
    deliveryType: request.deliveryType,
    requestedDeliveryDate: request.requestedDeliveryDate,
    rushPricing: request.deliveryType === "rush"
      ? { surchargeUnitPaise: RUSH_DELIVERY_SURCHARGE_PAISE, taxable: true }
      : null,
    orderNotes: request.orderNotes ?? null,
    commercialFieldsLockedAfterPayment: ["quantity", "garment", "printingTechnique"],
  };
  const payload = {
    orderType: "custom_bulk",
    designProjectId: project.id,
    designVersionId: version.id,
    pricingVersion: CUSTOM_ORDER_PRICING_VERSION,
    configurationSchemaVersion: snapshot.schemaVersion,
    customerReference: request.projectName,
    requestedDeliveryDate: request.requestedDeliveryDate,
    billingSnapshot,
    shippingSnapshot,
    customerSnapshot,
    businessSnapshot: request.billing.gstin
      ? { legalBusinessName: request.billing.entity, gstin: request.billing.gstin }
      : {},
    termsSnapshot: {
      version: terms.version,
      privacyVersion: terms.privacyVersion,
      contentHash: terms.documentHash,
      requestMetadata: { checkoutType: "full_payment" },
    },
    configurationSnapshot,
    items: [priced.item],
    fileIds: priced.fileIds,
    discountCode: normalizedDiscountCode,
    saveShippingToAccount: request.saveShippingToAccount,
    saveBillingToAccount: request.saveBillingToAccount,
  } satisfies Json;

  const requestHash = hashOrderRequest({
    userId: user.id,
    request,
    versionId: version.id,
    pricingVersion: CUSTOM_ORDER_PRICING_VERSION,
    subtotalPaise: priced.subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
  });

  return {
    requestHash,
    payload,
    subtotalPaise: priced.subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    discountCodeId,
    customerName,
    customerEmail: normalizeEmail(request.contact.email),
    customerPhone: phoneE164(request.contact.phone),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

async function createCheckoutAttempt(input: {
  sessionId: string;
  attemptNumber: number;
  prepared: PreparedCheckout;
}) {
  const admin = adminClient();
  const id = randomUUID();
  const merchantTransactionId = `G${id.replace(/-/g, "").slice(0, 22)}`;
  const { data, error } = await admin.from("custom_checkout_payment_attempts").insert({
    id,
    checkout_session_id: input.sessionId,
    attempt_number: input.attemptNumber,
    provider_merchant_txn_id: merchantTransactionId,
    amount_paise: input.prepared.totalPaise,
    currency: "INR",
    status: "created",
    expected_product_info: "Garmops custom garment order",
    customer_email: input.prepared.customerEmail,
    customer_name: input.prepared.customerName,
    customer_phone: input.prepared.customerPhone,
  }).select("id, status").single();
  if (error || !data) throw new Error(error?.message ?? "Payment attempt could not be prepared");
  return data;
}

export async function prepareCustomCheckout(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitCustomOrderRequest;
  cartId: string;
  returnPath: string;
}) {
  const prepared = await prepareCustomOrder(input);
  const admin = adminClient();
  const sessionResult = await admin.from("custom_checkout_sessions")
    .select("id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id, expires_at")
    .eq("customer_user_id", input.user.id)
    .eq("idempotency_key", input.request.idempotencyKey)
    .maybeSingle();
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  let session = sessionResult.data;

  if (session && session.request_hash !== prepared.requestHash) {
    throw new Error("Checkout details changed. Return to delivery details and start payment again");
  }
  if (session?.status === "finalized") {
    return {
      checkoutSessionId: session.id,
      checkoutPaymentAttemptId: null,
      alreadyFinalized: true,
      orderNumber: session.final_order_number,
      orderId: session.final_order_id,
      paymentAttemptId: session.final_payment_attempt_id,
    };
  }

  if (!session) {
    const { data: inserted, error: insertError } = await admin.from("custom_checkout_sessions").insert({
      customer_user_id: input.user.id,
      cart_id: input.cartId,
      idempotency_key: input.request.idempotencyKey,
      request_hash: prepared.requestHash,
      status: "prepared",
      rpc_payload: prepared.payload,
      subtotal_paise: prepared.subtotalPaise,
      discount_paise: prepared.discountPaise,
      tax_paise: prepared.taxPaise,
      total_paise: prepared.totalPaise,
      discount_code_id: prepared.discountCodeId,
      currency: "INR",
      return_path: input.returnPath,
      expires_at: prepared.expiresAt,
    }).select("id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id, expires_at").single();
    if (insertError || !inserted) throw new Error(insertError?.message ?? "Checkout could not be prepared");
    session = inserted;
  } else if (["prepared", "failed", "expired"].includes(session.status)) {
    const { error: refreshError } = await admin.from("custom_checkout_sessions").update({
      status: "prepared",
      rpc_payload: prepared.payload,
      subtotal_paise: prepared.subtotalPaise,
      discount_paise: prepared.discountPaise,
      tax_paise: prepared.taxPaise,
      total_paise: prepared.totalPaise,
      discount_code_id: prepared.discountCodeId,
      return_path: input.returnPath,
      expires_at: prepared.expiresAt,
    }).eq("id", session.id);
    if (refreshError) throw new Error(refreshError.message);
  }

  if (!session) throw new Error("Checkout session could not be prepared");

  const { data: attempts, error: attemptsError } = await admin.from("custom_checkout_payment_attempts")
    .select("id, attempt_number, status")
    .eq("checkout_session_id", session.id)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (attemptsError) throw new Error(attemptsError.message);
  const latest = attempts?.[0];
  if (latest && ["created", "initiated", "pending"].includes(latest.status)) {
    return { checkoutSessionId: session.id, checkoutPaymentAttemptId: latest.id, alreadyFinalized: false };
  }
  const nextAttempt = await createCheckoutAttempt({
    sessionId: session.id,
    attemptNumber: (latest?.attempt_number ?? 0) + 1,
    prepared,
  });
  return { checkoutSessionId: session.id, checkoutPaymentAttemptId: nextAttempt.id, alreadyFinalized: false };
}

export async function finalizeCustomCheckoutPayment(input: {
  checkoutPaymentAttemptId: string;
  providerPaymentId: string;
  verifiedAmountPaise: number;
  verifiedSnapshot: Json;
}) {
  const admin = adminClient();
  const { data, error } = await admin.rpc("finalize_custom_checkout_full_payment", {
    p_checkout_payment_attempt_id: input.checkoutPaymentAttemptId,
    p_provider_payment_id: input.providerPaymentId,
    p_verified_amount_paise: input.verifiedAmountPaise,
    p_verified_snapshot: input.verifiedSnapshot,
    p_seller_snapshot: sellerSnapshot(),
  });
  const result = data?.[0];
  if (error || !result) throw new Error(error?.message ?? "Verified checkout could not be finalized");
  return {
    orderId: result.order_id,
    orderNumber: result.order_number,
    paymentAttemptId: result.payment_attempt_id,
    alreadyFinalized: Boolean(result.already_finalized),
    duplicateSuccess: Boolean(result.duplicate_success),
  };
}
