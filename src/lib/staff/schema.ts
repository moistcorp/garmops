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

export const assignmentSchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  assignedStaffUserId: z.union([z.string().uuid(), z.literal("")]),
  assignedTeam: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const prioritySchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  reason: z.string().trim().max(1000).optional(),
});

const optionalDateTime = z.union([
  z.string().datetime({ offset: true }),
  z.literal(""),
]);

export const expectedDatesSchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  expectedApprovalAt: optionalDateTime,
  expectedProductionAt: optionalDateTime,
  expectedQcAt: optionalDateTime,
  estimatedDispatchAt: optionalDateTime,
});

export const commentSchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  visibility: z.enum(["customer", "staff_only"]),
  body: z.string().trim().min(1).max(10000),
  actionRequired: z.boolean(),
  actionType: z.string().trim().max(80).optional(),
});

export const resolveActionSchema = z.object({
  commentId: z.string().uuid(),
  orderNumber: staffOrderNumberSchema,
  resolutionNote: z.string().trim().max(4000).optional(),
});

export const fileVisibilitySchema = z.object({
  fileId: z.string().uuid(),
  orderNumber: staffOrderNumberSchema,
  visibility: z.enum(["customer", "staff_only"]),
  reason: z.string().trim().min(1).max(1000),
});
