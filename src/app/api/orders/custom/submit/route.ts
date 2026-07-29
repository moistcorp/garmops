import { NextRequest } from "next/server";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { submitCustomOrderRequestSchema } from "@/lib/orders/schema";
import { submitCustomOrder } from "@/lib/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!durableCustomOrdersAvailable()) {
    return orderJsonError("Durable custom ordering is unavailable", 503);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const body = await readOrderJson(request);
  if (!body.ok) return body.response;

  const parsed = submitCustomOrderRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Invalid order submission", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const result = await submitCustomOrder({
      supabase: auth.supabase,
      user: auth.user,
      request: parsed.data,
    });

    return orderJson(
      {
        order: {
          id: result.order_id,
          orderNumber: result.order_number,
          submittedAt: result.submitted_at,
          paymentAttemptId: result.payment_attempt_id,
          reservationAmountPaise: result.reservationAmountPaise,
          estimatedTotalPaise: result.estimatedTotalPaise,
          confirmationUrl: `/account/orders/${encodeURIComponent(result.order_number)}/confirmation`,
        },
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Order could not be submitted";
    const status = /access|required|belong/i.test(message)
      ? 403
      : /unavailable|submitted|expired|match|complete|finalized/i.test(message)
        ? 409
        : 422;
    return orderJsonError(message, status);
  }
}
