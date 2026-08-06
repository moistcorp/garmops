export const STAFF_PERMISSIONS = [
  "view_all_orders",
  "change_order_status",
  "review_artwork",
  "edit_order_configuration",
  "create_staff_quote",
  "manage_shipping_payments",
  "manage_staff",
  "manage_discounts",
  "manage_refunds",
  "view_raw_payments",
  "override_order_workflow",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
