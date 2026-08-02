import { z } from "zod";

import type { Database } from "@/types/database.generated";

const orderStatuses = [
  "awaiting_payment",
  "payment_failed",
  "reservation_paid",
  "submitted_for_review",
  "needs_customer_action",
  "commercial_review",
  "quote_ready",
  "awaiting_quote_approval",
  "awaiting_balance_payment",
  "artwork_review",
  "awaiting_artwork_approval",
  "approved_for_production",
  "production_queued",
  "in_production",
  "quality_control",
  "packing",
  "ready_to_dispatch",
  "dispatched",
  "delivered",
  "on_hold",
  "cancelled",
  "refunded",
  "expired",
] as const satisfies readonly Database["public"]["Enums"]["order_status"][];

export const staffOrderIdSchema = z.string().uuid();
export const staffOrderNumberSchema = z
  .string()
  .regex(/^(GAR|SAM)-\d{4}-\d{6}$/);

export const statusTransitionSchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  toStatus: z.enum(orderStatuses),
  customerMessage: z.string().trim().max(1000).optional(),
  internalNote: z.string().trim().max(4000).optional(),
  reason: z.string().trim().max(1000).optional(),
});
