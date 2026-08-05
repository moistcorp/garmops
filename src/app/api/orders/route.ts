import { NextRequest } from "next/server";
import { authenticateOrderApi, orderJson, orderJsonError } from "@/lib/orders/api";
import { listCustomerOrders } from "@/lib/orders/dal";
import { orderListFilterSchema, orderListPageSchema } from "@/lib/orders/schema";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;
  const filter = orderListFilterSchema.safeParse(
    request.nextUrl.searchParams.get("filter") ?? "all",
  );
  const page = orderListPageSchema.safeParse(
    request.nextUrl.searchParams.get("page") ?? "1",
  );
  if (!filter.success || !page.success) {
    return orderJsonError("Invalid order list parameters", 400);
  }
  const { data, error, count } = await listCustomerOrders(
    auth.supabase,
    auth.user.id,
    filter.data,
    page.data,
  );
  if (error) return orderJsonError("Orders could not be loaded", 500);
  return orderJson({ orders: data ?? [], count: count ?? 0, page: page.data });
}
