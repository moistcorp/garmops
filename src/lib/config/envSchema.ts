import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (maximum = 1024) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(maximum).optional());

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional(),
);

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
    APP_TIMEZONE: z.literal("Asia/Kolkata").default("Asia/Kolkata"),
    APP_SURFACE: z.enum(["customer", "staff"]).default("customer"),
    NEXT_PUBLIC_APP_SURFACE: z.enum(["customer", "staff"]).default("customer"),
    NEXT_PUBLIC_APP_URL: z.string().trim().url().default("http://localhost:3000"),
    NEXT_PUBLIC_CUSTOMER_APP_URL: z.string().trim().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STAFF_APP_URL: z.string().trim().url().default("http://localhost:3001"),
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: z.string().trim().url().default("http://localhost:9000"),
    MEDUSA_PUBLISHABLE_API_KEY: optionalText(512),

    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText(512),
    NEXT_PUBLIC_ACCOUNTS_ENABLED: booleanValue,
    NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED: booleanValue,
    STAFF_PORTAL_ENABLED: booleanValue,
    CLOUD_DESIGNS_ENABLED: booleanValue,
    CONFIGURATOR_CHECKOUT_ENABLED: booleanValue,
    SAMPLE_CHECKOUT_ENABLED: booleanValue,
    ENABLE_REALTIME_ORDER_UPDATES: booleanValue,
    ENABLE_WHATSAPP_NOTIFICATIONS: booleanValue,
    ENABLE_SMS_NOTIFICATIONS: booleanValue,

    NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
    SENTRY_ENABLED: booleanValue,
  })
  .passthrough()
  .superRefine((environment, context) => {
    if (environment.APP_SURFACE !== environment.NEXT_PUBLIC_APP_SURFACE) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_APP_SURFACE"],
        message: "APP_SURFACE and NEXT_PUBLIC_APP_SURFACE must match",
      });
    }

    const expectedOrigin = new URL(
      environment.APP_SURFACE === "staff"
        ? environment.NEXT_PUBLIC_STAFF_APP_URL
        : environment.NEXT_PUBLIC_CUSTOMER_APP_URL,
    ).origin;
    if (new URL(environment.NEXT_PUBLIC_APP_URL).origin !== expectedOrigin) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_APP_URL"],
        message: "NEXT_PUBLIC_APP_URL must match the selected application surface",
      });
    }

    if (environment.APP_SURFACE === "customer" && environment.STAFF_PORTAL_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["STAFF_PORTAL_ENABLED"],
        message: "The customer deployment must not enable the staff portal",
      });
    }
    if (environment.APP_SURFACE === "staff" && environment.NEXT_PUBLIC_ACCOUNTS_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_ACCOUNTS_ENABLED"],
        message: "The staff deployment must not expose customer accounts",
      });
    }
    if (
      (environment.CONFIGURATOR_CHECKOUT_ENABLED || environment.SAMPLE_CHECKOUT_ENABLED) &&
      !environment.NEXT_PUBLIC_ACCOUNTS_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_ACCOUNTS_ENABLED"],
        message: "Accounts must be enabled before checkout",
      });
    }
    if (environment.CONFIGURATOR_CHECKOUT_ENABLED && !environment.CLOUD_DESIGNS_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["CLOUD_DESIGNS_ENABLED"],
        message: "Cloud designs must be enabled before configurator checkout",
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined> = process.env,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join(".") || "environment")
      .sort()
      .join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }
  return result.data;
}
