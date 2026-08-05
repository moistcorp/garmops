import { z } from "zod";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().transform((value) => value || undefined);

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const orderAddressSchema = z.object({
  country: z.literal("India"),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: optionalText(200),
  zip: z.string().trim().regex(/^[1-9][0-9]{5}$/),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
}).strict();

const checkoutContactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().max(254),
  phone: z.string().trim().regex(/^(?:\+91|91|0)?[6-9][0-9]{9}$/),
  department: optionalText(120),
}).strict();

const checkoutShippingSchema = z.object({
  recipientName: z.string().trim().min(1).max(160),
  address: orderAddressSchema,
  multipleLocations: z.boolean().default(false),
  multipleLocationsNotes: optionalText(2_000),
}).strict().refine(
  (shipping) => !shipping.multipleLocations || Boolean(shipping.multipleLocationsNotes),
  { path: ["multipleLocationsNotes"], message: "Multiple delivery locations require instructions" },
);

const checkoutBillingSchema = z.object({
  entity: z.string().trim().min(1).max(200),
  address: orderAddressSchema,
  accountsPayableEmail: z.email().trim().toLowerCase().max(254),
  gstin: gstinSchema,
}).strict();

const sizeQuantitiesSchema = z.record(
  z.string().trim().min(1).max(20),
  z.number().int().min(0).max(1_000_000),
).refine((sizes) => Object.keys(sizes).length > 0, "Size allocation is required")
  .refine((sizes) => Object.values(sizes).some((quantity) => quantity > 0), "At least one size needs a quantity");

export const submitCustomOrderRequestSchema = z.object({
  designProjectId: z.uuid(),
  designVersion: z.number().int().positive(),
  sizeQuantities: sizeQuantitiesSchema,
  deliveryType: z.enum(["rush", "standard", "flexible"]),
  requestedDeliveryDate: z.iso.date(),
  projectName: z.string().trim().min(1).max(160),
  contact: checkoutContactSchema,
  shipping: checkoutShippingSchema,
  billing: checkoutBillingSchema,
  orderNotes: optionalText(4_000),
  receiveEmails: z.boolean().default(false),
  discountCode: optionalText(40),
  saveShippingToAccount: z.boolean().default(false),
  saveBillingToAccount: z.boolean().default(false),
  acceptedTerms: z.literal(true),
  acceptedTermsVersion: z.string().trim().min(1).max(80),
  acceptedPrivacyVersion: z.string().trim().min(1).max(80),
  idempotencyKey: z.uuid(),
}).strict();

export const retryOrderPaymentRequestSchema = z.object({ idempotencyKey: z.uuid() }).strict();
export const orderNumberSchema = z.string().regex(/^(?:GAR|SAM)-[0-9]{4}-[0-9]{6}$/);
export const orderListFilterSchema = z.enum(["all", "active", "completed", "cancelled"]);
export const orderListPageSchema = z.coerce.number().int().min(1).max(10_000);

export type SubmitCustomOrderRequest = z.infer<typeof submitCustomOrderRequestSchema>;
export type OrderListFilter = z.infer<typeof orderListFilterSchema>;
