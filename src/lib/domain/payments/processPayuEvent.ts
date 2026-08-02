import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import {
  paymentEventFingerprint,
  parseRupeesToPaise,
  verifyPaymentResponseHash,
} from "@/lib/providers/payu/hashing";
import type {
  PayuIncomingFields,
  PayuVerificationResult,
} from "@/lib/providers/payu/types";
import { verifyPayuPayment } from "@/lib/providers/payu/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

type IncomingSource = "callback" | "webhook";
type PaymentOutcome = "success" | "failure" | "pending";

type ProcessResult = {
  outcome: PaymentOutcome;
  attemptId: string;
  orderNumber: string;
  duplicate: boolean;
};

type PaymentAttemptForProcessing = {
  id: string;
  order_id: string;
  amount_paise: number;
  currency: string;
  provider_merchant_txn_id: string;
  purpose: string;
  created_at?: string;
};

function storedPayload(fields: PayuIncomingFields): Record<string, unknown> {
  return {
    txnid: fields.txnid,
    amount: fields.amount,
    productinfo: fields.productinfo,
    status: fields.status,
    mihpayid: fields.mihpayid ?? null,
    unmappedstatus: fields.unmappedstatus ?? null,
    error: fields.error ?? null,
    error_message: fields.error_Message ?? null,
    additional_charges:
      fields.additional_charges ?? fields.additionalCharges ?? null,
    split_info_present: Boolean(fields.splitInfo),
  };
}

function fingerprintPayload(
  fields: PayuIncomingFields,
): Record<string, unknown> {
  return {
    key: fields.key,
    txnid: fields.txnid,
    amount: fields.amount,
    productinfo: fields.productinfo,
    firstname: fields.firstname,
    email: fields.email,
    udf1: fields.udf1,
    udf2: fields.udf2,
    udf3: fields.udf3,
    udf4: fields.udf4,
    udf5: fields.udf5,
    status: fields.status,
    hash: fields.hash,
    mihpayid: fields.mihpayid ?? "",
    unmappedstatus: fields.unmappedstatus ?? "",
    additional_charges:
      fields.additional_charges ?? fields.additionalCharges ?? "",
    splitInfo: fields.splitInfo ?? "",
  };
}

function outcomeFromAttemptStatus(status: string | undefined): PaymentOutcome {
  if (status === "paid") return "success";
  if (status === "failed" || status === "cancelled") return "failure";
  return "pending";
}

async function applyVerification(
  attempt: PaymentAttemptForProcessing,
  verification: PayuVerificationResult,
): Promise<PaymentOutcome> {
  const admin = createAdminClient();

  if (
    verification.amountPaise !== null &&
    verification.amountPaise !== attempt.amount_paise
  ) {
    throw new Error("Verified PayU amount does not match the payment attempt");
  }

  if (verification.status === "success") {
    if (!verification.providerPaymentId || verification.amountPaise === null) {
      throw new Error("PayU success response is incomplete");
    }

    const { data: existingPaid, error: existingPaidError } = await admin
      .from("payment_attempts")
      .select("id")
      .eq("order_id", attempt.order_id)
      .eq("purpose", attempt.purpose)
      .eq("status", "paid")
      .neq("id", attempt.id)
      .limit(1)
      .maybeSingle();
    if (existingPaidError) throw new Error(existingPaidError.message);

    if (existingPaid) {
      const { error: exceptionError } = await admin.rpc(
        "record_payu_payment_state",
        {
          p_payment_attempt_id: attempt.id,
          p_state: "disputed",
          p_provider_payment_id: verification.providerPaymentId,
          p_failure_code: "DUPLICATE_VERIFIED_SUCCESS",
          p_failure_message:
            "PayU verified this attempt after another attempt had already paid the same order purpose",
          p_verified_snapshot: verification.snapshot as Json,
        },
      );
      if (exceptionError) throw new Error(exceptionError.message);
      return "pending";
    }

    const { error } = await admin.rpc("finalize_verified_payment", {
      p_payment_attempt_id: attempt.id,
      p_provider_payment_id: verification.providerPaymentId,
      p_verified_amount_paise: verification.amountPaise,
      p_currency: attempt.currency,
      p_verified_snapshot: verification.snapshot as Json,
      p_invoice_kind: "reservation_invoice",
    });
    if (error) {
      if (/another payment attempt already paid/i.test(error.message)) {
        const { error: exceptionError } = await admin.rpc(
          "record_payu_payment_state",
          {
            p_payment_attempt_id: attempt.id,
            p_state: "disputed",
            p_provider_payment_id: verification.providerPaymentId,
            p_failure_code: "DUPLICATE_VERIFIED_SUCCESS",
            p_failure_message:
              "Concurrent PayU success requires finance review because the order purpose was already paid",
            p_verified_snapshot: verification.snapshot as Json,
          },
        );
        if (exceptionError) throw new Error(exceptionError.message);
        return "pending";
      }
      throw new Error(error.message);
    }
    return "success";
  }

  const state = verification.status === "failed" ? "failed" : "pending";
  const { error } = await admin.rpc("record_payu_payment_state", {
    p_payment_attempt_id: attempt.id,
    p_state: state,
    p_provider_payment_id: verification.providerPaymentId ?? undefined,
    p_failure_code: verification.failureCode ?? undefined,
    p_failure_message: verification.failureMessage ?? undefined,
    p_verified_snapshot: verification.snapshot as Json,
  });
  if (error) throw new Error(error.message);
  return state === "failed" ? "failure" : "pending";
}

