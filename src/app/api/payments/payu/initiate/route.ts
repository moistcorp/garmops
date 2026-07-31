import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  durableOrdersAvailable,
  durableSampleOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { buildPayuCheckout } from "@/lib/providers/payu/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ paymentAttemptId: z.string().uuid() }).strict();

type AttemptOrder = {
  organization_id: string;
  order_type: string;
  status: string;
  expires_at: string | null;
  customer_snapshot: unknown;
};

function customerPhone(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "";
  }
  const phone = (snapshot as Record<string, unknown>).phone;
  return typeof phone === "string" ? phone : "";
}

export async function POST(request: NextRequest) {
  if (!durableOrdersAvailable()) {
    return orderJsonError("Durable checkout is unavailable", 503);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const body = await readOrderJson(request, 8 * 1024);
  if (!body.ok) return body.response;

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Invalid payment initiation request", 400);
  }

  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("payment_attempts")
    .select(
      "id, order_id, status, amount_paise, currency, provider_merchant_txn_id, expected_product_info, customer_email, customer_name, orders!inner(organization_id, order_type, status, expires_at, customer_snapshot)",
    )
    .eq("id", parsed.data.paymentAttemptId)
    .maybeSingle();
  if (error || !attempt) {
    return orderJsonError("Payment attempt not found", 404);
  }

  const order = attempt.orders as unknown as AttemptOrder;
  const flowEnabled =
    order.order_type === "sample_purchase"
      ? durableSampleOrdersAvailable()
      : durableCustomOrdersAvailable();
  if (!flowEnabled) {
    return orderJsonError("This checkout flow is unavailable", 503);
  }

  const { data: membership } = await auth.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", order.organization_id)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .in("role", ["owner", "buyer"])
    .maybeSingle();
  if (!membership) {
    return orderJsonError("Payment attempt not found", 404);
  }

  if (!["awaiting_payment", "payment_failed"].includes(order.status)) {
    return orderJsonError("Order is not awaiting payment", 409);
  }
  if (
    order.expires_at &&
    new Date(order.expires_at).getTime() <= Date.now()
  ) {
    return orderJsonError("Order payment window has expired", 409);
  }
  if (attempt.currency !== "INR") {
    return orderJsonError("Unsupported payment currency", 409);
  }
  if (attempt.status === "paid") {
    return orderJsonError("Order is already paid", 409);
  }
  if (!["created", "initiated"].includes(attempt.status)) {
    return orderJsonError(
      attempt.status === "pending"
        ? "Payment verification is pending"
        : "Payment cannot be initiated",
      409,
    );
  }

  try {
    const checkout = buildPayuCheckout({
      merchantTransactionId: attempt.provider_merchant_txn_id,
      paymentAttemptId: attempt.id,
      amountPaise: attempt.amount_paise,
      productInfo: attempt.expected_product_info,
      customerName: attempt.customer_name,
      customerEmail: attempt.customer_email,
      customerPhone: customerPhone(order.customer_snapshot),
    });

    if (attempt.status === "created") {
      const { data: initiated, error: updateError } = await admin
        .from("payment_attempts")
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
        const { data: current } = await admin
          .from("payment_attempts")
          .select("status")
          .eq("id", attempt.id)
          .maybeSingle();
        if (current?.status !== "initiated") {
          return orderJsonError("Payment attempt state changed", 409);
        }
      }
    }

    return orderJson(checkout);
  } catch (initiationError) {
    console.error("PayU initiation failed", {
      attemptId: attempt.id,
      error:
        initiationError instanceof Error
          ? initiationError.message
          : "unknown",
    });
    return orderJsonError("Secure payment could not be started", 503);
  }
}
