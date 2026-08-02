import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.generated";

import type { OrderListFilter } from "./schema";

type OrderClient = SupabaseClient<Database>;
type PublicOrderStatus = Database["public"]["Enums"]["public_order_status"];

const listSelect =
  "id, order_number, order_type, status, public_status, currency, estimated_total_paise, reservation_amount_paise, amount_paid_paise, requested_delivery_date, submitted_at, expires_at, order_items(product_name, quantity)";

export function listCustomerOrders(
  supabase: OrderClient,
  organizationId: string,
  customerUserId: string,
  filter: OrderListFilter,
) {
  let query = supabase
    .from("orders")
    .select(listSelect)
    .eq("organization_id", organizationId)
    .eq("customer_user_id", customerUserId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  const statuses: Partial<Record<OrderListFilter, PublicOrderStatus[]>> = {
    active: ["action_required", "payment_incomplete", "payment_due", "order_submitted", "under_review", "awaiting_approval", "approved", "in_production", "quality_check", "ready_to_dispatch", "dispatched", "on_hold"],
    completed: ["delivered"],
    cancelled: ["cancelled"],
  };
  const selected = statuses[filter];
  if (selected) query = query.in("public_status", selected);
  return query;
}

/** Read-only data needed by the retained customer order summary. */
export async function getCustomerOrder(
  supabase: OrderClient,
  organizationId: string,
  customerUserId: string,
  orderNumber: string,
) {
  const order = await supabase
    .from("orders")
    .select("id, order_number, order_type, organization_id, customer_user_id, status, public_status, currency, estimated_total_paise, reservation_amount_paise, requested_delivery_date, shipping_snapshot, submitted_at")
    .eq("organization_id", organizationId)
    .eq("customer_user_id", customerUserId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (order.error || !order.data) {
    return { order, items: { data: null, error: null }, history: { data: null, error: null }, payments: [] };
  }

  const [items, history, payments] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, line_number, product_name, product_snapshot, colour_snapshot, decoration_snapshot, artwork_snapshot, neck_label_snapshot, size_breakdown, quantity, line_total_paise")
      .eq("order_id", order.data.id)
      .order("line_number"),
    supabase
      .from("order_status_history")
      .select("id, to_status, public_status, customer_message, created_at")
      .eq("order_id", order.data.id)
      .eq("customer_visible", true)
      .order("created_at"),
    getSafePaymentAttempts(order.data.id).catch(() => []),
  ]);

  return { order, items, history, payments };
}

export async function getSafePaymentAttempts(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_attempts")
    .select("id, attempt_number, purpose, amount_paise, status, created_at")
    .eq("order_id", orderId)
    .order("attempt_number", { ascending: false });

  if (error) throw new Error("Payment history could not be loaded");
  return data ?? [];
}