async function persistVerificationEvent(
  attemptId: string,
  source: "verify_api" | "reconciliation",
  verification: PayuVerificationResult,
): Promise<void> {
  const admin = createAdminClient();
  const fingerprint = paymentEventFingerprint(source, {
    txnid: verification.merchantTransactionId,
    ...verification.snapshot,
  });

  const { error } = await admin.from("payment_events").upsert(
    {
      payment_attempt_id: attemptId,
      provider: "payu",
      event_source: source,
      provider_event_id: verification.providerPaymentId,
      event_fingerprint: fingerprint,
      event_type: verification.status,
      authentic: true,
      processed: true,
      processed_at: new Date().toISOString(),
      payload: verification.snapshot as Json,
    },
    {
      onConflict: "provider,event_fingerprint",
      ignoreDuplicates: true,
    },
  );
  if (error) throw new Error(error.message);
}

export async function processPayuEvent(
  source: IncomingSource,
  fields: PayuIncomingFields,
): Promise<ProcessResult> {
  const admin = createAdminClient();
  const environment = getServerEnvironment();

  const { data: attempt, error } = await admin
    .from("payment_attempts")
    .select(
      "id, order_id, amount_paise, currency, provider_merchant_txn_id, purpose, expected_product_info, customer_email, customer_name, orders!inner(order_number)",
    )
    .eq("provider_merchant_txn_id", fields.txnid)
    .maybeSingle();
  if (error || !attempt) throw new Error("Unknown payment transaction");

  const orderNumber = (
    attempt.orders as unknown as { order_number: string }
  ).order_number;
  const fingerprint = paymentEventFingerprint(
    source,
    fingerprintPayload(fields),
  );
  const { data: inserted, error: insertError } = await admin
    .from("payment_events")
    .insert({
      payment_attempt_id: attempt.id,
      provider: "payu",
      event_source: source,
      provider_event_id: fields.mihpayid || null,
      event_fingerprint: fingerprint,
      event_type: fields.status || "unknown",
      authentic: false,
      processed: false,
      payload: storedPayload(fields) as Json,
    })
    .select("id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    const { data: current } = await admin
      .from("payment_attempts")
      .select("status")
      .eq("id", attempt.id)
      .single();
    return {
      outcome: outcomeFromAttemptStatus(current?.status),
      attemptId: attempt.id,
      orderNumber,
      duplicate: true,
    };
  }
  if (insertError || !inserted) {
    throw new Error("Payment event could not be persisted");
  }

  let responseAuthentic = false;
  try {
    if (
      !environment.PAYU_MERCHANT_KEY ||
      !environment.PAYU_SALT ||
      fields.key !== environment.PAYU_MERCHANT_KEY ||
      !verifyPaymentResponseHash(fields, environment.PAYU_SALT)
    ) {
      throw new Error("Invalid PayU response hash");
    }

    const expectedAmount = parseRupeesToPaise(fields.amount);
    const expectedFirstName =
      attempt.customer_name.trim().split(/\s+/)[0]?.slice(0, 60) ||
      "Customer";
    if (
      expectedAmount !== attempt.amount_paise ||
      fields.productinfo !== attempt.expected_product_info ||
      fields.email.toLowerCase() !== attempt.customer_email.toLowerCase() ||
      fields.firstname !== expectedFirstName ||
      fields.udf1 !== attempt.id ||
      fields.udf2 !== "" ||
      fields.udf3 !== "" ||
      fields.udf4 !== "" ||
      fields.udf5 !== ""
    ) {
      throw new Error("PayU response does not match the payment attempt");
    }

    responseAuthentic = true;
    const { error: authenticError } = await admin
      .from("payment_events")
      .update({ authentic: true })
      .eq("id", inserted.id);
    if (authenticError) throw new Error(authenticError.message);

    const verification = await verifyPayuPayment(fields.txnid);
    await persistVerificationEvent(attempt.id, "verify_api", verification);
    const outcome = await applyVerification(attempt, verification);

    const { error: processedError } = await admin
      .from("payment_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", inserted.id);
    if (processedError) throw new Error(processedError.message);

    return {
      outcome,
      attemptId: attempt.id,
      orderNumber,
      duplicate: false,
    };
  } catch (processingError) {
    const message =
      processingError instanceof Error
        ? processingError.message
        : "Payment processing failed";
    await admin
      .from("payment_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_error: message.slice(0, 1000),
      })
      .eq("id", inserted.id);

    if (responseAuthentic) {
      await admin.rpc("record_payu_payment_state", {
        p_payment_attempt_id: attempt.id,
        p_state: "pending",
        p_provider_payment_id: fields.mihpayid || undefined,
        p_failure_code: "VERIFICATION_PENDING",
        p_failure_message:
          "PayU response was authentic but provider verification requires reconciliation",
        p_verified_snapshot: {
          callback_status: fields.status,
          callback_unmapped_status: fields.unmappedstatus ?? null,
        } as Json,
      });
      return {
        outcome: "pending",
        attemptId: attempt.id,
        orderNumber,
        duplicate: false,
      };
    }

    throw processingError;
  }
}

