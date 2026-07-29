# Phase 3 implementation report

Date: 2026-07-29
Branch: `main`
Operating mode: development and internal testing
Frontend status: unchanged

## Outcome

The database now enforces fail-closed tenant isolation and an MFA-aware staff permission matrix locally and in the hosted Supabase Development project. Every one of the 23 domain tables has forced Row Level Security, browser access is reduced to reviewed operations and columns, and provider/system truth remains service-only.

No page, component, style, public route, proxy rule, configurator behaviour, checkout behaviour, payment route, provider adapter, or production setting changed.

## Migration

`supabase/migrations/20260729072155_rls_and_permissions.sql` adds ten stable, security-definer authorization helpers with an explicit empty `search_path`:

- `is_organization_member`;
- `has_organization_role`;
- `current_staff_role`;
- `is_active_staff`;
- `staff_has_permission`;
- `is_order_organization_member`;
- `user_can_access_order`;
- `is_design_organization_member`;
- `user_can_access_design`;
- `user_can_access_order_item`.

Execution is revoked from `PUBLIC` and `anon`, then granted only to `authenticated` and `service_role`.

The migration enables `FORCE ROW LEVEL SECURITY` on all five Phase 1 tables and all 18 Phase 2 tables. It removes the broad Supabase browser grants and replaces them with reviewed table- and column-level privileges.

## Permission model

Customer access is derived from active organization membership:

- customers can read and update safe fields on their own profile;
- organization owners can update safe organization identity fields;
- owners, buyers, and finance members can manage organization addresses, while only owners can delete them;
- owners and buyers can create/update tenant design drafts and append immutable versions;
- active organization members can read their tenant's orders, items, sizes, invoices, shipments, customer-visible history, comments, files, and safe approval fields;
- customers can add customer-visible comments, respond to authorized approval requests, and mark only their own notifications read;
- cross-tenant reads and writes fail closed.

Staff access is centralized in `staff_has_permission`. An active staff record alone is insufficient: staff permissions require an `aal2` JWT. The matrix distinguishes order reads, internal/customer comments, commercial changes, production, artwork, payment payloads, invoice/refund workflows, QC, approvals, shipments, provider jobs, audit access, and staff administration.

Read-only staff receive MFA-gated read access but no mutation capability. Deactivating a staff record immediately removes staff permissions.

## Service and provider boundaries

Browser roles cannot directly mutate:

- durable order or submitted-item truth;
- number counters or idempotency records;
- payment attempts or provider events;
- invoice truth;
- integration jobs;
- audit records.

Payment payloads are visible only to MFA-authenticated staff with finance/operations permission. Integration jobs and audit logs have separate permission checks. Approval token and IP hashes are not selectable by browser roles. Provider and system mutations remain behind the existing service-role functions and future validated server routes.

## Policies

The migration adds 35 policies covering:

- profile, organization, membership, staff, and address access;
- design draft/version access;
- orders, items, sizes, and customer-visible records;
- permission-controlled payment payload reads;
- customer/staff comments and file visibility;
- approval request/response boundaries;
- invoices, jobs, shipments, notifications, and audits.

Sensitive records intentionally have no browser mutation policy.

## Automated verification

`supabase/tests/03_rls_permissions.sql` adds 123 Phase 3 assertions. Together with Phases 1 and 2, the database suite now has 242 passing assertions.

The tests execute as real Supabase JWT personas:

- Alpha organization owner;
- Alpha buyer;
- Alpha finance member;
- Alpha viewer;
- Beta organization owner;
- read-only staff at `aal1` and `aal2`;
- super admin at `aal1` and `aal2`;
- finance staff;
- support staff;
- deactivated staff;
- anonymous user.

Coverage includes:

- helper grants and anonymous execution denial;
- forced RLS on all 23 domain tables;
- cross-tenant organizations, orders, comments, files, profiles, notifications, and updates;
- customer-visible versus staff-only history/comments/files;
- owner, buyer, finance, and viewer write boundaries;
- invoice visibility without order mutation;
- direct staff-record privilege escalation denial;
- safe approval reads/responses without token/IP hash exposure;
- MFA-gated staff reads and mutations;
- read-only staff immutability;
- finance, support, dispatch, audit, and job permission separation;
- immediate staff deactivation;
- browser write denial for order, payment, invoice, job, audit, counter, and idempotency truth.

The historical Phase 2 assertion that expected zero policies was advanced to the Phase 3 invariant: sensitive Phase 2 tables expose no browser mutation policy.

## Commands and results

| Command/check | Result |
| --- | --- |
| Pre-change `npm run lint` | Passed |
| Pre-change `npm run typecheck` | Passed |
| Pre-change `npm test` | Passed; 2 files, 7 tests |
| `npx supabase db reset --local` | Passed from an empty local database with all three migrations and seed |
| `npx supabase test db` | Passed; 3 files, 242 assertions |
| `npx supabase db lint --local --level warning` | Passed; no schema errors |
| `npm run db:types` | Passed; generated the Phase 3 helper signatures |
| Final `npm run lint` | Passed |
| Final `npm run typecheck` | Passed |
| Final `npm test` | Passed; 2 files, 7 tests |
| Final `npm run build` | Passed; 52 pages generated |
| Final `npm run seo:check` | Passed |
| Final `npm run agent:check` | Passed |
| Hosted `supabase db push --dry-run` | Exactly one Phase 3 migration; no seed or roles |
| Hosted `supabase db push` | Passed |
| Hosted catalog verification | 23 forced-RLS tables, 35 policies, 10 security-definer helpers |
| Hosted role verification | 10 authenticated helper grants, zero anonymous helper grants, zero browser truth-mutation grants |
| Hosted sensitive-data verification | Zero sensitive mutation policies; approval token/IP columns not browser-readable |
| Hosted data verification | Zero orders, invoices, and jobs; local seed not copied |

The first sandboxed final build failed because Turbopack could not bind its internal worker port. The approved unrestricted rerun passed; this was an execution-sandbox restriction, not an application failure.

## Hosted Development project

- Vercel Marketplace resource: `garmops-development`;
- Supabase project reference: `vookvteetdolowqsionv`;
- plan: Supabase Free;
- region: Mumbai (`bom1`);
- PostgreSQL: 17.6;
- Vercel scope: Development only;
- remote migrations: Phase 1 `20260729053747`, Phase 2 `20260729064326`, and Phase 3 `20260729072155`.

Existing `.env.local` values were neither printed nor changed. Vercel values were pulled only into a permission-restricted temporary file for migration and verification; that file was deleted afterward. No Preview/Production database, production data, local seed, paid service, Redis instance, managed queue, or Realtime channel was added.

## Known phase boundary

- Phase 3 authorizes data access, but no browser/server/admin Supabase clients or application route uses these policies yet.
- MFA enforcement is ready at the database layer and requires the Phase 4 authenticator-app enrolment/challenge flow to issue `aal2` staff sessions.
- Server actions and routes in later phases must still perform their own operation-specific permission, provider-signature, and input checks; the service role must never be exposed to the browser.
- File metadata visibility is protected, but R2 upload/finalization/signed-download infrastructure belongs to Phase 5.
- Payment and invoice provider processing remains scheduled for later phases.
- No production database or paid service has been created.

## Next phase

Phase 4 adds Supabase browser/server/admin clients, email/password authentication, verification/reset, organization onboarding, staff invitations, authenticator-app TOTP, protected account/staff shells, Turnstile, and auth rate limits.

Phase 4 necessarily changes frontend routes, layouts, and authentication pages. Per the project owner's instruction, those frontend changes require explicit permission before implementation begins.
