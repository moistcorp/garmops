import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateOrderApi,
  durableOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { buildPayuCheckout } from "@/lib/providers/payu/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestIdFrom, withRequestId } from "@/lib/http/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutAttemptSchema = z
  .object({ checkoutPaymentAttemptId: z.string().uuid() })
  .strict();
const schema = checkoutAttemptSchema;

type CheckoutSessionSnapshot = {
  id: string;
  customer_user_id: string;
  status: string;
  expires_at: string;
  final_order_number: string | null;
};

async function initiateCheckoutAttempt(input: {
  requestId: string;
  userId: string;
}) {
  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("custom_checkout_payment_attempts")
    .select(
      "id, checkout_session_id, status, amount_paise, currency, provider_merchant_txn_id, expected_product_info, customer_email, customer_name, customer_phone, custom_checkout_sessions!inner(id, customer_user_id, status, expires_at, final_order_number)",
    )
    .eq("id", input.requestId)
    .maybeSingle();

  if (error || !attempt) {
    return orderJsonError("Payment attempt not found", 404);
  }

  const session =
    attempt.custom_checkout_sessions as unknown as CheckoutSessionSnapshot;
  if (session.customer_user_id !== input.userId) {
    return orderJsonError("Payment attempt not found", 404);
  }
  if (attempt.currency !== "INR") {
    return orderJsonError("Unsupported payment currency", 409);
  }
  if (session.status === "finalized" || ["paid", "duplicate_success"].includes(attempt.status)) {
    return orderJsonError(
      session.final_order_number
        ? `Payment is already complete for order ${session.final_order_number}`
        : "Payment is already complete",
      409,
    );
  }
  if (new Date(session.expires_at).getTime() <= Date.now() || session.status === "expired") {
    return orderJsonError(
      "This checkout has expired. Return to the review step and start payment again",
      409,
    );
  }
  if (attempt.status === "pending" || session.status === "payment_pending") {
    return orderJsonError(
      "Payment verification is pending. Check the payment status before trying again",
      409,
    );
  }
  if (!["created", "initiated"].includes(attempt.status)) {
    return orderJsonError("This payment attempt can no longer be initiated", 409);
  }

  try {
    const checkout = buildPayuCheckout({
      merchantTransactionId: attempt.provider_merchant_txn_id,
      paymentAttemptId: attempt.id,
      amountPaise: Number(attempt.amount_paise),
      productInfo: attempt.expected_product_info,
      customerName: attempt.customer_name,
      customerEmail: attempt.customer_email,
      customerPhone: attempt.customer_phone,
    });

    if (attempt.status === "created") {
      const { data: initiated, error: updateError } = await admin
        .from("custom_checkout_payment_attempts")
        .update({
          status: "initiated",
          initiated_at: new Date().toISOString(),
          failure_code: null,
          failure_message: null,
        })
        .eq("id", attempt.id)
        .eq("status", "created")
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      if (!initiated) {
        const { data: current, error: currentError } = await admin
          .from("custom_checkout_payment_attempts")
          .select("status")
          .eq("id", attempt.id)
          .maybeSingle();
        if (currentError) throw new Error(currentError.message);
        if (current?.status !== "initiated") {
          return orderJsonError("Payment attempt state changed", 409);
        }
      }
    }

    const { error: sessionUpdateError } = await admin
      .from("custom_checkout_sessions")
      .update({ status: "payment_initiated" })
      .eq("id", session.id)
      .in("status", ["prepared", "payment_initiated"]);
    if (sessionUpdateError) throw new Error(sessionUpdateError.message);

    return orderJson(checkout);
  } catch (initiationError) {
    console.error("Checkout PayU initiation failed", {
      checkoutPaymentAttemptId: attempt.id,
      checkoutSessionId: session.id,
      userId: input.userId,
      error:
        initiationError instanceof Error ? initiationError.message : "unknown",
    });
    return orderJsonError("Secure payment could not be started", 503);
  }
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!durableOrdersAvailable()) {
    return withRequestId(orderJsonError("Order payments are unavailable", 503), requestId);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return withRequestId(orderJsonError("Invalid request origin", 403), requestId);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return withRequestId(auth.response, requestId);

  const body = await readOrderJson(request, 8 * 1024);
  if (!body.ok) return withRequestId(body.response, requestId);

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return withRequestId(orderJsonError("Invalid payment initiation request", 400), requestId);
  }

  const admin = createAdminClient();
  const { data: principal, error: principalError } = await admin
    .from("account_principals")
    .select("active, account_type")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (principalError || !principal?.active || principal.account_type !== "customer") {
    return withRequestId(orderJsonError("Customer account is unavailable", 403), requestId);
  }

  return withRequestId(await initiateCheckoutAttempt({
    requestId: parsed.data.checkoutPaymentAttemptId,
    userId: auth.user.id,
  }), requestId);
}
