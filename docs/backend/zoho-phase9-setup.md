# Phase 9 Zoho Invoice setup and rollout

This runbook completes the manual provider configuration required by the Phase 9 code. Keep `ZOHO_INVOICE_AUTOMATION_ENABLED=false` until every staging check in this file passes.

## 1. Accounting decision required from finance

Finance must approve and record all of the following before any live job is processed:

- whether the ₹499 payment is a `retainer_invoice` credited against the final invoice or a `standard_invoice`;
- the Zoho organisation and data centre;
- the reservation item ID;
- the applicable Zoho tax ID;
- inclusive or exclusive tax treatment;
- for exclusive tax, the finance-approved combined rate in basis points, for example `1800` for 18%;
- the legal wording and Zoho template;
- whether Zoho itself should email the document;
- the correct GST treatment, place of supply, HSN/SAC and accounting classification.

The application does not guess legal or tax values. The Zoho document must reconcile to exactly `49900` paise before it can be marked completed.

## 2. OAuth scopes

Generate the production refresh token in the same Zoho data centre as the organisation. Use the least-privilege scopes required by the enabled workflow:

```text
ZohoInvoice.contacts.READ
ZohoInvoice.contacts.CREATE
ZohoInvoice.invoices.READ
ZohoInvoice.invoices.CREATE
ZohoInvoice.customerpayments.READ
ZohoInvoice.customerpayments.CREATE
```

The code does not create or modify items or taxes. Item and tax IDs must be configured by finance in Zoho. Add `ZohoInvoice.settings.READ` only when an operational verification script is added that reads those records.

Never place the client secret or refresh token in a public environment variable, preview deployment, browser bundle, log message, database row or screenshot.

## 3. Environment variables

For India, the expected origins are:

```env
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.in
ZOHO_INVOICE_API_BASE_URL=https://www.zohoapis.in/invoice/v3
```

Configure the complete server-only set:

```env
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORGANIZATION_ID=
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.in
ZOHO_INVOICE_API_BASE_URL=https://www.zohoapis.in/invoice/v3

ZOHO_RESERVATION_DOCUMENT_MODE=retainer_invoice
ZOHO_RESERVATION_ITEM_ID=
ZOHO_RESERVATION_TAX_ID=
ZOHO_RESERVATION_TAX_MODE=inclusive
ZOHO_RESERVATION_TAX_BASIS_POINTS=
ZOHO_SEND_DOCUMENT_EMAIL=true

RESERVATION_AMOUNT_PAISE=49900
RESERVATION_CURRENCY=INR
RESERVATION_CREDITED_TO_FINAL_INVOICE=true

RESEND_API_KEY=
RESEND_FROM_EMAIL="Garmops <orders@garmops.com>"
FINANCE_ALERT_EMAIL=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_S3_ENDPOINT=
R2_PRIVATE_BUCKET=garmops-private-orders

CRON_SECRET=
JOB_WORKER_ID=garmops-vercel
JOB_BATCH_SIZE=20

NEXT_PUBLIC_ACCOUNTS_ENABLED=true
R2_PRIVATE_UPLOADS_ENABLED=true
CLOUD_DESIGNS_ENABLED=true
DURABLE_CUSTOM_CHECKOUT_ENABLED=true
ZOHO_INVOICE_AUTOMATION_ENABLED=false
```

For `ZOHO_RESERVATION_TAX_MODE=exclusive`, set `ZOHO_RESERVATION_TAX_BASIS_POINTS` to the combined finance-approved rate. The code derives the pre-tax line rate with integer arithmetic and still refuses completion unless Zoho returns the exact ₹499 gross total.

Use separate test and production credentials. Never expose production Zoho, PayU, R2 or Supabase service-role credentials to Vercel Preview.

## 4. Database migration and generated types

