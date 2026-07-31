# Phase 10 implementation report

## Summary

Implemented the staff operations workflow over the Phase 9 database-backed order, payment, invoice and file platform.

### User-facing additions

- operational dashboard with exception metrics;
- filterable/searchable staff order queue;
- complete order workspace with product, customer, payment, invoice, file, approval, shipment, comments, history and audit panels;
- assignment, team, priority and expected-date controls;
- role-aware controlled status transitions;
- staff-only notes, customer updates and action requests;
- customer replies in the account order page;
- customer organisation detail pages;
- staff file register and audit register;
- existing Phase 9 finance queue integrated into staff navigation.

### Security additions

- all operational mutations require an active staff row and AAL2 TOTP MFA;
- PostgreSQL is authoritative for permissions and state transitions;
- staff cannot manufacture PayU payment states;
- every sensitive staff mutation writes an audit row;
- customer/staff note visibility remains separated through RLS;
- private files are downloadable only after their scan state is clear;
- file-visibility changes require a reason and cannot make order files public;
- queue reads are bounded to 100 rows per database call.

## Migration

- `supabase/migrations/20260730233000_staff_operations_phase10.sql`

The migration adds operational assignment/team/date fields, indexes, central permissions and audited staff RPCs.

## Tests added

- `supabase/tests/10_staff_operations_phase10.sql` — 41 pgTAP assertions
- `src/lib/staff/statuses.test.ts` — transition, public-status and permission tests

## Environment variables

No new environment variables are required for Phase 10.

Existing requirements remain:

- Supabase public and service-role credentials;
- staff portal feature flag;
- R2 private-download configuration;
- Phase 8 PayU and Phase 9 Zoho settings where those integrations are enabled.

## Validation performed in the implementation environment

- TypeScript/TSX syntax parsing: passed for all source files.
- Local import resolution: passed.
- JSON parsing: passed.
- pgTAP plan count: 41 planned and 41 assertion calls.
- SQL delimiter/structure checks: passed.
- generated order-field presence check: passed.
- secret-pattern scan: passed; only documented placeholder values were present.

## Validation not completed in this environment

The complete dependency-backed suite could not be run because the available npm mirror returned `404 Not Found` for the repository's locked `zustand@5.0.14` package. The following must be run locally:

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

## Manual setup and UAT

1. Apply the migration to a non-production Supabase project.
2. Regenerate `src/types/database.generated.ts`; do not retain manual generated-type edits if generated output differs.
3. Seed/invite at least one account for every staff role.
4. Confirm all staff routes require AAL2.
5. Test the queue and workspace with real-shaped test orders.
6. Verify role denial for read-only, support, finance and department roles.
7. Verify staff-only notes never appear in the customer account.
8. Verify customer updates/action requests appear and notify only the correct organisation.
9. Confirm unscanned files cannot be downloaded.
10. Confirm cancellation and high-impact transitions require the intended permissions and reason.
11. Check expected-date constraints are validated before production enablement.

## Known Phase 10 boundaries

- approval creation/response, QC, shipments and reorder are Phase 11;
- durable sample checkout is Phase 12;
- comprehensive load testing, monitoring, backup drill and production hardening are Phase 13.
