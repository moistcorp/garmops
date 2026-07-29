import { NextRequest } from "next/server";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import {
  orderNumberSchema,
  retryOrderPaymentRequestSchema,
} from "@/lib/orders/schema";
import { retryCustomOrderPayment } from "@/lib/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetryRouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function POST(
  request: NextRequest,
  context: RetryRouteContext,
) {
  if (!durableCustomOrdersAvailable()) {
    return orderJsonError("Durable custom ordering is unavailable", 503);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const { orderNumber } = await context.params;
  const number = orderNumberSchema.safeParse(orderNumber);
  if (!number.success) return orderJsonError("Order not found", 404);

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const body = await readOrderJson(request, 16 * 1024);
  if (!body.ok) return body.response;
  const parsed = retryOrderPaymentRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Invalid payment retry request", 400);
  }

  const { data: order, error } = await auth.supabase
    .from("orders")
    .select("id, organization_id")
    .eq("order_number", number.data)
    .maybeSingle();
  if (error || !order) return orderJsonError("Order not found", 404);

  const { data: membership } = await auth.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", order.organization_id)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .in("role", ["owner", "buyer"])
    .maybeSingle();
  if (!membership) return orderJsonError("Payment retry is unavailable", 403);

  try {
    const result = await retryCustomOrderPayment({
      orderId: order.id,
      userId: auth.user.id,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return orderJson(
      {
        paymentAttempt: {
          id: result.payment_attempt_id,
          attemptNumber: result.attempt_number,
          status: result.payment_status,
          created: result.created_new,
        },
      },
      result.created_new ? 201 : 200,
    );
  } catch (retryError) {
    const message =
      retryError instanceof Error
        ? retryError.message
        : "Payment retry could not be prepared";
    return orderJsonError(message, /access denied/i.test(message) ? 403 : 409);
  }
}
