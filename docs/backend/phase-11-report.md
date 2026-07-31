# Phase 11 implementation report

Date: 31 July 2026  
Scope: approvals, shipment tracking, document history, QC evidence, notifications, and reorder.

## Completion summary

Phase 11 is implemented on top of the Phase 10 staff operations workflow.

The implementation provides:

- approval requests tied to an immutable design version and approval PDF SHA-256;
- company approver decisions from authenticated customer accounts;
- secure, expiring external-manager approval links;
- approval viewed, approved, changes-requested, revoked, superseded, and expired handling;
- shipment records with independent package timelines for split deliveries;
- customer-visible tracking events and staff-only internal shipment notes;
- customer document history and selected QC evidence;
- in-app approval and shipment notifications;
- delivered-order reorder with fresh configuration/version, pricing, order number, order date, and payment attempt;
- staff approval and shipment queues;
- audit records for sensitive approval, file, shipment, and reorder operations.

## Database migration

```text
supabase/migrations/20260731070000_phase11_approvals_shipments_history_reorder.sql
```

The migration adds or changes:

- `orders.source_order_id`, including immutability enforcement;
- approval evidence digest, revocation, and decision metadata;
- protected staff approval projections;
- append-only `shipment_events` with forced RLS;
- customer-safe shipment event projection;
- browser upload support for approval PDFs, proofs, QC photos, packing lists, labels, and shipment documents;
- approval request, response, revocation, shipment, notification, and reorder RPCs;
- order transition guards for approvals, dispatch, and complete split-shipment delivery;
- shipment state sequencing;
- fresh durable reorder submission.

## Approval security model

- Approval is bound to one `design_project_versions.id`.
- Approval PDF must be a finalized private R2 object with a real SHA-256 digest.
- Customer/account access never exposes external tokens, IP hashes, user-agent evidence, or external recipient data.
- Staff recipient details are returned only through AAL2/permission-protected database projections.
- External links store only a SHA-256 token digest in PostgreSQL.
- External links are single-decision, expiring, and invalidated by a newer request.
- A later artwork version requires a new approval request.
- Changes requested return an awaiting-approval order to artwork review and create history/notifications.
- New approval requests cannot silently reopen production-approved orders.
- Staff cannot use approval UI to bypass payment verification.

## Shipment model

Supported package states:

```text
preparing
→ dispatched
→ in_transit
→ out_for_delivery
→ delivered
```

`exception` and `cancelled` are controlled branches. State transitions cannot move backward. Each package has a separate durable shipment number and append-only event history. An order cannot become delivered until every non-cancelled package is delivered and has `delivered_at` recorded.

## Reorder model

A reorder is not an edit of a historical order. It creates:

- a fresh design project;
- a fresh design version;
- current server-side price calculation;
- current terms evidence;
- a new immutable order snapshot;
- a new server-generated order number and date;
- a new reservation-payment attempt;
- an immutable link to the delivered source order.

Unavailable or unparseable historical configurations are stopped for staff review instead of silently ordering a substitute.

## UI routes

Customer:

```text
/account
/account/orders/:orderNumber
/account/documents
/account/notifications
/approve/:token
```

Staff:

```text
/staff/approvals
/staff/shipments
/staff/orders/:orderNumber
```

## Tests added

```text
supabase/tests/11_phase11_approvals_shipments_reorder.sql
src/lib/domain/approvals/approval.test.ts
```

The pgTAP suite contains 51 assertions covering permission boundaries, approval evidence, expiry/supersession, company decisions, production transition guards, shipment sequencing, split deliveries, customer-safe projections, notifications, reorder creation, source-order preservation, and source-link immutability.

## Validation completed in the implementation environment

- 307 TypeScript/TSX files parsed with zero syntax diagnostics.
- Relative TypeScript imports resolved.
- JSON files parsed successfully.
- Phase 11 migration dollar-quote structure is balanced.
- pgTAP plan and assertion count match: 51/51.
- No real provider credentials were added.
- No dependency directories or build outputs are included in delivery archives.

## Validation limitation

The complete dependency-backed suite could not be executed in the implementation environment because its package mirror did not provide the repository-locked `zustand@5.0.14` package. This is an environment limitation. Local completion must run the full clean-install, database, lint, type, unit, build, SEO, and agent checks.

## Manual setup still required

No new secret is introduced exclusively by Phase 11, but the following existing configuration is required for the relevant feature:

- private R2 credentials and bucket configuration;
- `R2_PRIVATE_UPLOADS_ENABLED=true`;
- `NEXT_PUBLIC_ACCOUNTS_ENABLED=true`;
- `STAFF_PORTAL_ENABLED=true`;
- `DURABLE_CUSTOM_CHECKOUT_ENABLED=true` for reorder payment;
- `NEXT_PUBLIC_APP_URL` set to the stable staging/production origin;
- `AUTH_RATE_LIMIT_SALT` for irreversible external-approval network evidence;
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` when external-manager approval email is used.

An external approval request is automatically revoked when email is unavailable or delivery fails, preventing an active but unusable bearer link.

## Known scope boundaries

Not part of Phase 11:

- durable sample checkout, which remains Phase 12;
- final CSP, load, backup/restore, WAF, monitoring, production rollout, and legacy cleanup, which remain Phase 13;
- automated carrier API ingestion; shipment events are operated by staff in this phase;
- automated malware scanning service; existing scan/manual-review controls remain in force.
