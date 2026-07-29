# Local Supabase development

Last reviewed: 2026-07-29
Pinned CLI: `supabase@2.110.0`

## Prerequisites

- Node.js 20 or newer.
- A Docker-compatible runtime such as Docker Desktop, Colima, OrbStack, Rancher Desktop, or Podman.
- At least 6 GB of memory available to the local container runtime for the configured services.

The local stack is development-only, uses default credentials, and must never be exposed to an external network.

## Commands

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run db:stop
```

`db:reset` destroys only the local Supabase database, reapplies every committed migration, and reloads `supabase/seed.sql`. Never add `--linked` to the reset command: a linked reset targets a remote database.

`db:types` introspects the running local database and rewrites `src/types/database.generated.ts`. The generated file is committed and must not be edited manually.

## Local configuration

The project disables local Supabase Storage, Realtime, analytics, and Edge Functions because the initial architecture uses R2 for files, PostgreSQL jobs, and request-time/server-rendered reads. Email confirmation and authenticator-app TOTP are enabled for upcoming authentication work.

Supabase Studio is available at `http://127.0.0.1:54323` while the stack runs. Mailpit captures local auth email at `http://127.0.0.1:54324`; it does not deliver externally.

Use `npx supabase status` to obtain the current local API URL and publishable key. Do not commit local or hosted keys. The service-role/secret key is server-only and is not needed by the public frontend.

## Deterministic fixtures

`supabase/seed.sql` creates two separate customer organisations, an owner/buyer membership set, an owner in the second tenant, and super-admin/read-only staff fixtures. Their passwords and `.local` email addresses are intentionally public test data and must never be copied to a hosted project.

These fixtures prepare Phase 3 isolation and staff-permission tests. No seed script uses a hosted project reference, provider secret, or production email address.

## Container-runtime troubleshooting

If Docker reports a missing `docker-credential-desktop` helper while using Colima, an old Docker Desktop `credsStore` entry is still active. Fix the Docker installation/configuration or run the Supabase CLI with an isolated Docker configuration. Do not commit user-specific socket paths or Docker credentials to this repository.

Official references:

- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Database seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
- [Type generation](https://supabase.com/docs/guides/api/rest/generating-types)
