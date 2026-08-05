import "server-only";

import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { configuredGstRateBasisPoints } from "@/lib/tax.server";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import { hashOrderRequest } from "./service";
import {
  SAMPLE_ORDER_PRICING_VERSION,
  SAMPLE_ORDER_SCHEMA_VERSION,
  priceSampleOrder,
} from "./samplePricing";
import type { SubmitSampleOrderRequest } from "./sampleSchema";
import {
  CUSTOM_ORDER_PRIVACY_VERSION,
  currentSampleTermsEvidence,
} from "./terms";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
function adminClient() {
  return createAdminClient();
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
  address: SubmitSampleOrderRequest["shipping"]["address"],
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

async function assertCustomer(user: User): Promise<void> {
  if (!user.email || !user.email_confirmed_at) throw new Error("Verified customer login required");
  const { data, error } = await adminClient().from("account_principals")
    .select("account_type, active, normalized_email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data || !data.active || data.account_type !== "customer") {
    throw new Error("Customer account access is required");
  }
  if (normalizeEmail(data.normalized_email) !== normalizeEmail(user.email)) {
    throw new Error("Customer account identity is inconsistent");
  }
}

export async function submitSampleOrder(input: {
  supabase: SessionClient;
  user: User;
  request: SubmitSampleOrderRequest;
}) {
  const { request, user } = input;
  await assertCustomer(user);
  if (!user.email || normalizeEmail(request.contact.email) !== normalizeEmail(user.email)) {
    throw new Error("Checkout email must match the logged-in customer email");
  }

  const gstRateBasisPoints = configuredGstRateBasisPoints();
  const priced = priceSampleOrder(request.items);
  const customerName = `${request.contact.firstName} ${request.contact.lastName ?? ""}`.trim();
  const shippingAddress = addressSnapshot(
    request.shipping.address,
    request.shipping.recipientName,
    request.contact.phone,
  );
  const terms = currentSampleTermsEvidence();
  const payload: Json = {
    orderType: "sample_purchase",
    pricingVersion: SAMPLE_ORDER_PRICING_VERSION,
    gstRateBasisPoints,
    configurationSchemaVersion: SAMPLE_ORDER_SCHEMA_VERSION,
    customerReference: "Catalogue samples",
    billingSnapshot: {
      entity: customerName,
      email: normalizeEmail(request.contact.email),
      gstin: null,
      address: shippingAddress,
    },
    shippingSnapshot: {
      recipientName: request.shipping.recipientName,
      address: shippingAddress,
      pricing: "quoted_separately",
    },
    customerSnapshot: {
      userId: user.id,
      name: customerName,
      firstName: request.contact.firstName,
      lastName: request.contact.lastName ?? null,
      email: normalizeEmail(request.contact.email),
      phone: phoneE164(request.contact.phone),
    },
    businessSnapshot: {},
    termsSnapshot: {
      version: terms.version,
      privacyVersion: CUSTOM_ORDER_PRIVACY_VERSION,
      contentHash: terms.documentHash,
      requestMetadata: { checkoutType: "catalogue_sample_full_payment" },
    },
    configurationSnapshot: {
      sampleItems: request.items,
      orderNotes: request.orderNotes ?? null,
      commercialFieldsLockedAfterPayment: ["quantity", "garment"],
    },
    items: [...priced.items],
    fileIds: [],
    discountCode: null,
  };
  const requestHash = hashOrderRequest({
    userId: user.id,
    request,
    pricingVersion: SAMPLE_ORDER_PRICING_VERSION,
    subtotalPaise: priced.subtotalPaise,
    taxPaise: priced.taxEstimatePaise,
    totalPaise: priced.estimatedTotalPaise,
  });

  const admin = adminClient();
  const sessionResult = await admin.from("custom_checkout_sessions")
    .select("id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id")
    .eq("customer_user_id", user.id)
    .eq("idempotency_key", request.idempotencyKey)
    .maybeSingle();
  let session = sessionResult.data;
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (session && session.request_hash !== requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
  if (session?.status === "finalized") {
    return {
      checkoutSessionId: session.id,
      checkoutPaymentAttemptId: null,
      alreadyFinalized: true,
      orderId: session.final_order_id,
      orderNumber: session.final_order_number,
      paymentAttemptId: session.final_payment_attempt_id,
      subtotalPaise: priced.subtotalPaise,
      taxPaise: priced.taxEstimatePaise,
      totalPaise: priced.estimatedTotalPaise,
    };
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  if (!session) {
    const inserted = await admin.from("custom_checkout_sessions").insert({
      customer_user_id: user.id,
      cart_id: `sample:${request.idempotencyKey}`,
      idempotency_key: request.idempotencyKey,
      request_hash: requestHash,
      status: "prepared",
      rpc_payload: payload,
      subtotal_paise: priced.subtotalPaise,
      discount_paise: 0,
      tax_paise: priced.taxEstimatePaise,
      total_paise: priced.estimatedTotalPaise,
      currency: "INR",
      return_path: "/account/orders",
      expires_at: expiresAt,
    }).select("id, request_hash, status, final_order_id, final_order_number, final_payment_attempt_id").single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Checkout could not be prepared");
    session = inserted.data;
  }

  if (!session) throw new Error("Checkout session could not be prepared");

  const attempts = await admin.from("custom_checkout_payment_attempts")
    .select("id, attempt_number, status")
    .eq("checkout_session_id", session.id)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (attempts.error) throw new Error(attempts.error.message);
  const latest = attempts.data?.[0];
  let checkoutPaymentAttemptId = latest?.id as string | undefined;
  if (!latest || !["created", "initiated", "pending"].includes(latest.status)) {
    const id = randomUUID();
    const attempt = await admin.from("custom_checkout_payment_attempts").insert({
      id,
      checkout_session_id: session.id,
      attempt_number: Number(latest?.attempt_number ?? 0) + 1,
      provider_merchant_txn_id: `S${id.replace(/-/g, "").slice(0, 22)}`,
      amount_paise: priced.estimatedTotalPaise,
      currency: "INR",
      status: "created",
      expected_product_info: "Garmops catalogue sample order",
      customer_email: normalizeEmail(request.contact.email),
      customer_name: customerName,
      customer_phone: phoneE164(request.contact.phone),
    }).select("id").single();
    if (attempt.error || !attempt.data) throw new Error(attempt.error?.message ?? "Payment attempt could not be prepared");
    checkoutPaymentAttemptId = attempt.data.id;
  }

  return {
    checkoutSessionId: session.id,
    checkoutPaymentAttemptId,
    alreadyFinalized: false,
    subtotalPaise: priced.subtotalPaise,
    taxPaise: priced.taxEstimatePaise,
    totalPaise: priced.estimatedTotalPaise,
  };
}
