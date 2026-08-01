import { NextRequest } from "next/server";

import {
  authenticateOrderApi,
  orderJson,
  orderJsonError,
} from "@/lib/orders/api";
import { getCustomerOrder } from "@/lib/orders/dal";
import { orderNumberSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRouteContext = {
  params: Promise<{ orderNumber: string }>;
};

export async function GET(
  _request: NextRequest,
  context: OrderRouteContext,
) {
  const { orderNumber } = await context.params;
  const number = orderNumberSchema.safeParse(orderNumber);
  if (!number.success) return orderJsonError("Order not found", 404);

  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;

  const { data: membership, error: membershipError } = await auth.supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return orderJsonError("Order not found", 404);
  }

  try {
    const result = await getCustomerOrder(
      auth.supabase,
      membership.organization_id,
      auth.user.id,
      number.data,
    );
    if (result.order.error || !result.order.data) {
      return orderJsonError("Order not found", 404);
    }
    if (result.items.error || result.history.error) {
      return orderJsonError("Order could not be loaded", 500);
    }

    return orderJson({
      order: {
        ...result.order.data,
        items: result.items.data ?? [],
        history: result.history.data ?? [],
        payments: result.payments,
      },
    });
  } catch {
    return orderJsonError("Order could not be loaded", 500);
  }
}
