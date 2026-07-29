# Phase 7 implementation report

Date: 2026-07-29
Scope: durable custom-order submission, authoritative server pricing,
immutable commercial snapshots, pre-payment order confirmation, unpaid
payment retries, and customer order history.

## Outcome

Phase 7 is implemented end to end with the owner's standing frontend
permission.

A verified owner or buyer can now:

- submit exactly one immutable cloud design version as a custom order;
- receive a database-generated `GAR-YYYY-NNNNNN` order number and server order
  date before PayU;
- refresh, sign in on another device, or return later without losing the
  unpaid order;
- review the immutable order, delivery snapshot, totals, status timeline, and
  safe payment-attempt history;
- prepare an unpaid payment retry without changing the order number or
  overwriting an earlier attempt;
- browse bounded customer order history with public-status filters.

The linked Supabase Development project has the Phase 7 migration applied.
`DURABLE_CUSTOM_CHECKOUT_ENABLED=true` is configured only in Vercel
Development. Preview and Production remain disabled.

Phase 8 still owns the PayU provider adapter, database-only initiation,
callback/webhook verification, Verify Payment API, and atomic paid
finalisation. Phase 7 never treats a browser redirect as proof of payment.

## Database transaction boundary

Migration:

- `20260729203000_durable_custom_order_submission.sql`;
- `20260729214500_phase7_terms_guard.sql`.

`submit_custom_order` is a service-role-only wrapper around the existing
atomic `submit_order` foundation. In one PostgreSQL transaction it:

1. requires an active organisation owner or buyer;
2. locks and validates the organisation-scoped design project;
3. requires an exact immutable design-version UUID;
4. rejects archived designs and new orders from an already submitted design;
5. verifies accepted terms and the retained terms version;
6. verifies unique, finalised, customer-visible design file references;
7. claims the submission idempotency key and request hash;
8. allocates the order number and database submission timestamp;
9. inserts immutable order, item, and relational size snapshots;
10. inserts the initial customer-visible status-history row;
11. creates the first ₹499 reservation payment attempt;
12. links finalised design files to the submitted order without copying R2
    bytes;
13. changes the design to `submitted`;
14. writes the order-submission audit record;
15. commits or rolls back the entire operation.

A replay with the same actor, idempotency key, and canonical request hash
returns the original order and payment attempt. Reusing the key for different
content is rejected.

The additive terms guard also rejects any Phase 7 order insert that omits
explicit acceptance or a retained terms version, including attempts to bypass
the trusted wrapper.

Phase 5 originally required file metadata to target exactly one order or
design. Phase 7 evolves this to “at least one target” so a finalised design
file can retain its design relationship and also be linked to the immutable
order that uses it. Upload-slot creation still requires exactly one initial
target.

## Retryable unpaid attempts

`retry_order_payment` is service-role-only and:

- verifies an active owner/buyer membership for the order organisation;
- accepts only `awaiting_payment` or `payment_failed` orders inside the
  configured unpaid window;
- rejects orders with an already paid reservation attempt;
- returns an existing `created`, `initiated`, or `pending` attempt rather than
  creating redundant attempts;
- appends attempt 2–99 only after a failed or cancelled attempt;
- copies the database reservation amount, currency, and customer identity;
- retains the previous attempt unchanged;
- restores a failed order to `awaiting_payment`;
- appends customer-visible status history and an audit record;
- makes retry requests idempotent independently from order submission.

The order remains durable when payment is abandoned or fails. Expired pricing
is not silently reactivated.

## Trusted application service

Phase 7 adds:

- `src/lib/orders/schema.ts` for strict submission, address, filter, retry, and
  order-number validation;
- `src/lib/orders/pricing.ts` for canonical product/size/MOQ/price/tax
  recalculation in integer paise;
- `src/lib/orders/service.ts` for authenticated snapshot construction and the
  service-role transaction calls;
- `src/lib/orders/dal.ts` for tenant-bounded order reads and sanitised payment
  summaries;
- `src/lib/orders/api.ts` for private/no-store responses, exact-origin checks,
  request-size limits, verified sessions, and the rollout gate;
- `src/lib/orders/client.ts` for replay-safe cart preparation, cloud-design
  saving, immutable version creation, and durable submission.

