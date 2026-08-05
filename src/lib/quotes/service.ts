import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { calculateTaxPaise } from "@/lib/tax";
import { configuredGstRateBasisPoints } from "@/lib/tax.server";
import { currentCustomTermsEvidence } from "@/lib/orders/terms";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

const admin = () => createAdminClient();

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export type CustomerStaffQuote = Readonly<{
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  expiresAt: string;
  status: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  configuration: Record<string, unknown>;
  pricing: Record<string, unknown>;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  finalOrderId: string | null;
}>;

async function readQuote(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const client = admin();
  const { data, error } = await client.from("staff_quotes")
    .select("id, quote_number, created_by, customer_user_id, customer_email, customer_name, customer_phone, configuration_snapshot, pricing_snapshot, billing_snapshot, shipping_snapshot, subtotal_paise, discount_paise, tax_paise, total_paise, status, expires_at, final_order_id")
    .eq("payment_token_hash", tokenHash(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getStaffQuoteForCustomer(token: string, user: User): Promise<CustomerStaffQuote | null> {
  if (!user.email || !user.email_confirmed_at) return null;
  const quote = await readQuote(token);
  if (!quote || normalizeEmail(quote.customer_email) !== normalizeEmail(user.email)) return null;
  if (!["sent", "paid"].includes(quote.status)) return null;
  if (quote.status !== "paid" && new Date(quote.expires_at).getTime() <= Date.now()) {
    await admin().from("staff_quotes").update({ status: "expired" }).eq("id", quote.id).eq("status", "sent");
    return null;
  }
  return Object.freeze({
    id: quote.id,
    quoteNumber: quote.quote_number,
    customerName: quote.customer_name,
    customerEmail: quote.customer_email,
    expiresAt: quote.expires_at,
    status: quote.status,
    subtotalPaise: Number(quote.subtotal_paise),
    taxPaise: Number(quote.tax_paise),
    totalPaise: Number(quote.total_paise),
    configuration: quote.configuration_snapshot as Record<string, unknown>,
    pricing: quote.pricing_snapshot as Record<string, unknown>,
    billing: quote.billing_snapshot as Record<string, unknown>,
    shipping: quote.shipping_snapshot as Record<string, unknown>,
    finalOrderId: quote.final_order_id,
  });
}

async function createAttempt(input: {
  sessionId: string;
  attemptNumber: number;
  amountPaise: number;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  quoteNumber: string;
}) {
  const client = admin();
  const id = randomUUID();
  const { data, error } = await client.from("custom_checkout_payment_attempts").insert({
    id,
    checkout_session_id: input.sessionId,
    attempt_number: input.attemptNumber,
    provider: "payu",
    provider_merchant_txn_id: `Q${id.replaceAll("-", "").slice(0, 22)}`,
    amount_paise: input.amountPaise,
    currency: "INR",
    status: "created",
    expected_product_info: `Garmops quotation ${input.quoteNumber}`,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Quote payment attempt could not be created");
  return data.id as string;
}

export async function prepareStaffQuoteCheckout(input: {
  token: string;
  user: User;
  discountCode?: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}) {
  if (!input.acceptedTerms || !input.acceptedPrivacy) throw new Error("Accept the terms and privacy notice before payment");
  const quote = await readQuote(input.token);
  if (!quote || quote.status !== "sent") throw new Error("This quotation is not available for payment");
  if (new Date(quote.expires_at).getTime() <= Date.now()) {
    await admin().from("staff_quotes").update({ status: "expired" }).eq("id", quote.id).eq("status", "sent");
    throw new Error("This quotation has expired");
  }
  if (!input.user.email || !input.user.email_confirmed_at || normalizeEmail(input.user.email) !== normalizeEmail(quote.customer_email)) {
    throw new Error("Sign in with the email address named on this quotation");
  }

  const client = admin();
  const { data: principal, error: principalError } = await client.from("account_principals")
    .select("user_id, account_type, active, normalized_email")
    .eq("user_id", input.user.id)
    .maybeSingle();
  if (principalError || !principal || principal.account_type !== "customer" || !principal.active || normalizeEmail(principal.normalized_email) !== normalizeEmail(input.user.email)) {
    throw new Error("This account is not permitted to pay a customer quotation");
  }

  const pricing = quote.pricing_snapshot as Record<string, unknown>;
  const items = Array.isArray(pricing.items) ? pricing.items : [];
  if (items.length !== 1) throw new Error("The quotation has an invalid order-line snapshot");

  const subtotalPaise = Number(quote.subtotal_paise);
  let discountCodeId: string | null = null;
  let normalizedDiscountCode: string | null = null;
  let discountPaise = 0;
  if (input.discountCode?.trim()) {
    const { data, error } = await client.rpc("validate_discount_code", {
      p_code: input.discountCode,
      p_customer_user_id: input.user.id,
      p_subtotal_paise: subtotalPaise,
    });
    const result = data?.[0];
    if (error || !result) throw new Error("Discount code is invalid or unavailable");
    discountCodeId = result.discount_code_id;
    normalizedDiscountCode = result.normalized_code;
    discountPaise = Number(result.discount_paise);
  }

  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = calculateTaxPaise(taxablePaise, configuredGstRateBasisPoints());
  const totalPaise = taxablePaise + taxPaise;
  if (totalPaise <= 0) throw new Error("The quotation total must be greater than zero");

  const terms = currentCustomTermsEvidence();
  const configuration = quote.configuration_snapshot as Record<string, unknown>;
  const payload = {
    orderType: "custom_bulk",
    orderSource: "staff_payment_link",
    createdByStaffUserId: quote.created_by,
    staffQuoteId: quote.id,
    pricingVersion: typeof pricing.pricingVersion === "string" ? pricing.pricingVersion : "staff-quote-v1",
    gstRateBasisPoints: configuredGstRateBasisPoints(),
    configurationSchemaVersion: Number(configuration.schemaVersion ?? 1),
    customerReference: quote.quote_number,
    billingSnapshot: quote.billing_snapshot,
    shippingSnapshot: quote.shipping_snapshot,
    customerSnapshot: {
      userId: input.user.id,
      name: quote.customer_name,
      email: normalizeEmail(quote.customer_email),
      phone: quote.customer_phone,
    },
    businessSnapshot: ((quote.billing_snapshot as Record<string, unknown>).business ?? {}) as Json,
    termsSnapshot: {
      version: terms.version,
      privacyVersion: terms.privacyVersion,
      contentHash: terms.documentHash,
      requestMetadata: { checkoutType: "staff_quote", quoteNumber: quote.quote_number },
    },
    configurationSnapshot: quote.configuration_snapshot,
    items: items as Json[],
    fileIds: [],
    discountCode: normalizedDiscountCode,
  } satisfies Json;

  const requestHash = createHash("sha256").update(stableJson({
    quoteId: quote.id,
    userId: input.user.id,
    discountCode: normalizedDiscountCode,
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
  })).digest("hex");
  const expiresAt = new Date(Math.min(new Date(quote.expires_at).getTime(), Date.now() + 30 * 60_000)).toISOString();

  const sessionResult = await client.from("custom_checkout_sessions")
    .select("id, request_hash, status, final_order_number, final_payment_attempt_id")
    .eq("staff_quote_id", quote.id)
    .maybeSingle();
  let session = sessionResult.data;
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (session?.status === "finalized") {
    return { alreadyFinalized: true, orderNumber: session.final_order_number as string, checkoutPaymentAttemptId: null, totalPaise };
  }
  if (session && session.request_hash !== requestHash && ["payment_initiated", "payment_pending", "payment_verified"].includes(session.status)) {
    throw new Error("Payment is already in progress for this quotation");
  }

  if (!session) {
    const inserted = await client.from("custom_checkout_sessions").insert({
      customer_user_id: input.user.id,
      cart_id: `staff-quote:${quote.id}`,
      idempotency_key: quote.id,
      request_hash: requestHash,
      status: "prepared",
      rpc_payload: payload,
      subtotal_paise: subtotalPaise,
      discount_paise: discountPaise,
      tax_paise: taxPaise,
      total_paise: totalPaise,
      currency: "INR",
      discount_code_id: discountCodeId,
      return_path: `/quote/${encodeURIComponent(input.token)}`,
      staff_quote_id: quote.id,
      expires_at: expiresAt,
    }).select("id, request_hash, status, final_order_number, final_payment_attempt_id").single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Quote checkout could not be prepared");
    session = inserted.data;
  } else {
    const refreshed = await client.from("custom_checkout_sessions").update({
      customer_user_id: input.user.id,
      request_hash: requestHash,
      status: "prepared",
      rpc_payload: payload,
      subtotal_paise: subtotalPaise,
      discount_paise: discountPaise,
      tax_paise: taxPaise,
      total_paise: totalPaise,
      discount_code_id: discountCodeId,
      return_path: `/quote/${encodeURIComponent(input.token)}`,
      expires_at: expiresAt,
    }).eq("id", session.id).select("id, request_hash, status, final_order_number, final_payment_attempt_id").single();
    if (refreshed.error || !refreshed.data) throw new Error(refreshed.error?.message ?? "Quote checkout could not be refreshed");
    session = refreshed.data;
    await client.from("custom_checkout_payment_attempts")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("checkout_session_id", session.id)
      .in("status", ["created", "failed", "cancelled"]);
  }

  if (!session) throw new Error("Quote checkout session could not be prepared");

  const { data: attempts, error: attemptsError } = await client.from("custom_checkout_payment_attempts")
    .select("id, attempt_number, status")
    .eq("checkout_session_id", session.id)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (attemptsError) throw new Error(attemptsError.message);
  const latest = attempts?.[0];
  if (latest && ["created", "initiated", "pending"].includes(latest.status)) {
    return { alreadyFinalized: false, checkoutPaymentAttemptId: latest.id as string, totalPaise };
  }

  const checkoutPaymentAttemptId = await createAttempt({
    sessionId: session.id,
    attemptNumber: Number(latest?.attempt_number ?? 0) + 1,
    amountPaise: totalPaise,
    customerEmail: normalizeEmail(quote.customer_email),
    customerName: quote.customer_name,
    customerPhone: quote.customer_phone,
    quoteNumber: quote.quote_number,
  });
  return { alreadyFinalized: false, checkoutPaymentAttemptId, totalPaise };
}
