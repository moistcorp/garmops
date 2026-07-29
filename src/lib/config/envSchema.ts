import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (maximum = 1024) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(maximum).optional()
  );

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional()
);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email().max(320).optional()
);

const optionalLiteral = <T extends string>(value: T) =>
  z.preprocess(emptyToUndefined, z.literal(value).optional());

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const positiveInteger = (fallback: number, maximum: number) =>
  z.coerce.number().int().positive().max(maximum).default(fallback);

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "staging", "production", "test"])
      .default("development"),
    APP_TIMEZONE: z.literal("Asia/Kolkata").default("Asia/Kolkata"),
    NEXT_PUBLIC_APP_URL: z
      .string()
      .trim()
      .url()
      .default("http://localhost:3000"),

    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalText(512),
    SUPABASE_SECRET_KEY: optionalText(2048),
    SUPABASE_SERVICE_ROLE_KEY: optionalText(2048),
    AUTH_RATE_LIMIT_SALT: optionalText(2048),

    R2_ACCOUNT_ID: optionalText(128),
    R2_ACCESS_KEY_ID: optionalText(512),
    R2_SECRET_ACCESS_KEY: optionalText(2048),
    R2_S3_ENDPOINT: optionalUrl,
    R2_PUBLIC_BUCKET: optionalLiteral("garmops-public-downloads"),
    R2_PRIVATE_BUCKET: optionalLiteral("garmops-private-orders"),
    NEXT_PUBLIC_DOWNLOADS_BASE_URL: optionalUrl,

    PAYU_MERCHANT_KEY: optionalText(512),
    PAYU_SALT: optionalText(2048),
    PAYMENT_SIGNING_SECRET: optionalText(2048),
    PAYU_VERIFY_BASE_URL: optionalUrl,
    PAYU_ENVIRONMENT: z.enum(["test", "live"]).default("test"),
    NEXT_PUBLIC_PAYU_BASE_URL: optionalUrl,

    ZOHO_CLIENT_ID: optionalText(512),
    ZOHO_CLIENT_SECRET: optionalText(2048),
    ZOHO_REFRESH_TOKEN: optionalText(4096),
    ZOHO_ORGANIZATION_ID: optionalText(128),
    ZOHO_ACCOUNTS_BASE_URL: optionalUrl,
    ZOHO_INVOICE_API_BASE_URL: optionalUrl,
    ZOHO_RESERVATION_DOCUMENT_MODE: z
      .enum(["retainer_invoice", "standard_invoice"])
      .default("retainer_invoice"),
    ZOHO_RESERVATION_ITEM_ID: optionalText(128),
    ZOHO_RESERVATION_TAX_ID: optionalText(128),
    ZOHO_RESERVATION_TAX_MODE: z
      .enum(["inclusive", "exclusive"])
      .default("inclusive"),
    ZOHO_SEND_DOCUMENT_EMAIL: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),

    RESERVATION_AMOUNT_PAISE: positiveInteger(49_900, 100_000_000),
    RESERVATION_CURRENCY: z.literal("INR").default("INR"),
    RESERVATION_CREDITED_TO_FINAL_INVOICE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),

    RESEND_API_KEY: optionalText(2048),
    RESEND_FROM_EMAIL: optionalText(320),
    CONTACT_TO_EMAIL: optionalEmail,
    OPERATIONS_ALERT_EMAIL: optionalEmail,
    FINANCE_ALERT_EMAIL: optionalEmail,

    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText(512),
    TURNSTILE_SECRET_KEY: optionalText(2048),

    CRON_SECRET: optionalText(2048),
    JOB_WORKER_ID: z.string().trim().min(1).max(120).default("garmops-vercel"),
    JOB_PROCESSING_BACKEND: z.literal("postgres").default("postgres"),
    JOB_INLINE_MAX_COUNT: positiveInteger(1, 5),
    JOB_BATCH_SIZE: positiveInteger(20, 100),

    NEXT_PUBLIC_ACCOUNTS_ENABLED: booleanValue,
    STAFF_PORTAL_ENABLED: booleanValue,
    R2_PRIVATE_UPLOADS_ENABLED: booleanValue,
    CLOUD_DESIGNS_ENABLED: booleanValue,
    DURABLE_CUSTOM_CHECKOUT_ENABLED: booleanValue,
    DURABLE_SAMPLE_CHECKOUT_ENABLED: booleanValue,
    ZOHO_INVOICE_AUTOMATION_ENABLED: booleanValue,
    ENABLE_REALTIME_ORDER_UPDATES: booleanValue,
    ENABLE_WHATSAPP_NOTIFICATIONS: booleanValue,
    ENABLE_SMS_NOTIFICATIONS: booleanValue,
  })
  .passthrough()
  .superRefine((environment, context) => {
    const requireValues = (
      enabled: boolean,
      names: Array<keyof typeof environment>,
      reason: string
    ) => {
      if (!enabled) return;

      for (const name of names) {
        if (!environment[name]) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: `${String(name)} is required ${reason}`,
          });
        }
      }
    };

    const supabaseEnabled =
      environment.NEXT_PUBLIC_ACCOUNTS_ENABLED ||
      environment.STAFF_PORTAL_ENABLED ||
      environment.R2_PRIVATE_UPLOADS_ENABLED ||
      environment.CLOUD_DESIGNS_ENABLED ||
      environment.DURABLE_CUSTOM_CHECKOUT_ENABLED ||
      environment.DURABLE_SAMPLE_CHECKOUT_ENABLED;

    requireValues(
      supabaseEnabled,
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      "when a Supabase-backed feature is enabled"
    );

    if (
      (environment.NEXT_PUBLIC_ACCOUNTS_ENABLED ||
        environment.STAFF_PORTAL_ENABLED ||
        environment.R2_PRIVATE_UPLOADS_ENABLED ||
        environment.CLOUD_DESIGNS_ENABLED) &&
      !environment.SUPABASE_SECRET_KEY &&
      !environment.SUPABASE_SERVICE_ROLE_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SECRET_KEY"],
        message:
          "A Supabase secret or service-role key is required when authentication is enabled",
      });
    }

    requireValues(
      environment.NEXT_PUBLIC_ACCOUNTS_ENABLED ||
        environment.STAFF_PORTAL_ENABLED,
      [
        "AUTH_RATE_LIMIT_SALT",
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY",
      ],
      "when authentication is enabled"
    );

    requireValues(
      environment.STAFF_PORTAL_ENABLED,
      ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      "when staff invitations are enabled"
    );

    requireValues(
      environment.R2_PRIVATE_UPLOADS_ENABLED,
      [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_S3_ENDPOINT",
        "R2_PRIVATE_BUCKET",
      ],
      "when private R2 uploads are enabled"
    );

    if (
      environment.R2_PRIVATE_UPLOADS_ENABLED &&
      !environment.NEXT_PUBLIC_ACCOUNTS_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_ACCOUNTS_ENABLED"],
        message: "Accounts must be enabled before private R2 uploads",
      });
    }

    if (
      environment.CLOUD_DESIGNS_ENABLED &&
      (!environment.NEXT_PUBLIC_ACCOUNTS_ENABLED ||
        !environment.R2_PRIVATE_UPLOADS_ENABLED)
    ) {
      context.addIssue({
        code: "custom",
        path: ["CLOUD_DESIGNS_ENABLED"],
        message:
          "Cloud designs require accounts and private R2 uploads to be enabled",
      });
    }

    if (
      environment.R2_ACCOUNT_ID &&
      environment.R2_S3_ENDPOINT
    ) {
      const endpoint = new URL(environment.R2_S3_ENDPOINT);
      if (
        endpoint.origin !==
          `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` ||
        endpoint.pathname !== "/" ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.username ||
        endpoint.password
      ) {
        context.addIssue({
          code: "custom",
          path: ["R2_S3_ENDPOINT"],
          message: "R2 endpoint must match the configured account",
        });
      }
    }

    if (environment.NEXT_PUBLIC_DOWNLOADS_BASE_URL) {
      const downloads = new URL(environment.NEXT_PUBLIC_DOWNLOADS_BASE_URL);
      if (
        downloads.protocol !== "https:" ||
        downloads.pathname !== "/" ||
        downloads.search ||
        downloads.hash ||
        downloads.username ||
        downloads.password
      ) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_DOWNLOADS_BASE_URL"],
          message: "Public downloads URL must be an HTTPS origin",
        });
      }
    }

    const durableCheckoutEnabled =
      environment.DURABLE_CUSTOM_CHECKOUT_ENABLED ||
      environment.DURABLE_SAMPLE_CHECKOUT_ENABLED;

    requireValues(
      durableCheckoutEnabled,
      [
        "PAYU_MERCHANT_KEY",
        "PAYU_SALT",
        "PAYMENT_SIGNING_SECRET",
        "PAYU_VERIFY_BASE_URL",
      ],
      "when durable checkout is enabled"
    );

    if (
      durableCheckoutEnabled &&
      !environment.NEXT_PUBLIC_ACCOUNTS_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_ACCOUNTS_ENABLED"],
        message: "Accounts must be enabled before durable checkout",
      });
    }

    requireValues(
      environment.ZOHO_INVOICE_AUTOMATION_ENABLED,
      [
        "ZOHO_CLIENT_ID",
        "ZOHO_CLIENT_SECRET",
        "ZOHO_REFRESH_TOKEN",
        "ZOHO_ORGANIZATION_ID",
        "ZOHO_ACCOUNTS_BASE_URL",
        "ZOHO_INVOICE_API_BASE_URL",
        "ZOHO_RESERVATION_ITEM_ID",
        "ZOHO_RESERVATION_TAX_ID",
      ],
      "when Zoho invoice automation is enabled"
    );

    if (
      environment.ZOHO_INVOICE_AUTOMATION_ENABLED &&
      (!environment.DURABLE_CUSTOM_CHECKOUT_ENABLED ||
        !environment.R2_PRIVATE_UPLOADS_ENABLED)
    ) {
      context.addIssue({
        code: "custom",
        path: ["ZOHO_INVOICE_AUTOMATION_ENABLED"],
        message:
          "Zoho automation requires durable custom checkout and private R2 uploads",
      });
    }

    const deferredFlags = [
      "ENABLE_REALTIME_ORDER_UPDATES",
      "ENABLE_WHATSAPP_NOTIFICATIONS",
      "ENABLE_SMS_NOTIFICATIONS",
    ] as const;

    for (const name of deferredFlags) {
      if (environment[name]) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} is deferred for the initial release`,
        });
      }
    }
  });

export type ServerEnvironment = z.output<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment);
  if (result.success) return Object.freeze(result.data);

  const invalidNames = [
    ...new Set(
      result.error.issues.map((issue) => String(issue.path[0] ?? "environment"))
    ),
  ].sort();
  throw new Error(
    `Invalid server environment configuration: ${invalidNames.join(", ")}`
  );
}
