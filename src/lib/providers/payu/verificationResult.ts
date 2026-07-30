import { parseRupeesToPaise } from "./hashing";
import type { PayuVerificationResult } from "./types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function nullableProviderId(value: unknown): string | null {
  const normalized = text(value);
  return normalized && normalized.toLowerCase() !== "not found"
    ? normalized
    : null;
}

const SUCCESS_PROVIDER_STATUSES = new Set(["success", "captured"]);
const SUCCESS_UNMAPPED_STATUSES = new Set(["success", "captured"]);
const PENDING_STATUSES = new Set([
  "pending",
  "initiated",
  "in progress",
  "in_progress",
  "auth",
  "authorized",
  "processing",
]);
const FAILURE_STATUSES = new Set([
  "failure",
  "failed",
  "bounced",
  "dropped",
  "cancelled",
  "canceled",
  "usercancelled",
  "user_cancelled",
]);

export function parsePayuVerificationResponse(
  payloadValue: unknown,
  expectedTransactionId: string,
): PayuVerificationResult {
  const payload = object(payloadValue);
  const details = object(object(payload.transaction_details)[expectedTransactionId]);
  const returnedTransactionId = text(details.txnid);

  if (
    returnedTransactionId &&
    returnedTransactionId !== expectedTransactionId
  ) {
    throw new Error("PayU verification returned a different transaction id");
  }

  const providerStatus = text(details.status).toLowerCase();
  const unmappedStatus = text(details.unmappedstatus).toLowerCase();
  const providerPaymentId = nullableProviderId(details.mihpayid);
  const returnedCurrency = text(details.currency ?? details.currency_code).toUpperCase();
  if (returnedCurrency && returnedCurrency !== "INR") {
    throw new Error("PayU verification returned an unexpected currency");
  }
  const amountPaise = parseRupeesToPaise(
    details.amt ?? details.transaction_amount ?? details.amount,
  );

  let status: PayuVerificationResult["status"] = "unknown";
  if (
    SUCCESS_PROVIDER_STATUSES.has(providerStatus) &&
    SUCCESS_UNMAPPED_STATUSES.has(unmappedStatus)
  ) {
    status = "success";
  } else if (
    PENDING_STATUSES.has(providerStatus) ||
    PENDING_STATUSES.has(unmappedStatus) ||
    (SUCCESS_PROVIDER_STATUSES.has(providerStatus) && !unmappedStatus)
  ) {
    status = "pending";
  } else if (
    FAILURE_STATUSES.has(providerStatus) ||
    FAILURE_STATUSES.has(unmappedStatus)
  ) {
    status = "failed";
  }

  return {
    status,
    merchantTransactionId: expectedTransactionId,
    providerPaymentId,
    amountPaise,
    currency: "INR",
    providerStatus,
    unmappedStatus,
    failureCode: text(details.error_code ?? details.error) || null,
    failureMessage: text(details.error_Message ?? details.field9) || null,
    snapshot: {
      txnid: returnedTransactionId || expectedTransactionId,
      mihpayid: providerPaymentId,
      status: providerStatus,
      unmappedstatus: unmappedStatus,
      amount: text(details.amt ?? details.transaction_amount ?? details.amount),
      currency: returnedCurrency || "INR",
      addedon: text(details.addedon) || null,
      mode: text(details.mode) || null,
      bank_ref_num: text(details.bank_ref_num) || null,
      error_code: text(details.error_code ?? details.error) || null,
      error_message: text(details.error_Message ?? details.field9) || null,
      response_status: text(payload.status) || null,
      response_message: text(payload.msg) || null,
    },
  };
}

