import { z } from "zod";

const orderNumber = z.string().regex(/^GAR-\d{4}-\d{6}$/);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalDateTime = z.union([z.string().datetime({ offset: true }), z.literal("")]);
const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().max(999).optional(),
);
const trackingUrl = z
  .union([z.string().url().max(1000), z.literal("")])
  .transform((value) => value || undefined)
  .refine((value) => !value || value.startsWith("https://"), "Tracking URL must use HTTPS");

export const approvalRequestSchema = z
  .object({
    orderId: z.string().uuid(),
    orderNumber,
    designVersionId: z.string().uuid(),
    approvalPdfFileId: z.string().uuid(),
    recipientType: z.enum(["company", "external"]),
    requestedFromUserId: z.union([z.string().uuid(), z.literal("")]),
    requestedFromEmail: z.union([z.string().email().max(254), z.literal("")]),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .superRefine((value, context) => {
    if (value.recipientType === "company" && !value.requestedFromUserId) {
      context.addIssue({
        code: "custom",
        path: ["requestedFromUserId"],
        message: "Select a company approver",
      });
    }
    if (value.recipientType === "external" && !value.requestedFromEmail) {
      context.addIssue({
        code: "custom",
        path: ["requestedFromEmail"],
        message: "Enter the external approver email",
      });
    }
  });

export const approvalResponseSchema = z.object({
  approvalId: z.string().uuid(),
  orderNumber,
  decision: z.enum(["approved", "changes_requested"]),
  responseNote: optionalText(4000),
});

export const externalApprovalResponseSchema = z.object({
  token: z.string().min(32).max(512),
  decision: z.enum(["approved", "changes_requested"]),
  responseNote: optionalText(4000),
});

export const revokeApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  orderNumber,
  reason: z.string().trim().min(1).max(1000),
});

export const fileReviewSchema = z.object({
  fileId: z.string().uuid(),
  orderNumber,
  scanStatus: z.enum(["clean", "rejected"]),
  reviewNote: z.string().trim().min(1).max(1000),
});

const shipmentFields = {
  orderNumber,
  carrier: optionalText(120),
  trackingNumber: optionalText(160),
  trackingUrl,
  packageCount: optionalPositiveInteger,
  estimatedDeliveryAt: optionalDateTime,
  customerVisibleNote: optionalText(1000),
};

function requireCarrierOrTracking(
  value: { carrier?: string; trackingNumber?: string },
  context: z.RefinementCtx,
) {
  if (!value.carrier && !value.trackingNumber) {
    context.addIssue({
      code: "custom",
      path: ["carrier"],
      message: "Carrier or tracking number is required",
    });
  }
}

export const shipmentCreateSchema = z
  .object({ orderId: z.string().uuid(), ...shipmentFields })
  .superRefine(requireCarrierOrTracking);

export const shipmentUpdateSchema = z
  .object({
    shipmentId: z.string().uuid(),
    ...shipmentFields,
    status: z.enum(["preparing", "dispatched", "in_transit", "out_for_delivery", "exception", "delivered", "cancelled"]),
    eventLocation: optionalText(200),
    internalNote: optionalText(4000),
  })
  .superRefine(requireCarrierOrTracking);

export const notificationIdSchema = z.string().uuid();
export const reorderSchema = z.object({
  orderNumber,
  acceptedTerms: z.literal("on"),
  idempotencyKey: z.string().uuid(),
});
