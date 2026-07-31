# Phase 12 implementation report

Date: 31 July 2026  
Scope: durable catalogue sample checkout using the existing account, PostgreSQL order, PayU, staff, document, shipment, and notification architecture.

## Completion summary

Phase 12 is implemented on top of the corrected Phase 11 project.

The implementation provides:

- a server-authoritative sample catalogue pricing service;
- authenticated owner/buyer sample checkout;
- a durable `sample_purchase` order and `sample_full` payment attempt before PayU opens;
- immutable product, price, size, customer, company, billing, shipping, and terms snapshots;
- server-generated `SAM-YYYY-NNNNNN` order numbers and database order dates;
- database-backed PayU initiation, callback, webhook, verification, retry, reconciliation, and result pages;
- account order history, payment retry, documents, notifications, shipment tracking, and QC evidence for sample orders;
- staff queue, dashboard, fulfilment, QC, packing, dispatch, shipment, delivery, notes, files, and audit support;
- a future-safe `sample_tax_invoice` accounting placeholder without prematurely calling Zoho;
- guards that stop the legacy localStorage/email sample flow whenever durable sample checkout is enabled.

The browser cart remains a temporary pre-submission convenience only. It is not the final order record, does not provide authoritative pricing, and is cleared only after the database confirms that the durable order exists.

## Database migration

```text
supabase/migrations/20260731100000_phase12_durable_sample_checkout.sql
```

The migration adds or replaces:

- generic durable payment retry support for both `reservation` and `sample_full` attempts;
- sample PayU field normalization using the durable `SAM-...` order number;
- sample-specific staff status transitions that bypass artwork approval but preserve verified-payment, QC, packing, dispatch, delivery, audit, and notification controls;
- payment-integrity guards that block sample fulfilment before verified full payment;
- one idempotent `sample_tax_invoice` placeholder after verified sample payment;
- Phase 10 dashboard metrics for fully paid sample orders.

## Server-authoritative catalogue pricing

Canonical sample pricing is implemented in:

```text
src/lib/orders/samplePricing.ts
```

Rules include:

- product and size loaded from the server catalogue;
- browser prices and totals ignored;
- quantities validated and duplicate product/size lines merged;
- all persisted money represented as integer paise;
- ₹99 shipping below a ₹2,000 sample subtotal;
- free shipping at or above ₹2,000;
- pricing version `catalogue-samples-2026-01` stored with the order;
- immutable line-item product and price snapshots.

The client may display an estimate for convenience, but PostgreSQL receives only totals produced by the server pricing service.

## Durable checkout journey

```text
customer sample cart
→ verified customer account and active organisation membership
→ owner/buyer submits product IDs, sizes, quantities, contact, and delivery address
→ server reloads canonical products and prices
→ server snapshots organisation, billing, shipping, customer, terms, and lines
→ PostgreSQL creates SAM order and full-payment attempt atomically
→ cart is no longer authoritative
→ PayU initiation loads all payment fields from PostgreSQL
→ callback/webhook hash is checked and transaction is verified through PayU
→ verified full payment marks order paid and enters the staff sample queue
→ customer sees the durable order from any device
→ staff fulfils, performs QC, packs, ships, and marks delivered
```

A session-persisted idempotency key is tied to the cart signature. Duplicate clicks and ambiguous network retries reuse the same key while the cart is unchanged. A changed cart receives a new key.

## Identity and address handling

- Email verification and an active organisation membership are required.
- Only organisation owners and buyers can submit sample orders.
- The authenticated account email remains part of the immutable customer snapshot.
- Delivery data is validated as an Indian address.
- The organisation's default shipping address pre-fills checkout when available.
- The organisation's default billing address is used when available; otherwise the delivery address is snapshotted as billing with an explicit source marker.
- Current organisation GSTIN and billing email are snapshotted for future accounting use.

## PayU integration

Sample checkout uses the Phase 8 payment architecture rather than the legacy sample callback:

- initiation from a database payment-attempt ID;
- `sample_full` purpose;
- exact database amount;
- `Garmops sample order SAM-...` product information;
- reverse-hash validation;
- Verify Payment API confirmation;
- idempotent callback and webhook processing;
- reconciliation for stale attempts;
- retry under the same durable order;
- database-backed success and failure pages.

A browser redirect alone never marks a sample order paid.

## Staff workflow

A verified paid sample order enters `submitted_for_review` and is visible in:

```text
/staff
/staff/orders?orderType=sample_purchase
/staff/orders/:orderNumber
```

