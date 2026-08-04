import { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateOrderApi, hasExpectedOrderOrigin, orderJson, orderJsonError, readOrderJson } from "@/lib/orders/api";
import { prepareStaffQuoteCheckout } from "@/lib/quotes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  discountCode: z.string().trim().max(32).optional(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!hasExpectedOrderOrigin(request)) return orderJsonError("Invalid request origin", 403);
  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;
  const body = await readOrderJson(request, 8 * 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return orderJsonError("Accept the terms and privacy notice before payment", 400);
  try {
    const result = await prepareStaffQuoteCheckout({ token: (await context.params).token, user: auth.user, ...parsed.data });
    return orderJson(result);
  } catch (error) {
    return orderJsonError(error instanceof Error ? error.message : "Quotation payment could not be prepared", 409);
  }
}
