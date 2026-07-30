# Phase 8 implementation report

## Summary

Phase 8 replaces the durable custom-order payment hand-off with a database-authoritative PayU Hosted Checkout flow. The existing sample-cart payment path is deliberately retained until Phase 12.

## Implemented

- Database-authoritative PayU initiation at `POST /api/payments/payu/initiate`.
- Hosted Checkout fields, customer phone, product information, amount, merchant transaction ID, and request hash are loaded or derived from durable database records only.
- Reusable PayU provider modules for request hashing, reverse response-hash verification, Hosted Checkout, Verify Payment API calls, and response parsing.
- Shared callback/webhook domain processor with deterministic event fingerprints.
- Exact merchant key, transaction ID, integer-paise amount, product information, customer identity, and UDF context comparison.
- Mandatory PayU `verify_payment` API confirmation before any paid transition.
- Existing `finalize_verified_payment` transaction is used for atomic and idempotent success finalisation.
- New `record_payu_payment_state` database function for locked pending/failure transitions that cannot:
  - overwrite paid, refunded, disputed, or cancelled attempts;
  - let an older failed attempt overwrite a newer active retry;
  - duplicate transition audit records.
- Database-backed success, failure, and pending pages protected by a short-lived signed HttpOnly result cookie.
- Scheduled stale-attempt reconciliation at `/api/internal/jobs/reconcile-payu`; transactions still unknown after a two-hour grace period are classified as abandoned while remaining eligible for a later verified-success correction.
- A second verified success for an already-paid order purpose is retained as a `disputed` finance exception without incrementing the order paid amount or creating another invoice job.
- Customer payment controls now create or reuse the correct durable attempt, obtain server-generated PayU fields, and post directly to PayU Hosted Checkout.
- Safe public retry errors with request IDs; detailed provider/database errors remain server-side.
- Actual-byte JSON request limits for durable order/payment mutation routes, including chunked requests without a trustworthy `Content-Length` header.
- Vercel Cron configuration for 30-minute reconciliation.

## Migration

- `supabase/migrations/20260730200000_payu_phase8.sql`

Apply the migration through the repository migration workflow. Do not create the function manually in the Supabase dashboard.

## Automated tests added

- `src/lib/providers/payu/hashing.test.ts`
  - paise conversion;
  - request/command hashes;
  - standard response hash;
  - additional-charge and split-settlement variants;
  - tampered amount rejection.
- `src/lib/providers/payu/verify.test.ts`
  - captured success;
  - incomplete success remains pending;
  - not-found handling;
  - mismatched transaction rejection.
- `supabase/tests/08_payu_phase8.sql`
  - function existence and privileges;
  - pending/failure transitions;
  - duplicate transition audit protection;
  - terminal-state downgrade protection;
  - stale older-attempt failure protection.

## Environment variables

Required whenever durable checkout is enabled:

- `PAYU_MERCHANT_KEY`
- `PAYU_SALT`
- `PAYMENT_SIGNING_SECRET`
- `PAYU_ENVIRONMENT=test|live`
- `NEXT_PUBLIC_PAYU_BASE_URL`
- `PAYU_VERIFY_BASE_URL` (optional override; official test/live defaults are built in)
- `CRON_SECRET`

The environment validator restricts checkout and verification URLs to the official PayU host/path for the selected environment.

## Manual setup

1. Apply the Phase 8 migration locally and in staging.
2. Regenerate database types with `npm run db:types` after the local schema is reset. A matching generated-type entry is included in this patch so the source remains internally consistent.
3. Configure Hosted Checkout success and failure URLs through the server-generated `surl`/`furl` values:
   - `https://<app-origin>/api/payments/payu/callback`
4. Configure the PayU payment webhook:
   - `https://<app-origin>/api/payments/payu/webhook`
5. Add secrets separately in Vercel Development, Preview, and Production. Never put live PayU or Supabase service-role secrets in Preview.
6. Configure Vercel `CRON_SECRET`; `vercel.json` runs reconciliation every 30 minutes.
7. Add WAF/rate limits for payment initiation, retry, callback, and webhook routes without blocking PayU.
8. Keep `DURABLE_CUSTOM_CHECKOUT_ENABLED=false` in Production until sandbox and staging UAT pass.

## Required PayU sandbox scenarios

- correct callback and successful Verify Payment response;
- tampered amount;
- invalid reverse hash;
- unknown transaction ID;
- callback then webhook;
- webhook then callback;
- duplicate webhook;
- pending then reconciliation success;
- failed attempt followed by a new retry;
- callback claims success but Verify Payment says pending/failure;
- delayed failure from an older attempt after a newer retry;
- a second success attempt after the order is already paid.

## Verification performed in this workspace

Passed:

- TypeScript/TSX parser check across 255 source files: no syntax errors.
- Executable pure PayU hashing and Verify-response parser harness.
- `package.json` and `vercel.json` JSON validation.
- Agent-readiness check.
- Secret-pattern scan of modified source/configuration files.
- Changed-file and local-import review.

Could not be executed in this workspace:

- `npm ci`, lint, full TypeScript typecheck, Vitest, Next.js build, and SEO post-build check. The execution environment could not resolve/download npm packages (`EAI_AGAIN` against the public registry; the internal mirror also lacked required packages).
- Supabase migration reset/pgTAP tests because a local Supabase runtime is not available here.
- Live PayU sandbox calls because merchant credentials were not provided and should not be embedded in the repository.

Run the complete commands locally or in CI before enabling the feature:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run db:reset
npm run db:test
npm run build
npm run seo:check
npm run agent:check
```

## Deferred

- Zoho network processing remains Phase 9. The successful payment transaction queues the existing invoice record/job but performs no Zoho network call.
- Durable sample checkout remains Phase 12 and continues using the legacy sample flow.
- Refund initiation and dispute operations remain finance-controlled later work; provider events can be stored without assuming paid transactions remain permanently paid.
