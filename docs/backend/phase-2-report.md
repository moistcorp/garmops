# Phase 2 implementation report

Date: 2026-07-29
Branch: `main`
Operating mode: development and internal testing
Frontend status: unchanged

## Outcome

The durable order-platform schema now exists locally and in the hosted Supabase Development project. Phase 2 adds database-owned order numbers and dates, immutable submitted snapshots, server-only idempotent order/payment transactions, PayU attempt/event records, Zoho invoice state, R2 file metadata, append-only history/audit evidence, and a bounded PostgreSQL integration job queue.

No page, component, style, public route, proxy rule, configurator behaviour, checkout behaviour, payment route, provider adapter, or production setting changed.

## Migration

`supabase/migrations/20260729064326_durable_order_platform.sql` adds nine enums:

- `order_type`;
- `order_status`;
- `public_order_status`;
- `payment_status`;
- `invoice_kind`;
- `invoice_sync_status`;
- `file_visibility`;
- `file_kind`;
- `file_scan_status`.

It adds 18 tables:

- designs: `design_projects`, `design_project_versions`;
- numbering and idempotency: `number_counters`, `idempotency_keys`;
- orders: `orders`, `order_items`, `order_item_sizes`, `order_status_history`, `order_comments`;
- payments: `payment_attempts`, `payment_events`;
- files and approvals: `order_files`, `approvals`;
- accounting and operations: `invoices`, `integration_jobs`, `shipments`, `notifications`, `audit_logs`.

The migration also adds:

- required portal, staff-queue, payment, file, invoice, notification, audit, and due-job indexes;
- one-paid-attempt-per-order-purpose and provider-event dedupe indexes;
- immutable design-version, submitted-item, size, status-history, and audit triggers;
- immutable order commercial/snapshot fields while allowing controlled operational state changes;
- immutable payment-event identity/payload fields with separately advanceable processing metadata;
- `updated_at` triggers on mutable Phase 2 records;
- fail-closed RLS on every new table, with policies intentionally deferred to Phase 3.

## Transaction functions

The migration adds six narrowly scoped functions:

- `allocate_order_number` atomically allocates `GAR-YYYY-NNNNNN` and `SAM-YYYY-NNNNNN` values using the `Asia/Kolkata` business year;
- `submit_order` creates the order, immutable item/size snapshots, first history event, first payment attempt, and idempotent response in one transaction;
- `finalize_verified_payment` locks the attempt/order, validates amount, currency, purpose, and order state, records paid state once, writes history/audit evidence, and deduplicates invoice/notification jobs;
- `claim_integration_jobs` claims bounded due batches with `FOR UPDATE SKIP LOCKED` and stale-lock recovery;
- `complete_integration_job` completes only a job locked by the same worker;
- `fail_integration_job` applies bounded retry/dead handling and the documented backoff schedule.

Execution is revoked from `PUBLIC`, `anon`, and `authenticated`. The service transaction/job functions are granted only to `service_role`.

## Local-only fixtures

`supabase/seed.sql` now creates:

- one submitted Alpha design and immutable version;
- one paid Alpha custom order with exact address/customer/company/terms/product snapshots;
- one pending Beta sample order;
- generated order and PayU merchant transaction numbers;
- one queued reservation invoice;
- deduplicated invoice and payment-confirmation jobs;
- payment status history and audit evidence.

The seed calls `submit_order` and `finalize_verified_payment` instead of bypassing their invariants with direct order/payment inserts. These fixtures and credentials remain local only.

## Automated verification

`supabase/tests/02_durable_order_platform.sql` adds 100 Phase 2 assertions. Together with Phase 1, the local database suite has 119 passing assertions.

Coverage includes:

- enum/table/RLS surface and zero Phase 2 policies;
- browser-role execution revocation;
- deterministic seed state;
- idempotent order submission and conflicting-key rejection;
- cross-tenant submission rejection;
- order-number uniqueness and formatting;
- duplicate payment-finalisation safety;
- exact integer-paise sample and reservation payments;
- one reservation invoice/job per verified payment;
- append-only order, payment-event, status, design, and audit evidence;
- bounded job claim, lock ownership, completion, retry backoff, and dedupe;
- line-total, size-total, and sample-payment validation;
- required payment/job indexes.

A separate concurrency check opened 24 simultaneous PostgreSQL sessions. It produced 24 unique, valid `GAR-YYYY-NNNNNN` values.

## Commands and results

| Command/check | Result |
| --- | --- |
| Pre-change `npm run lint` | Passed |
| Pre-change `npm run typecheck` | Passed |
| Pre-change `npm test` | Passed; 2 files, 7 tests |
| Pre-change `npm run build` | Passed; 52 pages generated |
| Pre-change `npm run seo:check` | Passed |
| Pre-change `npm run agent:check` | Passed |
| `npx supabase db reset` | Passed from an empty local database |
| `npx supabase test db` | Passed; 2 files, 119 assertions |
| 24-session number-allocation check | Passed; 24 unique and valid values |
| `npx supabase db lint --local --level warning` | Passed; no schema issues |
| `npm run db:types` | Passed; generated Phase 2 tables, enums, relationships, and functions |
| Final `npm run lint` | Passed |
| Final `npm run typecheck` | Passed |
| Final `npm test` | Passed; 2 files, 7 tests |
| Final `npm run build` | Passed; 52 pages generated |
| Final `npm run seo:check` | Passed |
| Final `npm run agent:check` | Passed |
| Hosted `supabase db push --dry-run` | Exactly one Phase 2 migration; no seed or roles |
| Hosted `supabase db push` | Passed |
| Hosted catalog verification | 18 tables, nine enums, six functions, all RLS enabled, zero policies |
| Hosted role verification | No Phase 2 service function executable by `authenticated` |
| Hosted data verification | Zero orders, invoices, and jobs; local seed not copied |

The first sandboxed baseline build failed because Turbopack could not bind its internal worker port. The approved unrestricted rerun passed; this was an execution-sandbox restriction, not an application failure.

## Hosted Development project

- Vercel Marketplace resource: `garmops-development`;
- Supabase project reference: `vookvteetdolowqsionv`;
- plan: Supabase Free;
- region: Mumbai (`bom1`);
- PostgreSQL: 17.6;
- Vercel scope: Development only;
- remote migrations: Phase 1 `20260729053747` and Phase 2 `20260729064326`.

Existing `.env.local` values were neither printed nor changed. No environment variable names, recurring services, paid plans, Redis instance, managed queue, Realtime channel, or production resource were added.

## Known phase boundary

- Phase 2 tables deliberately have no browser/customer/staff policies. RLS therefore fails closed until Phase 3.
- The trusted transaction functions exist, but no application route invokes them yet.
- `finalize_verified_payment` accepts only trusted server input; PayU hash/API verification and event processing belong to Phase 8.
- Job persistence, claiming, completion, and retry primitives exist; Vercel Cron routes and provider handlers belong to later phases.
- Invoice records and jobs exist, but no Zoho network call or tax decision is implemented.
- File metadata exists, but R2 buckets, upload sessions, signed URLs, validation, and retention actions belong to Phase 5.
- No production database or paid service has been created.

## Manual setup still required

- Phase 3 must add and test customer/staff RLS helpers and policies before any browser-backed portal is enabled.
- Persistent `supabase link` remains optional and requires an explicitly configured Supabase personal access token; migrations currently use temporary Development-only database credentials.
- PayU, Zoho, R2, Resend, and Cron provider configuration remains disabled until its scheduled phase.

The next implementation phase is Phase 3: RLS helpers, customer/staff policies, service-role boundaries, and cross-tenant/role permission tests.
