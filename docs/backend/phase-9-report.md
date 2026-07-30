# Phase 9 implementation report

**Phase:** Zoho automatic reservation invoicing  
**Implementation date:** 30 July 2026  
**Base:** Phase 8 durable PayU processing

## Outcome

Phase 9 adds a durable, provider-adapted Zoho Invoice workflow after a verified PayU reservation payment. Zoho network work is never performed inside the payment database transaction. A Zoho, R2 or email failure cannot reverse a verified payment.

The customer portal now displays accounting-document generation state and private PDF downloads. MFA-authorised finance staff receive an invoice queue with safe error information and an audited retry control.

## Main implementation

- Zoho OAuth refresh-token exchange and process-local access-token cache.
- Data-centre-specific Zoho API client with strict server-only configuration.
- Provider-neutral accounting types and a Zoho adapter.
- Contact find/adopt/create using the Garmops organisation marker and billing snapshot.
- Retainer-invoice and standard-invoice modes.
- Deterministic external references for timeout-safe document adoption.
- Exact-reference customer-payment adoption and creation.
- Amount, customer, date and payment reconciliation.
- Integer-paise provider conversion and integer basis-point calculation for exclusive-tax mode.
- Official PDF download, validation and deterministic private R2 archival.
- Durable PostgreSQL job processor and secured Vercel Cron route.
- Safe deferral while the feature is disabled without consuming attempts.
- Retry classification, dead-job finance alerts and finance exception UI.
- MFA/permission-protected and audited invoice retry RPC.
- Customer invoice list, order invoice component and payment-result invoice download.
- Provider, unit and pgTAP coverage for core Phase 9 invariants.

## Migration added

```text
supabase/migrations/20260730220000_zoho_phase9.sql
```

The migration adds accounting evidence fields and constraints, provider uniqueness, the finance queue index, safe job deferral and staff retry functions.

## Environment variables added or activated

```text
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
ZOHO_REFRESH_TOKEN
ZOHO_ORGANIZATION_ID
ZOHO_ACCOUNTS_BASE_URL
ZOHO_INVOICE_API_BASE_URL
ZOHO_RESERVATION_DOCUMENT_MODE
ZOHO_RESERVATION_ITEM_ID
ZOHO_RESERVATION_TAX_ID
ZOHO_RESERVATION_TAX_MODE
ZOHO_RESERVATION_TAX_BASIS_POINTS
ZOHO_SEND_DOCUMENT_EMAIL
ZOHO_INVOICE_AUTOMATION_ENABLED
FINANCE_ALERT_EMAIL
CRON_SECRET
JOB_WORKER_ID
JOB_BATCH_SIZE
```

`ZOHO_RESERVATION_TAX_BASIS_POINTS` is required only for exclusive-tax mode. The flag defaults to disabled.

## Scheduled route

```text
GET /api/internal/jobs/process
Authorization: Bearer <CRON_SECRET>
```

`vercel.json` runs this route every ten minutes and retains the Phase 8 PayU reconciliation schedule.

## Automated coverage added

- Zoho amount/date and exclusive-tax rate helpers.
- Zoho document parser.
- Customer-payment lookup/adoption/creation behaviour.
- Official Zoho endpoint validation.
- Database accounting evidence constraints.
- Finance retry permission and AAL2 enforcement.
- Retry audit record.
- Feature-disabled job deferral without attempt consumption.

## Commands and results in this environment

- Source TypeScript/TSX syntax parse: passed after implementation.
- JSON configuration parse: passed.
- SQL structural review: passed.
- Secret-pattern review: passed.
- Full `npm ci`: blocked by the execution environment. Its internal package mirror did not provide `zustand@5.0.14`, and public npm DNS access was unavailable.
- Full lint, typecheck, Vitest and Next.js build: not independently executable without a complete dependency install.
- Supabase reset/pgTAP: not executable here because local Supabase/Docker and production credentials are unavailable.
- Zoho sandbox UAT: not executable without Garmops Zoho organisation, OAuth, item and tax configuration.

The complete clean suite must be run locally before enabling the flag.

## Known limitations

- The job processor is cron-driven; invoice availability can lag until the next successful run.
- Zoho document/item/tax/template IDs are intentionally not fabricated or auto-created.
- Retainer search adoption scans the most recent bounded set because the published list API does not expose an exact reference filter consistently; normal immediate retries remain within that set.
- Provider payload snapshots are deliberately minimised and do not replace Zoho as accounting authority.
- Refund, void, credit-note and final-invoice application workflows remain outside Phase 9.
- Customer notification and Zoho-document email are separate effects; failures do not invalidate the completed accounting document.

## Manual setup required

Follow `docs/backend/zoho-phase9-setup.md`. Finance must approve the legal/tax mode and provide the real Zoho IDs. Apply the migration, regenerate types, run all checks, configure staging, execute the timeout/duplicate matrix and complete finance UAT before production enablement.

## Completion assessment

The repository contains the complete Phase 9 application and database implementation. Production enablement remains intentionally gated by environment configuration, clean local tests, Zoho sandbox validation and finance sign-off.
