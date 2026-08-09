import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database.generated";
import type { OrderListFilter } from "./schema";

type OrderClient = SupabaseClient<Database>;
const listSelect = "id, order_number, order_type, status, public_status, currency, total_paise, amount_paid_paise, requested_delivery_date, confirmed_at, created_at, order_items(product_name, quantity)";

export const CUSTOMER_ORDER_PAGE_SIZE = 20;

export function listCustomerOrders(
  supabase: OrderClient,
  customerUserId: string,
  filter: OrderListFilter,
  page = 1,
) {
  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * CUSTOMER_ORDER_PAGE_SIZE;
  const to = from + CUSTOMER_ORDER_PAGE_SIZE - 1;
  let query = supabase
    .from("orders")
    .select(listSelect, { count: "exact" })
    .eq("customer_user_id", customerUserId)
    .order("created_at", { ascending: false })
    .range(from, to);
  const statuses: Partial<Record<OrderListFilter, readonly Enums<"public_order_status">[]>> = {
    active: ["order_received", "artwork_under_review", "approved_for_production", "in_production", "quality_check_and_packing", "preparing_dispatch", "shipped", "action_required"],
    completed: ["delivered"],
    cancelled: ["cancelled"],
  };
  const selected = statuses[filter]; if (selected) query = query.in("public_status", selected);
  return query;
}

export async function getCustomerOrder(supabase: OrderClient, customerUserId: string, orderNumber: string) {
  const order = await supabase.from("orders").select("id, order_number, order_type, customer_user_id, status, public_status, currency, subtotal_paise, discount_paise, taxable_value_paise, tax_paise, total_paise, amount_paid_paise, customer_reference, requested_delivery_date, shipping_snapshot, billing_snapshot, customer_snapshot, business_snapshot, configuration_snapshot, shipping_charge_paise, confirmed_at, created_at").eq("customer_user_id", customerUserId).eq("order_number", orderNumber).maybeSingle();
  if (order.error || !order.data) return { order, items: { data: null, error: null }, history: { data: null, error: null }, payments: { data: [], error: null }, invoices: { data: [], error: null }, artworkRequirements: { data: [], error: null } };
  const [items, history, payments, invoices, artworkRequirements] = await Promise.all([
    supabase.from("order_items").select("id, line_number, product_name, product_snapshot, colour_snapshot, decoration_snapshot, artwork_snapshot, neck_label_snapshot, size_breakdown, quantity, unit_price_paise, line_total_paise").eq("order_id", order.data.id).order("line_number"),
    supabase.rpc("customer_order_history", { p_order_id: order.data.id }),
    supabase.rpc("customer_payment_summaries", { p_order_id: order.data.id }),
    supabase.from("invoices").select("id, invoice_number, status, total_paise, pdf_file_id, created_at").eq("order_id", order.data.id).order("created_at", { ascending: false }),
    supabase.rpc("customer_artwork_requirements", { p_order_id: order.data.id }),
  ]);
  return { order, items, history, payments, invoices, artworkRequirements };
}
