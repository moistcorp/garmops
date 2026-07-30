import { randomUUID } from "node:crypto";
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

function safeRetryError(error: unknown): {
  message: string;
  status: number;
  code: string;
} {
  const internal = error instanceof Error ? error.message : "";
  if (/access denied/i.test(internal)) {
    return {
      message: "Payment retry is unavailable",
      status: 403,
      code: "ORGANIZATION_ACCESS_DENIED",
    };
  }
  if (/already complete|already paid/i.test(internal)) {
    return {
      message: "This order has already been paid",
      status: 409,
      code: "ORDER_ALREADY_PAID",
    };
  }
  if (/expired/i.test(internal)) {
    return {
      message: "The order payment window has expired",
      status: 409,
      code: "ORDER_EXPIRED",
    };
  }
  if (/not awaiting payment/i.test(internal)) {
    return {
      message: "This order is not awaiting payment",
      status: 409,
      code: "PAYMENT_RETRY_UNAVAILABLE",
    };
  }
  if (/maximum payment attempts/i.test(internal)) {
    return {
      message: "Please contact Garmops support to continue payment",
      status: 409,
      code: "PAYMENT_RETRY_LIMIT_REACHED",
    };
  }
  return {
    message: "Payment retry could not be prepared",
    status: 409,
    code: "PAYMENT_RETRY_FAILED",
  };
}

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

  const requestId = randomUUID();
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
  if (!membership) {
    return orderJsonError("Payment retry is unavailable", 403);
  }

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
    const safe = safeRetryError(retryError);
    console.error("Payment retry preparation failed", {
      requestId,
      orderNumber: number.data,
      userId: auth.user.id,
      error:
        retryError instanceof Error ? retryError.message : "unknown error",
    });
    return orderJson(
      {
        error: safe.message,
        code: safe.code,
        requestId,
      },
      safe.status,
    );
  }
}
