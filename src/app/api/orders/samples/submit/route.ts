import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

import {
  authenticateOrderApi,
  sampleOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { submitSampleOrderRequestSchema } from "@/lib/orders/sampleSchema";
import { submitSampleOrder } from "@/lib/orders/sampleService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeSubmissionError(error: unknown): {
  message: string;
  status: number;
  code: string;
} {
  const internal = error instanceof Error ? error.message : "";
  if (/customer account access|required|identity/i.test(internal)) {
    return {
      message: "Customer login is required for sample checkout",
      status: 403,
      code: "CUSTOMER_ACCESS_DENIED",
    };
  }
  if (/unavailable|quantity|items|size|price|subtotal/i.test(internal)) {
    return {
      message: internal,
      status: 409,
      code: "SAMPLE_CART_CHANGED",
    };
  }
  if (/idempotency key request hash mismatch/i.test(internal)) {
    return {
      message: "Checkout details changed. Refresh and submit again.",
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
    };
  }
  return {
    message: "The sample order could not be saved",
    status: 409,
    code: "SAMPLE_ORDER_SUBMISSION_FAILED",
  };
}

export async function POST(request: NextRequest) {
  if (!sampleOrdersAvailable()) {
    return orderJsonError("Durable sample checkout is unavailable", 503);
  }
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const body = await readOrderJson(request, 64 * 1024);
  if (!body.ok) return body.response;
  const parsed = submitSampleOrderRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Invalid sample checkout details", 400, {
      code: "INVALID_SAMPLE_ORDER",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const requestId = randomUUID();
  try {
    const result = await submitSampleOrder({
      supabase: auth.supabase,
      user: auth.user,
      request: parsed.data,
    });
    return orderJson({ order: result }, 201);
  } catch (submissionError) {
    const safe = safeSubmissionError(submissionError);
    console.error("Durable sample order submission failed", {
      requestId,
      userId: auth.user.id,
      error:
        submissionError instanceof Error
          ? submissionError.message
          : "unknown error",
    });
    return orderJson(
      { error: safe.message, code: safe.code, requestId },
      safe.status,
    );
  }
}
