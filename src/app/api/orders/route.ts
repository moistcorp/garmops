import { NextRequest } from "next/server";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  orderJson,
  orderJsonError,
} from "@/lib/orders/api";
import { listCustomerOrders } from "@/lib/orders/dal";
import { orderListFilterSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!durableCustomOrdersAvailable()) {
    return orderJsonError("Durable custom ordering is unavailable", 503);
  }

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
    return orderJsonError("Organization access is unavailable", 403);
  }

  const filter = orderListFilterSchema.safeParse(
    request.nextUrl.searchParams.get("filter") ?? "all",
  );
  if (!filter.success) return orderJsonError("Invalid order filter", 400);

  const { data, error } = await listCustomerOrders(
    auth.supabase,
    membership.organization_id,
    filter.data,
  );
  if (error) return orderJsonError("Orders could not be loaded", 500);
  return orderJson({ orders: data ?? [] });
}
