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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ orderPaymentAttemptId: z.string().uuid() }).strict();

type OrderSnapshot = {
  customer_user_id: string;
  customer_snapshot: unknown;
  order_number: string;
  shipping_charge_paise: number | null;
  shipping_payment_status: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  if (!durableOrdersAvailable()) {
    return orderJsonError("Order payments are unavailable", 503);
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
  const { data: principal } = await admin.from("account_principals")
    .select("active, account_type")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!principal?.active || principal.account_type !== "customer") {
    return orderJsonError("Customer account is unavailable", 403);
  }

  const { data: attempt, error } = await admin.from("payment_attempts")
    .select(
      "id, order_id, purpose, status, amount_paise, currency, provider_merchant_txn_id, expected_product_info, customer_email, customer_name, orders!inner(customer_user_id, customer_snapshot, order_number, shipping_charge_paise, shipping_payment_status)",
    )
    .eq("id", parsed.data.orderPaymentAttemptId)
    .maybeSingle();
  if (error || !attempt) return orderJsonError("Payment attempt not found", 404);

  const order = attempt.orders as unknown as OrderSnapshot;
  if (order.customer_user_id !== auth.user.id || attempt.purpose !== "shipping") {
    return orderJsonError("Payment attempt not found", 404);
  }
  if (attempt.currency !== "INR") return orderJsonError("Unsupported payment currency", 409);
  if (order.shipping_payment_status === "paid" || attempt.status === "paid") {
    return orderJsonError("Shipping payment is already complete", 409);
  }
  if (order.shipping_payment_status !== "link_created") {
    return orderJsonError("This shipping payment is no longer available", 409);
  }
  if (Number(order.shipping_charge_paise) !== Number(attempt.amount_paise)) {
    return orderJsonError("Shipping quote has changed. Refresh the order before paying", 409);
  }
  if (!["created", "initiated"].includes(attempt.status)) {
    return orderJsonError(
      attempt.status === "pending"
        ? "Shipping payment verification is pending"
        : "This shipping payment can no longer be initiated",
      409,
    );
  }

  const customer = record(order.customer_snapshot);
  const phone = typeof customer.phone === "string" ? customer.phone : "";

  try {
    const checkout = buildPayuCheckout({
      merchantTransactionId: attempt.provider_merchant_txn_id,
      paymentAttemptId: attempt.id,
      amountPaise: Number(attempt.amount_paise),
      productInfo: attempt.expected_product_info,
      customerName: attempt.customer_name,
      customerEmail: attempt.customer_email,
      customerPhone: phone,
    });

    if (attempt.status === "created") {
      const { data: initiated, error: updateError } = await admin.from("payment_attempts")
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
    }

    return orderJson(checkout);
  } catch (initiationError) {
    console.error("Shipping PayU checkout initiation failed", {
      paymentAttemptId: attempt.id,
      orderNumber: order.order_number,
      error: initiationError instanceof Error ? initiationError.message : "unknown",
    });
    return orderJsonError("Secure shipping payment could not be started", 503);
  }
}
