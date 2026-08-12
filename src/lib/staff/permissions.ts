export const STAFF_PERMISSIONS = [
  "view_all_orders",
  "change_order_status",
  "review_artwork",
  "manage_staff",
  "manage_discounts",
  "manage_refunds",
  "view_raw_payments",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