The allowed sample path supports operational exceptions while excluding custom artwork stages:

```text
submitted_for_review
→ packing
→ ready_to_dispatch
→ dispatched
→ delivered
```

QC and shipment records remain available. Staff cannot move an unpaid sample order into fulfilment and cannot route a sample order through the custom artwork approval workflow.

## Accounting preparation

After verified full sample payment, PostgreSQL creates at most one invoice record with:

```text
kind = sample_tax_invoice
sync_status = not_required
```

This record:

- stores the exact verified amount and a zero balance;
- appears in customer and staff accounting-document views;
- does not queue the reservation-invoice job;
- does not call Zoho;
- cannot be retried from the finance UI while marked `not_required`.

This preserves a clean future adapter path without guessing GST, HSN/SAC, Zoho item IDs, tax IDs, place of supply, or document mode. Finance configuration is required before automating sample tax invoices.

## Legacy-flow containment

When `DURABLE_SAMPLE_CHECKOUT_ENABLED=true`:

- `/checkout` uses the durable sample component;
- the old hash endpoint rejects sample-cart payloads;
- the old callback rejects sample-cart tokens;
- the old confirmation-email endpoint rejects sample confirmation payloads;
- legacy success/failure pages do not treat a sample cookie as verified payment evidence.

The legacy code remains temporarily available only for feature-flag rollback and should be removed during Phase 13 after staging and production rollout are proven.

## UI routes

Customer:

```text
/checkout
/account/orders
/account/orders/:orderNumber
/account/orders/:orderNumber/confirmation
/account/documents
/account/notifications
/payment/success
/payment/failure
```

Staff:

```text
/staff
/staff/orders
/staff/orders/:orderNumber
/staff/invoices
/staff/files
/staff/shipments
```

## Tests added or updated

```text
supabase/tests/12_durable_sample_checkout.sql
src/lib/orders/samplePricing.test.ts
src/lib/orders/sampleSchema.test.ts
src/lib/staff/statuses.test.ts
```

The Phase 12 pgTAP suite contains 43 assertions covering:

- durable order creation before PayU;
- server order number and full payment amount;
- immutable line and size records;
- idempotent submit and retry;
- failed-payment retention;
- verified finalisation and duplicate events;
- sample accounting-placeholder deduplication;
- confirmation-job deduplication;
- paid-sample dashboard visibility;
- verified-payment fulfilment guard;
- sample-specific status transitions;
- exclusion of artwork approval requirements;
- status history.

Unit tests cover canonical pricing, shipping threshold, duplicate merging, size and quantity validation, request validation, and sample status transitions.

## Environment variables

No new secret is introduced in Phase 12. Existing variables are required:

```text
NEXT_PUBLIC_ACCOUNTS_ENABLED=true
DURABLE_SAMPLE_CHECKOUT_ENABLED=true
PAYU_ENVIRONMENT=test
PAYU_MERCHANT_KEY=...
PAYU_SALT=...
PAYMENT_SIGNING_SECRET=...
CRON_SECRET=...
```

Use `DURABLE_SAMPLE_CHECKOUT_ENABLED=false` until local tests and PayU staging UAT pass.

## Validation completed in the implementation environment

- 314 TypeScript/TSX source files parsed without syntax diagnostics; declaration-only files were excluded from transpilation.
- Static local import resolution passed across 315 source files.
- Phase 12 migration structure and SQL dollar quotes passed static validation.
- Phase 12 pgTAP plan and assertion count match: 43/43.
- JSON configuration parsing passed.
- Sample terms evidence contains a 64-character SHA-256 digest.
- Corrected feature-based Phase 11/12 folder structure was preserved.
- No real provider credentials were added.
- The delivery archives exclude dependency folders, build output, Git metadata, and local environment files.

## Validation limitations

The full dependency-backed suite must be rerun locally. `npm ci` was blocked in the implementation environment because its internal package mirror returned `404 Not Found` for the repository-locked `zustand@5.0.14` tarball. Docker/Supabase services and PayU sandbox credentials were also unavailable. This limitation is environmental and is not a successful test result.

Required local commands:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run lint
npm run typecheck
npm run test
npm run build
npm run seo:check
npm run agent:check
```

## Known scope boundaries

Not part of Phase 12:

- automatic Zoho tax-invoice creation for samples without finance-provided tax configuration;
- carrier API ingestion;
- paid malware-scanning service;
- final CSP/WAF/load/backup/monitoring work;
- production rollout and legacy route deletion.

Those production-hardening and cleanup tasks remain Phase 13.
