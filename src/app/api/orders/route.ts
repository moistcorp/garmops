import { NextRequest } from "next/server";
import { authenticateOrderApi, orderJson, orderJsonError } from "@/lib/orders/api";
import { listCustomerOrders } from "@/lib/orders/dal";
import { orderListFilterSchema } from "@/lib/orders/schema";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { const auth = await authenticateOrderApi(); if (!auth.ok) return auth.response; const filter = orderListFilterSchema.safeParse(request.nextUrl.searchParams.get("filter") ?? "all"); if (!filter.success) return orderJsonError("Invalid order filter", 400); const { data, error } = await listCustomerOrders(auth.supabase, auth.user.id, filter.data); if (error) return orderJsonError("Orders could not be loaded", 500); return orderJson({ orders: data ?? [] }); }
