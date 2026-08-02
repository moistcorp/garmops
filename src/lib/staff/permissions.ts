export const STAFF_PERMISSIONS = [
  "view_all_orders",
  "change_order_status",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
