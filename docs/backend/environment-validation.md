# Environment validation design

Status: implemented through Phase 7
Last reviewed: 2026-07-29

## Goals

Environment configuration will be parsed once in server-only code with a strict Zod schema. Callers receive a typed, immutable object rather than reading arbitrary `process.env` keys. Error messages list missing variable names but never values.

Validation must preserve secret-free CI and local builds. Provider credentials are required conditionally when their server rollout flag is enabled, not merely because the application imports an adapter.

## Schema groups

- Core: `APP_ENV`, `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE`.
- Supabase public: project URL and publishable key.
- Supabase privileged: service-role key, available only to narrowly scoped admin/job modules.
- R2: account, S3 endpoint, access credentials, bucket names, and public download origin.
- PayU: environment, merchant key, salt, signing secret, hosted-checkout URL, and verification base URL.
- Invoice: seller legal name/address/GSTIN, HSN codes, GST rate, and email behaviour.
- Reservation: positive integer paise, `INR`, and credit-to-final-invoice decision.
- Resend: API key, verified sender, and operational recipients.
- Turnstile: public site key and server secret.
- Jobs: strong cron secret, worker ID, `postgres` backend, and bounded positive batch values.
- Rollout: strict `true`/`false` values for every feature flag.

URLs use URL validation, email addresses use email validation, integer settings are coerced and bounded, enums reject unknown values, and production secrets reject documented placeholders. `APP_TIMEZONE` initially accepts only `Asia/Kolkata`, and `APP_ENV` accepts `development`, `staging`, `production`, or `test`.

## Conditional requirements

- Accounts require Supabase URL and publishable key.
- Staff portal additionally requires the service-role boundary and an active staff record.
- Private R2 uploads require all private-bucket credentials and exact application origins.
- Cloud designs require accounts and private R2 uploads before their server
  routes can be enabled.
- Durable custom ordering requires accounts, a privileged Supabase server
  boundary, and cloud designs. It does not require PayU credentials merely to
  create the pre-payment order and attempt; PayU signing and verification
  become mandatory when Phase 8 provider processing is enabled.
- In-house invoice generation requires durable checkout, R2 private storage, Resend, seller tax configuration, and the PostgreSQL job backend.
- Turnstile-protected routes require both site and secret keys.
- SMS, WhatsApp, Realtime, and any unsupported job backend are rejected for the initial release even if accidentally enabled.

The current legacy PayU and Resend routes retain their existing configuration behavior until their migration phases. Phase 1 validation must therefore avoid changing public checkout behavior.

## Public/server separation

Only variables intentionally named `NEXT_PUBLIC_*` may be exposed to client bundles. Next.js inlines these at build time, so changing them requires a new deployment. Server enforcement reads server flags at request time and never relies solely on a public flag.

`SUPABASE_SERVICE_ROLE_KEY`, `PAYU_SALT`, `PAYMENT_SIGNING_SECRET`, R2 credentials, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, and `CRON_SECRET` are server-only. Logs and validation errors must never include their values.

## Validation entry points

Phase 1 provides:

- a pure schema in `src/lib/config/envSchema.ts` that is unit tested with explicit environment objects;
- a cached, `server-only` accessor in `src/lib/config/env.ts`;
- secret-free validation tests with every rollout flag off;
- conditional validation for Supabase, PayU, R2, and invoice rollout dependencies;
- safe errors that report invalid variable names without values.

The build must not contact providers or require production credentials. Route handlers and job processors validate the provider group before performing a side effect and return a safe configuration error when a disabled or incomplete integration is invoked.

Reference: [Next.js environment variable guidance](https://nextjs.org/docs/app/guides/environment-variables).
