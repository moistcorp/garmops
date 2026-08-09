import type { StaffRole } from "@/lib/auth/constants";

export const ORDER_STATUSES = [
  "payment_confirmed",
  "order_review",
  "artwork_pending",
  "artwork_approved",
  "production_approved",
  "material_preparation",
  "printing",
  "stitching",
  "quality_check",
  "packing",
  "ready_to_dispatch",
  "dispatched",
  "delivered",
  "on_hold",
  "cancelled",
  "refund_pending",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PUBLIC_ORDER_STATUSES = [
  "order_received",
  "artwork_under_review",
  "approved_for_production",
  "in_production",
  "quality_check_and_packing",
  "preparing_dispatch",
  "shipped",
  "delivered",
  "action_required",
  "cancelled",
] as const;
export type PublicOrderStatus = (typeof PUBLIC_ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  payment_confirmed: "Payment confirmed",
  order_review: "Order review",
  artwork_pending: "Artwork pending",
  artwork_approved: "Artwork approved",
  production_approved: "Production approved",
  material_preparation: "Fabric / material preparation",
  printing: "Printing",
  stitching: "Stitching",
  quality_check: "Quality check",
  packing: "Packing",
  ready_to_dispatch: "Ready to dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  on_hold: "On hold",
  cancelled: "Cancelled",
  refund_pending: "Refund pending",
  refunded: "Refunded",
};

export const PUBLIC_STATUS_BY_INTERNAL: Record<OrderStatus, PublicOrderStatus> = {
  payment_confirmed: "order_received",
  order_review: "order_received",
  artwork_pending: "artwork_under_review",
  artwork_approved: "approved_for_production",
  production_approved: "approved_for_production",
  material_preparation: "in_production",
  printing: "in_production",
  stitching: "in_production",
  quality_check: "quality_check_and_packing",
  packing: "quality_check_and_packing",
  ready_to_dispatch: "preparing_dispatch",
  dispatched: "shipped",
  delivered: "delivered",
  on_hold: "action_required",
  cancelled: "cancelled",
  refund_pending: "cancelled",
  refunded: "cancelled",
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  payment_confirmed: ["order_review", "on_hold", "cancelled"],
  order_review: ["artwork_pending", "artwork_approved", "on_hold", "cancelled"],
  artwork_pending: ["artwork_approved", "on_hold", "cancelled"],
  artwork_approved: ["production_approved", "on_hold", "cancelled"],
  production_approved: ["material_preparation", "on_hold", "cancelled"],
  material_preparation: ["printing", "on_hold", "cancelled"],
  printing: ["stitching", "on_hold", "cancelled"],
  stitching: ["quality_check", "on_hold", "cancelled"],
  quality_check: ["packing", "printing", "on_hold", "cancelled"],
  packing: ["ready_to_dispatch", "quality_check", "on_hold", "cancelled"],
  ready_to_dispatch: ["dispatched", "packing", "on_hold", "cancelled"],
  dispatched: ["delivered", "on_hold"],
  delivered: [],
  on_hold: [
    "order_review",
    "artwork_pending",
    "artwork_approved",
    "production_approved",
    "material_preparation",
    "printing",
    "stitching",
    "quality_check",
    "packing",
    "ready_to_dispatch",
    "cancelled",
  ],
  cancelled: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
};

export function allowedNextStatusesForRole(status: OrderStatus, role: StaffRole) {
  const transitions = ORDER_TRANSITIONS[status] ?? [];
  if (role !== "founder" && role !== "operations") return [];
  return transitions.filter(
    (target) => !["cancelled", "refund_pending", "refunded"].includes(target),
  );
}
