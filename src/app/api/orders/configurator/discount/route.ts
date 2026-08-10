import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateOrderApi,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    code: z.string().trim().toUpperCase().min(1).max(40),
    subtotalPaise: z.number().int().positive().max(100_000_000_000),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasExpectedOrderOrigin(request)) {
    return orderJsonError("Invalid request origin", 403);
  }

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const body = await readOrderJson(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return orderJsonError("Enter a valid discount code", 400);
  }

  const { data, error } = await auth.supabase.rpc("validate_discount_code", {
    p_code: parsed.data.code,
    p_customer_user_id: auth.user.id,
    p_subtotal_paise: parsed.data.subtotalPaise,
  });
  const result = data?.[0];

  if (error || !result) {
    return orderJsonError("Discount code is invalid or unavailable", 422);
  }

  return orderJson({
    code: result.normalized_code,
    discountPaise: Number(result.discount_paise),
  });
}

