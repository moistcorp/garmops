import { z } from "zod";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .max(maximum)
      .optional()
      .transform((value) => value ?? null),
  );

const optionalPhone = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number")
    .optional()
    .transform((value) => {
      if (!value) return null;
      if (value.startsWith("+")) return value;
      return value.length === 10 ? `+91${value}` : `+${value}`;
    }),
);

export const companyDetailsSchema = z
  .object({
    companyName: optionalText(200),
    gstin: z
      .preprocess(
        (value) =>
          typeof value === "string" && value.trim() === "" ? undefined : value,
        z.string().trim().toUpperCase().optional(),
      )
      .refine(
        (value) =>
          !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value),
        "Enter a valid GSTIN",
      )
      .transform((value) => value ?? null),
  })
  .superRefine((value, context) => {
    if (value.gstin && !value.companyName) {
      context.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Enter the legal business name when adding a GSTIN",
      });
    }
  });

export const savedAddressSchema = z.object({
  addressId: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().uuid().optional(),
  ),
  label: optionalText(80),
  contactName: optionalText(160),
  phone: optionalPhone,
  line1: z.string().trim().min(1, "Enter the street address").max(200),
  line2: optionalText(200),
  landmark: optionalText(160),
  city: z.string().trim().min(1, "Enter the city").max(100),
  state: z.string().trim().min(1, "Select the state").max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid six-digit PIN code"),
  useAsShipping: z.preprocess((value) => value === "on", z.boolean()),
});

export type SavedAddressInput = z.infer<typeof savedAddressSchema>;

export function addressMutation(input: SavedAddressInput) {
  return {
    label: input.label,
    contact_name: input.contactName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2,
    landmark: input.landmark,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
    country_code: "IN",
  } as const;
}