Run from the repository root:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
```

The Phase 9 migration is:

```text
supabase/migrations/20260730220000_zoho_phase9.sql
```

It adds:

- provider status and snapshot evidence;
- completed-document constraints;
- unique provider document/payment identifiers;
- a finance queue index;
- safe feature-disabled job deferral;
- an MFA- and permission-protected finance retry function.

Commit the regenerated `src/types/database.generated.ts`. Do not hand-edit it after generation.

## 5. Worker and cron

The application uses PostgreSQL as the durable queue. Vercel Cron calls:

```text
GET /api/internal/jobs/process
Authorization: Bearer <CRON_SECRET>
```

`vercel.json` schedules the processor every 10 minutes. The route uses a constant-time secret comparison, claims a bounded job batch and returns counts only.

When Zoho automation is disabled, invoice jobs are deferred for 12 hours without consuming an attempt. A verified PayU payment remains paid regardless of Zoho, R2 or email availability.

On production, confirm:

- Vercel Pro or another commercial plan supporting the configured cron schedule;
- `CRON_SECRET` is set only in server environments;
- the cron route is not cached;
- function runtime is Node.js;
- invocation logs do not contain tokens or provider payloads;
- dead jobs trigger a finance alert or are reviewed from `/staff/invoices`.

## 6. Staging test procedure

Use a Zoho test organisation or a finance-approved safe test procedure. Do not test invoice creation in the live accounting organisation with invented tax IDs.

### Test A — successful retainer

1. Place a custom order in PayU test mode.
2. Complete and verify the ₹499 payment.
3. Confirm one `invoices` row and one `create_reservation_invoice` job exist.
4. Run the job processor.
5. Confirm one Zoho contact, one retainer, and one customer payment exist.
6. Confirm the Zoho total and payment are exactly ₹499.00.
7. Confirm the official document date uses the verified PayU date in `Asia/Kolkata`.
8. Confirm the PDF is copied to private R2.
9. Confirm the customer can download it from `/account/documents` and the order page.
10. Confirm another organisation cannot obtain its signed URL.

### Test B — standard-invoice mode

Repeat Test A with:

```env
ZOHO_RESERVATION_DOCUMENT_MODE=standard_invoice
```

Verify the finance-approved accounting treatment before production use.

### Test C — tax reconciliation

Test the exact item and tax IDs for the production organisation in both the selected customer GST situation and place-of-supply situation.

The job must stop with a finance exception if Zoho returns any gross total other than ₹499.00. Do not edit the database to force completion.

### Test D — duplicate and ambiguous responses

Simulate or safely reproduce:

- job execution twice;
- timeout immediately after contact creation;
- timeout immediately after retainer/invoice creation;
- timeout immediately after customer-payment creation;
- timeout after R2 upload but before database completion;
- Resend or Zoho email failure after document creation.

The next job run must adopt the contact/document/payment by the deterministic Garmops marker or external reference. It must not create duplicates.

### Test E — provider failures

Verify handling for:

- OAuth expiry and token refresh;
- HTTP 429;
- HTTP 5xx and timeout;
- invalid item/tax/contact configuration;
- multiple contacts matching the same company;
- multiple documents or payments using the same Garmops reference;
- invalid or non-PDF provider response;
- R2 write failure.

Temporary failures must retry. Configuration, ambiguity and reconciliation failures must enter the finance queue without reversing the verified payment.

### Test F — staff permission

Confirm:

- normal customers cannot view staff invoice errors;
- read-only and non-finance staff cannot retry invoice jobs;
- finance/super-admin retry requires AAL2 MFA;
- every retry creates an audit event;
- customers see only safe status copy, not provider secrets or raw payloads.

## 7. Required local checks

All of these must pass on a clean checkout:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run build
npm run seo:check
npm run agent:check
```

Also run the PayU sandbox matrix from Phase 8 before enabling Phase 9. Zoho jobs must only originate from a payment finalised by the trusted PayU verification service.

## 8. Rollout sequence

1. Apply the migration and regenerate types locally.
2. Run the complete test suite.
3. Configure a non-production Zoho organisation and R2 bucket.
4. Keep `ZOHO_INVOICE_AUTOMATION_ENABLED=false` while validating environment parsing and the worker route.
5. Enable the flag in staging only.
6. Complete all staging tests above.
7. Have finance compare the Zoho document, PayU payment, database row and R2 PDF.
8. Review the finance queue and dead-job behaviour.
9. Configure production credentials separately.
10. Enable for an internal or allow-listed cohort.
11. Review every document during the initial cohort.
12. Enable generally only after finance signs off.

## 9. Rollback

To stop new Zoho work without losing payments or accounting evidence:

```env
ZOHO_INVOICE_AUTOMATION_ENABLED=false
```

Redeploy. Claimed invoice jobs are deferred safely and later become available after re-enablement. Do not delete invoices, integration jobs, payment attempts, provider IDs, audit records or R2 PDFs.

If the provider configuration is wrong, keep the flag disabled, correct it, and use the MFA-protected Retry action in `/staff/invoices`. Never retry by manually inserting another invoice row or by changing a paid PayU record.

## 10. Production acceptance criteria

Phase 9 is ready for production only when all are true:

- one verified ₹499 reservation creates at most one Zoho document and one Zoho payment;
- the official Zoho document number is stored;
- the total, paid amount and balance reconcile exactly;
- the official PDF is privately stored in R2 and customer-authorised;
- retries safely adopt ambiguous provider success;
- an outage does not alter the paid order state;
- finance can see and retry exceptions with MFA and audit logging;
- the complete clean test suite passes;
- finance approves document mode, item, tax, template, wording and date handling;
- production and preview credentials are isolated;
- Zoho annual document usage and the configured upgrade trigger are reviewed monthly.
