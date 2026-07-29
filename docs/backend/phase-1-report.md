# Phase 1 implementation report

Date: 2026-07-29
Branch: `main`
Operating mode: development and internal testing
Frontend status: unchanged

## Outcome

The repository now has a reproducible local Supabase foundation. A clean database reset applies the committed identity migration, creates deterministic local Auth users and tenant/staff fixtures, passes 19 database checks, and generates strict TypeScript database types.

No account portal, staff portal, public navigation, component, style, configurator behavior, checkout behavior, payment route, proxy rule, or production provider setting changed.

## Dependencies and scripts

Runtime:

- `@supabase/supabase-js@2.111.0`
- `@supabase/ssr@0.12.4`
- `zod@4.4.3`
- `server-only@0.0.1`

Development:

- `supabase@2.110.0`
- `vitest@3.2.7`

Added scripts:

- `typecheck`
- `test`
- `db:start`
- `db:stop`
- `db:reset`
- `db:test`
- `db:types`

## Migration

`supabase/migrations/20260729053747_core_identity.sql` adds:

- `citext` and `pgcrypto` extensions;
- `organization_role` and `staff_role` enums;
- `profiles`;
- `organizations`;
- `organization_members`;
- `staff_members`;
- `addresses`;
- membership, organisation, and address indexes;
- one-default-billing and one-default-shipping constraints;
- reusable `updated_at` trigger function and table triggers;
- structural validation for names, phones, slugs, GSTIN, PAN, email, country codes, and Indian postal codes;
- Row Level Security enabled with no browser policies yet, so the schema fails closed until Phase 3 policies are reviewed.

Phase 2 order/payment/invoice/file/job schema is intentionally absent.

## Local Supabase configuration and seed

The local configuration:

- requires email confirmation;
- enables authenticator-app TOTP;
- raises the local password minimum to eight characters with upper/lowercase letters and digits;
- uses exact localhost redirect origins;
- disables Supabase Storage, Realtime, analytics, and Edge Functions in line with the cost-first architecture.

`supabase/seed.sql` creates five deterministic local Auth users, two isolated organisations, three customer memberships, super-admin/read-only staff records, and one default address per organisation. Passwords and `.local` emails are test fixtures only.

`supabase/tests/01_core_identity.sql` verifies enums, tables, primary keys, RLS activation, and all fixture counts.

## Generated types and environment validation

`src/types/database.generated.ts` was generated from the reset local database and is not hand-maintained.

`src/lib/config/envSchema.ts` implements typed Zod parsing, conditional provider requirements, strict rollout booleans, bounded job settings, and value-free error messages. `src/lib/config/env.ts` is guarded by `server-only` and caches validated runtime configuration.

No environment variable names were added beyond the Phase 0 `.env.example`; this phase implemented validation for them. Existing `.env.local` values were neither printed nor changed.

## Commands and results

| Command/check | Result |
| --- | --- |
| `npm ci` | Passed; reproducible clean install |
| `npx supabase db reset` | Passed; migration and seed rebuilt from zero |
| `npx supabase test db` | Passed; 1 file, 19 tests |
| `npm run db:types` | Passed; generated local database types |
| `npm test` | Passed; 2 files, 7 tests |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; all existing routes and 52 generated pages compiled |
| `npm run seo:check` | Passed |
| `npm run agent:check` | Passed |
| `npm audit --omit=dev` | Passed; 0 production vulnerabilities |

The full `npm audit` reports nine high-severity development-only findings in the existing ESLint/minimatch/brace-expansion dependency chain. Its proposed automatic remediation upgrades ESLint across a breaking major version, so no forced audit rewrite was applied during backend foundation work.

## Machine/runtime setup

This machine had no Docker-compatible runtime. Colima and the Docker CLI were installed with Homebrew to complete local verification. A stale user Docker configuration still references the removed `docker-credential-desktop` helper; verification used an isolated temporary Docker configuration and did not modify the user's Docker credentials/configuration.

The Supabase containers and Colima VM were stopped after validation with database volumes preserved. See `docs/backend/local-supabase.md` for normal commands and troubleshooting.

## Hosted development project update

After Phase 1 verification, the owner authorised creation of the shared hosted development project:

- Vercel Marketplace resource: `garmops-development`;
- Supabase project reference: `vookvteetdolowqsionv`;
- plan: Supabase Free;
- region: Mumbai (`bom1`);
- PostgreSQL: 17.6, matching the local PostgreSQL 17 major version;
- Vercel scope: Development only, with Supabase variables absent from Preview and Production;
- migration `20260729053747_core_identity.sql` applied through a direct encrypted database connection;
- deterministic local test seed not applied to the hosted project.

Remote verification confirmed matching local/remote migration history, all five Phase 1 tables, the expected update triggers and role enums, and RLS enabled with zero policies on every Phase 1 table. The zero-policy state is intentional and fail-closed until Phase 3.

Vercel stores the Marketplace-managed database and Supabase values as encrypted environment variables. Existing `.env.local` values were neither printed nor changed. No production database or paid service was created.

## Manual setup still required

- Keep using direct credential-isolated CLI commands until a Supabase personal access token is explicitly configured for persistent `supabase link` support.
- Add only the project URL and publishable key to local development when Phase 4 account work begins.
- Keep the service-role/secret key server-only and out of Preview, Production, and browser-exposed variables.

## Known phase boundary

RLS is enabled but has no customer/staff policies. This is intentionally fail-closed until Phase 3. No application route uses Supabase yet; browser/server/admin clients and auth pages belong to Phase 4. The next phase is the durable order/payment/invoice/file/PostgreSQL-job schema.
