import { NextRequest } from "next/server";
import { authenticateOrderApi, orderJson, orderJsonError } from "@/lib/orders/api";
import { getCustomerOrder } from "@/lib/orders/dal";
import { orderNumberSchema } from "@/lib/orders/schema";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orderNumber: string }> };
export async function GET(_request: NextRequest, context: Context) { const parsed = orderNumberSchema.safeParse((await context.params).orderNumber); if (!parsed.success) return orderJsonError("Order not found", 404); const auth = await authenticateOrderApi(); if (!auth.ok) return auth.response; const result = await getCustomerOrder(auth.supabase, auth.user.id, parsed.data); if (result.order.error || !result.order.data) return orderJsonError("Order not found", 404); if (result.items.error || result.history.error || result.payments.error || result.invoices.error) return orderJsonError("Order could not be loaded", 500); return orderJson({ order: { ...result.order.data, items: result.items.data ?? [], history: result.history.data ?? [], payments: result.payments.data ?? [], invoices: result.invoices.data ?? [] } }); }
