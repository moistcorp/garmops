import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/staff/statuses";

export const staffOrderIdSchema = z.string().uuid();
export const staffOrderNumberSchema = z.string().regex(/^(GAR|SAM)-\d{4}-\d{6}$/);

export const statusTransitionSchema = z.object({
  orderId: staffOrderIdSchema,
  orderNumber: staffOrderNumberSchema,
  toStatus: z.enum(ORDER_STATUSES),
  customerMessage: z.string().trim().max(1000).optional(),
  internalNote: z.string().trim().max(4000).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export const artworkReviewSchema = z.object({
  fileId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.decision !== "approve" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required" });
  }
});
