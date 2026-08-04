import { z } from "zod";

import { orderAddressSchema } from "./schema";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().transform((value) => value || undefined);

export const sampleOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  size: z.string().trim().min(1).max(40),
  quantity: z.number().int().min(1).max(100),
}).strict();

export const submitSampleOrderRequestSchema = z.object({
  items: z.array(sampleOrderItemSchema).min(1).max(50),
  contact: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: optionalText(80),
    email: z.email().trim().toLowerCase().max(254),
    phone: z.string().trim().regex(/^(?:\+91|91|0)?[6-9][0-9]{9}$/),
  }).strict(),
  shipping: z.object({
    recipientName: z.string().trim().min(1).max(160),
    address: orderAddressSchema,
  }).strict(),
  orderNotes: optionalText(2_000),
  acceptedTerms: z.literal(true),
  idempotencyKey: z.uuid(),
}).strict();

export type SubmitSampleOrderRequest = z.infer<typeof submitSampleOrderRequestSchema>;
export type SampleOrderItemInput = z.infer<typeof sampleOrderItemSchema>;
