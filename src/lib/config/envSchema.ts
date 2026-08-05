import { z } from "zod";

import { GST_RATE_BASIS_POINTS } from "@/lib/tax";

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
    APP_SURFACE: z.enum(["customer", "staff"]).default("customer"),
    NEXT_PUBLIC_APP_SURFACE: z.enum(["customer", "staff"]).default("customer"),
    NEXT_PUBLIC_APP_URL: z
      .string()
      .trim()
      .url()
      .default("http://localhost:3000"),
    NEXT_PUBLIC_CUSTOMER_APP_URL: z.string().trim().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STAFF_APP_URL: z.string().trim().url().default("http://localhost:3001"),

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

    INVOICE_SELLER_LEGAL_NAME: z.string().trim().min(1).max(200).default("M/s Moist Corp"),
    INVOICE_SELLER_ADDRESS: z.string().trim().min(1).max(500).default("2nd Floor, Q-5 Site-5, Road Number 4, Prime Infra Engineers, UPSIDC Site 5, Greater Noida, Gautambuddha Nagar, Uttar Pradesh 201312"),
    INVOICE_SELLER_GSTIN: z.string().trim().min(1).max(40).default("09HPFPS8162L1ZY"),
    INVOICE_SELLER_STATE: z.string().trim().min(1).max(80).default("Uttar Pradesh"),
    INVOICE_DEFAULT_HSN_CODE: z.string().trim().min(1).max(40).default("CONFIGURE_HSN_CODE"),
    INVOICE_GST_RATE_BASIS_POINTS: positiveInteger(GST_RATE_BASIS_POINTS, 10_000),

    ORDER_CURRENCY: z.literal("INR").default("INR"),
    ESTIMATE_VALIDITY_DAYS: positiveInteger(7, 90),

    RESEND_API_KEY: optionalText(2048),
    RESEND_FROM_EMAIL: optionalText(320),
    CONTACT_TO_EMAIL: optionalEmail,
    OPERATIONS_ALERT_EMAIL: optionalEmail,
    FINANCE_ALERT_EMAIL: optionalEmail,

    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText(512),
    TURNSTILE_SECRET: optionalText(2048),

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
    ENABLE_REALTIME_ORDER_UPDATES: booleanValue,
    ENABLE_WHATSAPP_NOTIFICATIONS: booleanValue,
    ENABLE_SMS_NOTIFICATIONS: booleanValue,
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

    const currentOrigin = new URL(environment.NEXT_PUBLIC_APP_URL).origin;
    const expectedOrigin = new URL(
      environment.APP_SURFACE === "staff"
        ? environment.NEXT_PUBLIC_STAFF_APP_URL
        : environment.NEXT_PUBLIC_CUSTOMER_APP_URL,
    ).origin;
    if (currentOrigin !== expectedOrigin) {
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
        environment.CLOUD_DESIGNS_ENABLED ||
        environment.DURABLE_CUSTOM_CHECKOUT_ENABLED ||
        environment.DURABLE_SAMPLE_CHECKOUT_ENABLED) &&
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
        "TURNSTILE_SECRET",
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
      !environment.NEXT_PUBLIC_ACCOUNTS_ENABLED &&
      !environment.STAFF_PORTAL_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["R2_PRIVATE_UPLOADS_ENABLED"],
        message: "Private R2 uploads require a customer or staff authenticated surface",
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

    if (environment.NEXT_PUBLIC_PAYU_BASE_URL) {
      const checkout = new URL(environment.NEXT_PUBLIC_PAYU_BASE_URL);
      const expectedOrigin =
        environment.PAYU_ENVIRONMENT === "live"
          ? "https://secure.payu.in"
          : "https://test.payu.in";
      if (
        checkout.origin !== expectedOrigin ||
        checkout.pathname !== "/_payment" ||
        checkout.search ||
        checkout.hash ||
        checkout.username ||
        checkout.password
      ) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_PAYU_BASE_URL"],
          message: "PayU checkout URL must match the selected PayU environment",
        });
      }
    }

    if (environment.PAYU_VERIFY_BASE_URL) {
      const verify = new URL(environment.PAYU_VERIFY_BASE_URL);
      const expectedOrigin =
        environment.PAYU_ENVIRONMENT === "live"
          ? "https://info.payu.in"
          : "https://test.payu.in";
      if (
        verify.origin !== expectedOrigin ||
        !["/merchant/postservice", "/merchant/postservice.php"].includes(
          verify.pathname
        ) ||
        verify.searchParams.get("form") !== "2" ||
        [...verify.searchParams.keys()].some((key) => key !== "form") ||
        verify.hash ||
        verify.username ||
        verify.password
      ) {
        context.addIssue({
          code: "custom",
          path: ["PAYU_VERIFY_BASE_URL"],
          message:
            "PayU verification URL must be the official form=2 endpoint for the selected environment",
        });
      }
    }

    const durableCheckoutEnabled =
      environment.DURABLE_CUSTOM_CHECKOUT_ENABLED ||
      environment.DURABLE_SAMPLE_CHECKOUT_ENABLED;

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
      durableCheckoutEnabled,
      [
        "PAYU_MERCHANT_KEY",
        "PAYU_SALT",
        "PAYMENT_SIGNING_SECRET",
        "CRON_SECRET",
      ],
      "when durable PayU checkout is enabled"
    );

    if (
      environment.DURABLE_CUSTOM_CHECKOUT_ENABLED &&
      !environment.CLOUD_DESIGNS_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["DURABLE_CUSTOM_CHECKOUT_ENABLED"],
        message:
          "Cloud designs must be enabled before durable custom checkout",
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
