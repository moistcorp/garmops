import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.generated";

import type { OrderListFilter } from "./schema";

type OrderClient = SupabaseClient<Database>;
type PublicOrderStatus =
  Database["public"]["Enums"]["public_order_status"];

const listSelect =
  "id, order_number, order_type, status, public_status, currency, estimated_total_paise, reservation_amount_paise, amount_paid_paise, requested_delivery_date, estimated_dispatch_at, submitted_at, expires_at, order_items(product_name, quantity)";

export function listCustomerOrders(
  supabase: OrderClient,
  organizationId: string,
  filter: OrderListFilter,
) {
  let query = supabase
    .from("orders")
    .select(listSelect)
    .eq("organization_id", organizationId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  const statuses: Partial<Record<OrderListFilter, PublicOrderStatus[]>> = {
    action_required: ["action_required"],
    awaiting_payment: ["payment_incomplete"],
    under_review: ["order_submitted", "under_review", "awaiting_approval"],
    in_production: [
      "approved",
      "in_production",
      "quality_check",
      "ready_to_dispatch",
    ],
    dispatched: ["dispatched"],
    completed: ["delivered"],
    cancelled: ["cancelled"],
  };
  const selected = statuses[filter];
  if (selected) query = query.in("public_status", selected);
  return query;
}

export async function getCustomerOrder(
  supabase: OrderClient,
  organizationId: string,
  orderNumber: string,
) {
  const orderResult = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, organization_id, customer_user_id, design_project_id, design_version_id, status, public_status, currency, subtotal_paise, shipping_paise, tax_estimate_paise, estimated_total_paise, reservation_amount_paise, amount_paid_paise, pricing_version, configuration_schema_version, customer_reference, po_number, requested_delivery_date, estimated_dispatch_at, billing_snapshot, shipping_snapshot, customer_snapshot, company_snapshot, terms_snapshot, submitted_at, reservation_paid_at, expires_at",
    )
    .eq("organization_id", organizationId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    return {
      order: orderResult,
      items: { data: null, error: null },
      history: { data: null, error: null },
      payments: [],
    };
  }

  const [items, history, payments] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "id, line_number, product_id, product_slug, product_name, product_snapshot, colour_snapshot, decoration_snapshot, artwork_snapshot, neck_label_snapshot, size_breakdown, quantity, unit_price_paise, line_total_paise",
      )
      .eq("order_id", orderResult.data.id)
      .order("line_number"),
    supabase
      .from("order_status_history")
      .select(
        "id, to_status, public_status, customer_message, metadata, created_at",
      )
      .eq("order_id", orderResult.data.id)
      .eq("customer_visible", true)
      .order("created_at"),
    getSafePaymentAttempts(orderResult.data.id),
  ]);

  return { order: orderResult, items, history, payments };
}

export async function getSafePaymentAttempts(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_attempts")
    .select(
      "id, attempt_number, purpose, amount_paise, currency, status, initiated_at, paid_at, failed_at, created_at",
    )
    .eq("order_id", orderId)
    .order("attempt_number", { ascending: false });

  if (error) throw new Error("Payment history could not be loaded");
  return data ?? [];
}
