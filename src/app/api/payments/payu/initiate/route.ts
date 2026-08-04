import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { buildPayuCheckout } from "@/lib/providers/payu/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ checkoutPaymentAttemptId: z.string().uuid() }).strict();


export async function POST(request: NextRequest) {
  if (!durableCustomOrdersAvailable()) {
    return orderJsonError("Custom checkout is unavailable", 503);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;
  const body = await readOrderJson(request, 8 * 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return orderJsonError("Invalid payment initiation request", 400);

  const admin = createAdminClient();
  const { data: attempt, error } = await admin.from("custom_checkout_payment_attempts")
    .select(
      "id, checkout_session_id, status, amount_paise, currency, provider_merchant_txn_id, expected_product_info, customer_email, customer_name, customer_phone, custom_checkout_sessions!inner(customer_user_id, status, expires_at)",
    )
    .eq("id", parsed.data.checkoutPaymentAttemptId)
    .maybeSingle();
  if (error || !attempt) return orderJsonError("Payment attempt not found", 404);

  const session = attempt.custom_checkout_sessions as {
    customer_user_id: string;
    status: string;
    expires_at: string;
  };
  if (session.customer_user_id !== auth.user.id) {
    return orderJsonError("Payment attempt not found", 404);
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await admin.from("custom_checkout_sessions")
      .update({ status: "expired" })
      .eq("id", attempt.checkout_session_id)
      .neq("status", "finalized");
    return orderJsonError("Checkout payment window has expired", 409);
  }
  if (session.status === "finalized" || ["paid", "duplicate_success"].includes(attempt.status)) {
    return orderJsonError("Order payment is already complete", 409);
  }
  if (attempt.currency !== "INR") return orderJsonError("Unsupported payment currency", 409);
  if (!["created", "initiated"].includes(attempt.status)) {
    return orderJsonError(
      attempt.status === "pending" ? "Payment verification is pending" : "Payment cannot be initiated",
      409,
    );
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
      const { data: initiated, error: updateError } = await admin.from("custom_checkout_payment_attempts")
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
      if (!initiated) return orderJsonError("Payment attempt state changed", 409);
      await admin.from("custom_checkout_sessions")
        .update({ status: "payment_initiated" })
        .eq("id", attempt.checkout_session_id)
        .in("status", ["prepared", "failed"]);
    }
    return orderJson(checkout);
  } catch (initiationError) {
    console.error("PayU checkout initiation failed", {
      checkoutAttemptId: attempt.id,
      error: initiationError instanceof Error ? initiationError.message : "unknown",
    });
    return orderJsonError("Secure payment could not be started", 503);
  }
}
