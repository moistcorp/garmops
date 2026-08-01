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
    active: [
      "action_required",
      "payment_incomplete",
      "payment_due",
      "order_submitted",
      "under_review",
      "awaiting_approval",
      "approved",
      "in_production",
      "quality_check",
      "ready_to_dispatch",
      "dispatched",
      "on_hold",
    ],
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
  customerUserId: string,
  orderNumber: string,
) {
  const orderResult = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, organization_id, customer_user_id, design_project_id, design_version_id, status, public_status, currency, subtotal_paise, shipping_paise, tax_estimate_paise, estimated_total_paise, reservation_amount_paise, amount_paid_paise, pricing_version, configuration_schema_version, customer_reference, po_number, requested_delivery_date, estimated_dispatch_at, billing_snapshot, shipping_snapshot, customer_snapshot, company_snapshot, terms_snapshot, submitted_at, reservation_paid_at, expires_at",
    )
    .eq("organization_id", organizationId)
    .eq("customer_user_id", customerUserId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (orderResult.error || !orderResult.data) {
    return {
      order: orderResult,
      items: { data: null, error: null },
      history: { data: null, error: null },
      comments: { data: null, error: null },
      payments: [],
      approvals: [],
      shipments: [],
      shipmentEvents: [],
      files: [],
    };
  }

  const customerApprovals = supabase.from("approvals") as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{
          data: Array<{
            id: string;
            design_version_id: string;
            approval_pdf_file_id: string | null;
            status: string;
            expires_at: string | null;
            viewed_at: string | null;
            responded_at: string | null;
            response_note: string | null;
            snapshot_sha256: string | null;
            revoked_at: string | null;
            created_at: string;
          }> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const [items, history, comments, payments, approvals, shipments, files] = await Promise.all([
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
    supabase
      .from("order_comments")
      .select(
        "id, author_user_id, body, action_required, action_type, resolved_at, created_at",
      )
      .eq("order_id", orderResult.data.id)
      .eq("visibility", "customer")
      .order("created_at"),
    getSafePaymentAttempts(orderResult.data.id),
    customerApprovals
      .select("id, design_version_id, approval_pdf_file_id, status, expires_at, viewed_at, responded_at, response_note, snapshot_sha256, revoked_at, created_at")
      .eq("order_id", orderResult.data.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipments")
      .select("id, shipment_number, carrier, tracking_number, tracking_url, status, package_count, dispatched_at, estimated_delivery_at, delivered_at, customer_visible_note, created_at")
      .eq("order_id", orderResult.data.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_files")
      .select("id, kind, original_filename, safe_filename, content_type, scan_status, created_at")
      .eq("order_id", orderResult.data.id)
      .eq("visibility", "customer")
      .is("deleted_at", null)
      .in("scan_status", ["clean", "not_required"])
      .order("created_at", { ascending: false }),
  ]);

  const { data: shipmentEvents, error: shipmentEventsError } = await (
    supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: Array<{
        id: string;
        shipment_id: string;
        status: string;
        occurred_at: string;
        location: string | null;
        customer_message: string | null;
      }> | null;
      error: { message: string } | null;
    }>
  )("customer_shipment_events", { p_order_id: orderResult.data.id });

  const phase11Error =
    approvals.error ?? shipments.error ?? files.error ?? shipmentEventsError;
  if (phase11Error) throw new Error("Order history could not be loaded");

  return { order: orderResult, items, history, comments, payments, approvals: approvals.data ?? [], shipments: shipments.data ?? [], shipmentEvents: shipmentEvents ?? [], files: files.data ?? [] };
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