export async function reconcilePayuAttempt(
  attemptId: string,
): Promise<ProcessResult> {
  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("payment_attempts")
    .select(
      "id, order_id, amount_paise, currency, provider_merchant_txn_id, purpose, created_at, orders!inner(order_number)",
    )
    .eq("id", attemptId)
    .single();
  if (error || !attempt) throw new Error("Payment attempt not found");

  const orderNumber = (
    attempt.orders as unknown as { order_number: string }
  ).order_number;
  const providerVerification = await verifyPayuPayment(
    attempt.provider_merchant_txn_id,
  );
  const attemptAgeMs = attempt.created_at
    ? Date.now() - new Date(attempt.created_at).getTime()
    : 0;
  const verification: PayuVerificationResult =
    providerVerification.status === "unknown" &&
    attemptAgeMs >= 2 * 60 * 60 * 1000
      ? {
          ...providerVerification,
          status: "failed",
          failureCode: "PAYU_TRANSACTION_NOT_FOUND",
          failureMessage:
            "PayU did not return a transaction after the reconciliation grace period",
          snapshot: {
            ...providerVerification.snapshot,
            reconciliation_classification: "abandoned_after_grace_period",
          },
        }
      : providerVerification;
  await persistVerificationEvent(attempt.id, "reconciliation", verification);
  const outcome = await applyVerification(attempt, verification);

  return {
    outcome,
    attemptId,
    orderNumber,
    duplicate: false,
  };
}
