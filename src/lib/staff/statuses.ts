import type { Database } from "@/types/database.generated";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PublicOrderStatus =
  Database["public"]["Enums"]["public_order_status"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  reservation_paid: "Reservation paid",
  submitted_for_review: "Submitted for review",
  needs_customer_action: "Needs customer action",
  commercial_review: "Commercial review",
  quote_ready: "Quote ready",
  awaiting_quote_approval: "Awaiting quote approval",
  awaiting_balance_payment: "Awaiting balance payment",
  artwork_review: "Artwork review",
  awaiting_artwork_approval: "Awaiting artwork approval",
  approved_for_production: "Approved for production",
  production_queued: "Production queued",
  in_production: "In production",
  quality_control: "Quality control",
  packing: "Packing",
  ready_to_dispatch: "Ready to dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  on_hold: "On hold",
  cancelled: "Cancelled",
  refunded: "Refunded",
  expired: "Expired",
};

export const PUBLIC_STATUS_LABELS: Record<PublicOrderStatus, string> = {
  payment_incomplete: "Payment incomplete",
  order_submitted: "Order submitted",
  action_required: "Action required",
  under_review: "Under review",
  awaiting_approval: "Awaiting approval",
  payment_due: "Payment due",
  approved: "Approved",
  in_production: "In production",
  quality_check: "Quality check",
  ready_to_dispatch: "Ready to dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

export const PUBLIC_STATUS_BY_INTERNAL: Record<
  OrderStatus,
  PublicOrderStatus
> = {
  awaiting_payment: "payment_incomplete",
  payment_failed: "payment_incomplete",
  reservation_paid: "order_submitted",
  submitted_for_review: "order_submitted",
  needs_customer_action: "action_required",
  commercial_review: "under_review",
  quote_ready: "awaiting_approval",
  awaiting_quote_approval: "awaiting_approval",
  awaiting_balance_payment: "payment_due",
  artwork_review: "under_review",
  awaiting_artwork_approval: "awaiting_approval",
  approved_for_production: "approved",
  production_queued: "approved",
  in_production: "in_production",
  quality_control: "quality_check",
  packing: "quality_check",
  ready_to_dispatch: "ready_to_dispatch",
  dispatched: "dispatched",
  delivered: "delivered",
  on_hold: "on_hold",
  cancelled: "cancelled",
  refunded: "cancelled",
  expired: "payment_incomplete",
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["expired", "cancelled"],
  payment_failed: ["expired", "cancelled"],
  reservation_paid: ["submitted_for_review", "cancelled", "on_hold"],
  submitted_for_review: [
    "needs_customer_action",
    "commercial_review",
    "artwork_review",
    "on_hold",
    "cancelled",
  ],
  needs_customer_action: [
    "submitted_for_review",
    "commercial_review",
    "artwork_review",
    "on_hold",
    "cancelled",
  ],
  commercial_review: [
    "quote_ready",
    "needs_customer_action",
    "artwork_review",
    "on_hold",
    "cancelled",
  ],
  quote_ready: ["awaiting_quote_approval", "commercial_review", "cancelled"],
  awaiting_quote_approval: [
    "awaiting_balance_payment",
    "artwork_review",
    "needs_customer_action",
    "cancelled",
  ],
  awaiting_balance_payment: [
    "artwork_review",
    "approved_for_production",
    "needs_customer_action",
    "cancelled",
  ],
  artwork_review: [
    "awaiting_artwork_approval",
    "needs_customer_action",
    "on_hold",
    "cancelled",
  ],
  awaiting_artwork_approval: [
    "approved_for_production",
    "artwork_review",
    "needs_customer_action",
    "cancelled",
  ],
  approved_for_production: ["production_queued", "on_hold", "cancelled"],
  production_queued: ["in_production", "on_hold", "cancelled"],
  in_production: ["quality_control", "on_hold", "cancelled"],
  quality_control: ["packing", "in_production", "on_hold", "cancelled"],
  packing: ["ready_to_dispatch", "quality_control", "on_hold", "cancelled"],
  ready_to_dispatch: ["dispatched", "packing", "on_hold", "cancelled"],
  dispatched: ["delivered", "on_hold"],
  delivered: [],
  on_hold: [
    "submitted_for_review",
    "commercial_review",
    "artwork_review",
    "production_queued",
    "in_production",
    "quality_control",
    "packing",
    "ready_to_dispatch",
    "cancelled",
  ],
  cancelled: [],
  refunded: [],
  expired: [],
};

const SAMPLE_ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  submitted_for_review: [
    "needs_customer_action",
    "production_queued",
    "packing",
    "on_hold",
    "cancelled",
  ],
  needs_customer_action: [
    "submitted_for_review",
    "production_queued",
    "packing",
    "on_hold",
    "cancelled",
  ],
  production_queued: ["in_production", "packing", "on_hold", "cancelled"],
  in_production: ["quality_control", "packing", "on_hold", "cancelled"],
  quality_control: ["packing", "in_production", "on_hold", "cancelled"],
  packing: ["ready_to_dispatch", "quality_control", "on_hold", "cancelled"],
  ready_to_dispatch: ["dispatched", "packing", "on_hold", "cancelled"],
  dispatched: ["delivered", "on_hold"],
  on_hold: [
    "submitted_for_review",
    "production_queued",
    "in_production",
    "quality_control",
    "packing",
    "ready_to_dispatch",
    "cancelled",
  ],
};

export const HIGH_IMPACT_STATUSES = new Set<OrderStatus>([
  "cancelled",
  "refunded",
]);

export function allowedNextStatuses(
  status: OrderStatus,
  orderType?: Database["public"]["Enums"]["order_type"],
) {
  if (orderType === "sample_purchase" && SAMPLE_ORDER_TRANSITIONS[status]) {
    return SAMPLE_ORDER_TRANSITIONS[status];
  }
  return ORDER_TRANSITIONS[status];
}

const ROLE_STATUS_TARGETS: Partial<Record<
  import("@/lib/auth/constants").StaffRole,
  Set<OrderStatus>
>> = {
  sales: new Set([
    "submitted_for_review",
    "needs_customer_action",
    "commercial_review",
    "quote_ready",
    "awaiting_quote_approval",
    "awaiting_balance_payment",
    "artwork_review",
    "on_hold",
    "cancelled",
  ]),
  artwork: new Set([
    "artwork_review",
    "awaiting_artwork_approval",
    "needs_customer_action",
    "approved_for_production",
    "on_hold",
  ]),
  production: new Set([
    "production_queued",
    "in_production",
    "quality_control",
    "packing",
    "on_hold",
  ]),
  qc: new Set(["quality_control", "packing", "in_production", "on_hold"]),
  dispatch: new Set(["ready_to_dispatch", "dispatched", "delivered", "on_hold"]),
};

export function allowedNextStatusesForRole(
  status: OrderStatus,
  role: import("@/lib/auth/constants").StaffRole,
  orderType?: Database["public"]["Enums"]["order_type"],
) {
  const transitions = allowedNextStatuses(status, orderType);
  if (role === "super_admin" || role === "operations_admin") return transitions;
  const targets = ROLE_STATUS_TARGETS[role];
  return targets ? transitions.filter((target) => targets.has(target)) : [];
}