The browser submits IDs, address/contact inputs, size allocation, delivery
choice, accepted terms, and an idempotency UUID. It does not submit an
authoritative total.

The server:

- loads the exact design version under tenant RLS;
- parses the supported cloud-design schema;
- resolves the canonical product catalogue entry;
- validates every size and the total quantity;
- enforces 50-unit standard MOQ and 100-unit custom-dye MOQ;
- recalculates configured unit price, volume discount, rush fee, GST, and
  estimated total;
- converts all authoritative money to integer paise;
- verifies finalised file ownership and lifecycle state;
- combines authoritative profile/organisation fields with submitted checkout
  details;
- hashes a stable canonical request before invoking PostgreSQL.

Later product or pricing changes cannot alter the submitted snapshots.

## API routes

Node.js dynamic route handlers:

- `POST /api/orders/custom/submit`;
- `GET /api/orders`;
- `GET /api/orders/:orderNumber`;
- `POST /api/orders/:orderNumber/payments/retry`.

All routes fail closed behind `DURABLE_CUSTOM_CHECKOUT_ENABLED`, use verified
Supabase users, and return private/no-store responses. Mutations require the
exact configured application origin. Request bodies are bounded and validated
with Zod. Customer-facing order-number paths are resolved only inside the
authenticated organisation scope.

Payment-attempt responses exclude merchant transaction IDs, provider payloads,
failure internals, and customer PII. Provider event data remains inaccessible
to normal customer sessions.

## Cart and customer portal

When the Development rollout flag is enabled, the existing confirmation step:

1. validates the current cart and delivery inputs;
2. saves the single configured product as a cloud design;
3. uploads referenced artwork through the existing private R2 lifecycle;
4. creates an immutable design version;
5. persists the checkout idempotency key and exact version reference;
6. submits the durable order;
7. navigates to the server-backed confirmation screen.

When the flag is off, the prior checkout behaviour remains unchanged. Phase 7
durable submission currently accepts one configured product per order, matching
the one-design-version contract; additional products must use separate carts.

Customer pages:

- `/account/orders` — bounded history and public-status filters;
- `/account/orders/:orderNumber` — immutable specification, sizes, totals,
  delivery snapshot, customer-visible timeline, and sanitised attempts;
- `/account/orders/:orderNumber/confirmation` — durable order number/date and
  pre-PayU reservation confirmation.

The payment action prepares or reuses the durable attempt. It does not yet sign
or post PayU fields; that provider handoff is Phase 8.

## Environment and rollout

`DURABLE_CUSTOM_CHECKOUT_ENABLED` is server-only, exact-`true`, and defaults
off. It requires:

- accounts;
- Supabase URL/publishable configuration;
- a Supabase secret/service-role server boundary;
- cloud designs, which already require private R2.

Phase 7 order creation deliberately does not require PayU secrets. Those
credentials become a conditional requirement when Phase 8 payment processing
is enabled.

Vercel state:

- Development: enabled;
- Preview: disabled;
- Production: disabled.

## Validation

| Check | Result |
| --- | --- |
| Clean local database rebuild | Passed |
| Supabase pgTAP | Passed; 7 files, 403 assertions |
| Phase 7 pgTAP | Passed; 37 assertions |
| Local Supabase schema lint | Passed; no errors |
| Hosted migration apply | Passed |
| Hosted migration history | Local and remote versions match |
| Hosted Supabase schema lint | Passed; no errors |
| Generated database types | Passed |
| TypeScript | Passed |
| ESLint | Passed; no warnings |
| Vitest | Passed; 8 files, 40 tests |
| Next.js production build | Passed; three order pages and four order APIs present |
| Vercel Development flag | Present and enabled |

The first sandboxed Next.js build failed because Turbopack could not bind its
internal CSS-worker port. The approved unrestricted rerun passed; this was a
sandbox restriction, not an application failure.

## Rollout boundary

- Supabase Development contains the Phase 7 schema.
- Vercel Development has the Phase 7 order gate enabled.
- Preview and Production remain unchanged.
- No callback, webhook, redirect, or browser value can mark an order paid.
- PayU production-grade processing remains Phase 8.
- Sample checkout remains on its existing path until Phase 12.
- No repository commit, push, or production deployment is part of this phase
  completion.
