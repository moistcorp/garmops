# Garmops production runbook

## Architecture

Customer and Foundry are separate Vercel deployments (`www.garmops.com`, `foundry.garmops.com`) backed by Supabase. Cloudflare provides DNS and separate public/private R2 buckets. PayU handles payment, Resend email, optional PostHog product analytics, optional Sentry monitoring, an external uptime monitor, and an optional private ClamAV scanner complete the system.

## Deploy checklist

- Run CI, migration reset/tests, E2E, asset equivalence and production build.
- Set the correct `APP_SURFACE`, public surface, app/customer/staff URLs and feature flags independently on both Vercel projects.
- Apply forward Supabase migrations before enabling dependent flags; verify RLS and cron secrets.
- Verify private/public R2 bucket names, CORS and least-privilege keys.
- Confirm PayU test/live hosts and credentials match; smoke-test success, failure, pending and duplicate callbacks without logging payloads.
- Confirm Resend domains, job cron, authenticated integration health, invoice generation, OTP and private-file access.

Protect `main` with the CI application, database and E2E jobs required before merge.

## Rollback and kill switches

Roll back the Vercel deployment first. Database migrations are forward-only: use a reviewed compensating migration, never rewrite applied history. Disable durable checkout, PostHog, Sentry, abandoned recovery, production capacity or malware scanning independently. Disabling optional observability must not stop checkout.

## Incidents

- PayU pending/stuck: inspect authenticated health and reconciliation freshness, correlate by request ID, verify with PayU, and never create a duplicate attempt while pending.
- Callback/webhook error: verify signature/origin configuration and event idempotency; do not paste raw payloads into tickets.
- Paid order/invoice delayed: inspect `integration_jobs`, retry the idempotent invoice job, then verify the immutable paid totals.
- R2 inaccessible: verify private-bucket credentials/object metadata; never make the private bucket public.
- OTP failure: check Supabase Auth and email delivery/rate limits without exposing tokens.
- Worker stale: verify cron authorization, latest `system_job_runs`, queued/failed jobs, then invoke the authenticated worker once.
- Scanner unavailable: downloads fail closed while scanning is enabled. Restore the private scanner or disable scanning only by an owner-approved incident decision; quarantined originals remain in R2.
- Foundry unavailable: roll back the staff Vercel deployment; customer ordering is a separate surface.
- Analytics outage: no checkout action is required; analytics is non-essential and fail-open.

Configure Better Stack or an equivalent monitor against `/api/health` for public liveness and `/api/internal/integration-health` with `Authorization: Bearer <CRON_SECRET>` for dependencies. Alert on non-2xx and preserve the returned request/correlation context.

## Secrets and rotation

Rotate Vercel/Supabase, R2, PayU, Resend, Turnstile, cron, PostHog, Sentry, scanner and GitHub backup credentials in their owning dashboards and both relevant Vercel deployments. Use overlap where supported, test, revoke the old credential, and record the rotation date. Never place values in source, logs, analytics, Sentry tags, or incident notes.
