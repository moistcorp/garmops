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
import { safeInternalPath } from "@/lib/auth/redirects";
import { submitCustomOrderRequestSchema } from "@/lib/orders/schema";
import { prepareCustomCheckout } from "@/lib/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = submitCustomOrderRequestSchema.extend({
  cartId: z.string().trim().min(1).max(160),
  returnPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => safeInternalPath(value, "") === value, "Invalid return path"),
});

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

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Invalid checkout preparation", 400, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { cartId, returnPath, ...orderRequest } = parsed.data;
  try {
    const checkout = await prepareCustomCheckout({
      supabase: auth.supabase,
      user: auth.user,
      request: orderRequest,
      cartId,
      returnPath,
    });
    return orderJson({ checkout }, checkout.alreadyFinalized ? 200 : 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout could not be prepared";
    const status = /access|required|belong/i.test(message)
      ? 403
      : /unavailable|submitted|expired|match|changed|linked/i.test(message)
        ? 409
        : 422;
    return orderJsonError(message, status);
  }
}
