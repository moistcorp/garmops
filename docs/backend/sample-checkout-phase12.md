# Durable sample checkout — Phase 12 setup and UAT

## Purpose

This runbook completes local and staging setup for the database-backed catalogue sample checkout. The customer cart is only a temporary selection layer. The submitted order, price, payment state, documents, staff workflow, and history live in PostgreSQL.

## 1. Apply the files

Use the Phase 12 modified-files archive over the corrected Phase 11 project. Preserve the repository path structure and overwrite matching files.

Do not copy `node_modules`, `.next`, `.git`, or any local `.env*` file from another machine.

## 2. Configure the feature in local/staging only

Start with:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=true
STAFF_PORTAL_ENABLED=true
DURABLE_SAMPLE_CHECKOUT_ENABLED=true

PAYU_ENVIRONMENT=test
NEXT_PUBLIC_PAYU_BASE_URL=https://test.payu.in/_payment
PAYU_VERIFY_BASE_URL=https://test.payu.in/merchant/postservice.php?form=2
PAYU_MERCHANT_KEY=
PAYU_SALT=
PAYMENT_SIGNING_SECRET=
CRON_SECRET=
```

Do not place live PayU credentials in Vercel Preview or local development.

## 3. Apply and verify the database

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
```

Confirm that this migration is present and applied after Phase 11:

```text
supabase/migrations/20260731100000_phase12_durable_sample_checkout.sql
```

Never hand-edit `src/types/database.generated.ts`; regenerate it from the applied schema.

## 4. Run engineering checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run seo:check
npm run agent:check
```

Resolve all new failures before staging. Record unrelated pre-existing failures separately; do not suppress them with broad ignores.

## 5. Customer UAT

Use an email-verified customer who is an active organisation owner or buyer.

### Standard paid sample

1. Add at least one sample product and size.
2. Open `/checkout`.
3. Confirm profile and default shipping prefill where available.
4. Enter a valid Indian address and accept sample terms.
5. Submit once.
6. Confirm a `SAM-YYYY-NNNNNN` order exists before PayU opens.
7. Complete a PayU sandbox payment.
8. Confirm `/payment/success` loads database state.
9. Confirm the cart is empty only after the durable order was saved.
10. Confirm the order appears in `/account/orders` from another browser session/device.

### Shipping threshold

Verify both:

- subtotal below ₹2,000 → ₹99 shipping;
- subtotal at or above ₹2,000 → free shipping.

The PayU amount must exactly equal the database order total.

### Failed and abandoned payment

1. Create a sample order.
2. Fail or abandon PayU.
3. Confirm the order remains in account history.
4. Confirm the original payment attempt remains in history.
5. Retry payment.
6. Confirm a new `sample_full` attempt is created under the same `SAM-...` order.
7. Complete the retry and confirm only one paid transition occurs.

### Duplicate and ambiguous submit

- Double-click submission and verify one order.
- Simulate a lost client response and retry without changing the cart; verify the same idempotency key/order is adopted.
- Change the cart and verify a new checkout key is generated rather than reusing incompatible request evidence.

### Access controls

Confirm:

- guest is redirected to login;
- unverified email cannot submit/pay;
- organisation member without owner/buyer role cannot submit;
- customer A cannot read customer B's sample order by URL change;
- browser-supplied prices are ignored;
- invalid product ID, size, or quantity is rejected safely.

## 6. PayU UAT

Use the same callback, webhook, Verify Payment API, and reconciliation configuration as Phase 8.

Required sample scenarios:

1. correct sandbox payment;
2. tampered amount;
3. invalid response hash;
4. unknown transaction ID;
5. callback then webhook;
6. webhook then callback;
7. duplicate webhook;
8. provider pending then reconciliation success;
9. failure followed by retry;
10. callback claims success but Verify API returns pending/failure;
11. already-paid sample order receives another success event.

A redirect page, callback status string, browser total, or email must never independently mark the order paid.

## 7. Staff UAT

Sign in with AAL2/TOTP staff accounts and test the role matrix.

Confirm:

- paid sample appears in the dashboard and sample-order queue;
- unpaid sample cannot enter packing, QC, dispatch, or delivery;
- sample order does not require artwork approval;
- sample order cannot enter `artwork_review` or `awaiting_artwork_approval`;
- allowed operational status changes create status history and audit records;
- internal notes remain staff-only;
- customer updates are visible to the correct organisation only;
- QC files and shipment documents retain existing R2/scan access controls;
- split shipment and delivery guards from Phase 11 continue working.

## 8. Accounting-placeholder UAT

After verified full payment, confirm exactly one invoice row exists with:

```text
kind = sample_tax_invoice
sync_status = not_required
total_paise = verified payment amount
paid_paise = verified payment amount
balance_paise = 0
```

Confirm:

- no `create_reservation_invoice` integration job is queued;
- no Zoho network call occurs;
- customer documents show that automation is not enabled;
- staff finance queue shows the placeholder as configured later;
- the placeholder has no retry button;
- duplicate PayU delivery creates no duplicate placeholder.

Before any future automatic sample invoice work, finance must supply and approve:

- invoice/document type;
- HSN/SAC treatment;
- GST rate and inclusive/exclusive mode;
- place-of-supply rules;
- Zoho item ID;
- Zoho tax ID;
- document template;
- exact gross-total reconciliation procedure.

Do not reuse reservation-invoice tax settings silently.

## 9. Legacy-flow isolation

With the durable sample flag enabled, verify that direct requests to the old routes cannot create or confirm a sample purchase:

```text
POST /api/payu/hash
POST /api/payu/callback
POST /api/send-confirmation
```

The old sample browser cookie/localStorage success path must not be accepted as payment evidence.

Keep legacy code only for controlled rollback until Phase 13. Do not delete it before staging and production verification.

## 10. Staging enablement sequence

1. Apply database migration.
2. Regenerate types.
3. Deploy with the flag disabled.
4. Run migration, security, and build checks.
5. Configure PayU test credentials/callback/webhook.
6. Enable `DURABLE_SAMPLE_CHECKOUT_ENABLED=true` only on protected staging.
7. Complete customer, staff, PayU, and accounting-placeholder UAT.
8. Review logs for secrets, raw payloads, duplicate events, and unsafe errors.
9. Obtain operations/finance approval.
10. Roll out to production behind the same flag.

## 11. Rollback

Application rollback:

```env
DURABLE_SAMPLE_CHECKOUT_ENABLED=false
```

Redeploy after changing the flag. Existing database sample orders must not be deleted or rewritten. The migration is additive and historical payment/order records remain authoritative.

If rollback temporarily re-enables the legacy checkout, do not represent its browser redirect or email state as equivalent to a verified Phase 12 payment. Resume durable processing before accepting business-critical sample volume.

## 12. Production acceptance criteria

Phase 12 is signed off only when:

- clean database reset and all pgTAP tests pass;
- lint, typecheck, unit tests, production build, SEO, and agent checks pass;
- all PayU duplicate/tamper/reconciliation scenarios pass;
- customer order survives cart clearing, refresh, logout, and device change;
- staff can fulfil paid samples without artwork steps;
- unpaid samples cannot enter fulfilment;
- exact integer-paise total matches order, attempt, PayU verification, and accounting placeholder;
- no cross-organisation order/document access is possible;
- feature-flag rollback is rehearsed;
- operations and finance approve the staging evidence.
