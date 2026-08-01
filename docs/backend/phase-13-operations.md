# Phase 13 production operations runbook

This runbook is the release gate for the Phase 12 durable checkout. It assumes
all Phase 12 database tests and staging UAT have passed.

## Pre-release gate

Run from a clean checkout with the staging environment loaded:

```bash
npm ci
npm run phase13:check
npm run db:start
npm run db:reset
npm run db:test
npm run db:types
npm run lint
npm run typecheck
npm test
npm run build
npm run seo:check
npm run agent:check
```

The database test must report every migration suite as passing. A skipped
provider test, missing Supabase service, or unavailable PayU sandbox is not a
successful release result.

## Required production configuration

- `APP_ENV=production` and `NEXT_PUBLIC_APP_URL` is the canonical HTTPS origin.
- Vercel Pro is enabled for the commercial deployment.
- Supabase Pro is enabled, or the owner has explicitly approved the controlled
  Free pilot with off-site logical backups and a restore drill.
- `CRON_SECRET` is a newly generated secret and is configured in Vercel Cron.
- PayU live callback and webhook URLs point to the production origin.
- R2 private bucket CORS allows only the production application origin.
- Resend sender/domain, Zoho data centre, tax configuration, and PayU merchant
  credentials have been verified in their provider dashboards.
- `DURABLE_CUSTOM_CHECKOUT_ENABLED=true` and
  `DURABLE_SAMPLE_CHECKOUT_ENABLED=true` are enabled only after staging UAT.

Never copy production secrets into preview deployments or commit them to Git.

## Smoke checks after deployment

```bash
curl -fsS https://www.garmops.com/api/health
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://www.garmops.com/api/internal/integration-health
```

Confirm the first response contains `"status":"ok"`; the second must show the
intended feature flags without returning secrets. Also verify a protected
account route redirects unauthenticated users, PayU callbacks reject malformed
signatures, private file downloads require organisation access, and a duplicate
checkout submission does not create a second order.

## Backup and restore drill

Before production traffic, export a logical Supabase backup using the provider
dashboard or approved CLI, store it in an access-controlled off-site location,
and record the export timestamp and migration revision. Restore it into a
separate non-production project, apply no manual schema edits, run the complete
pgTAP suite, and verify that order numbers, payment events, invoices, files,
audit rows, and RLS policies are present. Record the result and recovery time.

Repeat at least monthly during the pilot and after any schema migration that
changes orders, payments, invoices, or access control.

## Monitoring and rollback

Alert on non-2xx responses from `/api/health`, repeated failures from the
authenticated integration-health probe, failed job processor invocations,
PayU reconciliation errors, and R2/Zoho/Resend provider errors. Review the
Vercel function log, Supabase logs, PayU dashboard, R2 metrics, and provider
quotas at least daily during the pilot.

To roll back, disable the affected feature flag and redeploy. Do not treat a
legacy browser redirect or email as evidence of a verified payment. Existing
durable orders and payment events remain authoritative; resume the durable
flow before accepting business-critical volume.
