# Backend architecture

Status: Phase 0 guardrail
Selected operating mode: development and internal testing
Last reviewed: 2026-07-29

## Decision

Garmops will remain one Next.js 16 App Router application deployed on Vercel. The backend will be implemented as a modular monolith in the existing repository:

- Supabase Auth identifies customers and invite-only staff.
- Supabase PostgreSQL is the system of record and enforces tenant isolation with Row Level Security.
- Cloudflare R2 stores all public and private file bytes; PostgreSQL stores object keys, ownership, visibility, and lifecycle metadata.
- PayU collects payments, while PostgreSQL records durable attempts, verified events, and final payment state.
- Zoho Invoice creates the authoritative accounting document and legal document number.
- Resend delivers application notifications.
- PostgreSQL `integration_jobs` plus bounded Vercel Cron invocations provide durable retries.
- Cloudflare provides DNS, the public download domain, Turnstile, and edge controls.

There will be no separate backend deployment, Redis, managed queue, Supabase Storage, external search service, paid SMS/WhatsApp workflow, social login, paid monitoring dependency, or always-on Realtime in the initial release.

## Trust and ownership rules

The browser is a temporary input and guest-draft layer. It is never authoritative for:

- prices, quantities, totals, discounts, or taxes;
- order numbers, order dates, status transitions, or staff roles;
- payment success or provider event identity;
- organisation membership or file ownership;
- invoice state, number, tax configuration, or PDF identity.

The server recalculates commercial values from canonical data. Money is stored as integer paise, timestamps as UTC, and user-facing dates are rendered in `Asia/Kolkata`. Submitted designs, addresses, pricing inputs, and order items become immutable snapshots.

An order and payment attempt must exist in PostgreSQL before the browser is sent to PayU. Callback and webhook processing share one idempotent payment finalisation service, validate the PayU hash, reconcile the expected amount and transaction, and use PayU verification before marking an attempt paid. A verified payment is not rolled back when Zoho, R2, or email is unavailable.

Zoho work is enqueued only after verified payment finalisation commits. Provider creation retries must search for and adopt an existing external reference after an ambiguous timeout instead of blindly creating another document.

## Application layers

Backend code is organised into four layers:

1. Route handlers and server actions parse requests, authenticate, authorise, and map safe errors.
2. Domain services enforce order, payment, invoice, file, approval, and notification invariants.
3. Data-access modules use typed Supabase clients and explicit transaction/database functions.
4. Provider adapters isolate PayU, Zoho, R2, Resend, and Turnstile payloads.

Provider payloads do not become UI or order-domain types. Service-role and provider credentials stay in server-only modules and never receive a `NEXT_PUBLIC_` prefix.

## Existing application protection

Backend rollout is additive and gated. Every flag defaults to off in `.env.example` and in `src/lib/config/featureFlags.ts`. Public flags may control whether a link is visible, but protected server actions, route handlers, and data access repeat authentication and authorisation.

The existing `src/proxy.ts` remains the only proxy. Supabase session refresh will be composed with its Markdown negotiation in Phase 4; proxy redirects remain optimistic checks, not the final security boundary.

Existing public pages, styles, responsive behaviour, SEO, agent-readable Markdown routing, sample cart, configurator canvas, and current checkout remain unchanged until their scheduled migration phase. Any frontend modification requires the owner's explicit permission before it is made.

## File and job boundaries

Public templates will eventually be served from `downloads.garmops.com` backed by a public R2 bucket. Private objects use opaque keys scoped by environment and organisation/order, short-lived presigned URLs, exact CORS origins, validation on upload finalisation, and attachment disposition for untrusted formats. The private bucket is never public.

External work is represented by durable PostgreSQL jobs. Workers claim bounded batches with `for update skip locked`, record attempts and locks, use bounded exponential backoff, and make handlers safe for duplicate or interrupted execution. Redis is considered only after measured lock contention, retry latency, or throughput demonstrates a real need.

## Production gates

Development uses local Supabase where possible and Free/shared non-production services. Commercial production requires Vercel Pro. Before live orders, the owner must explicitly choose:

- a controlled Supabase Free pilot with encrypted off-site logical dumps, a completed restore drill, monitoring, and accepted recovery risk; or
- Supabase Pro with managed daily backups and seven-day retention.

Provider plans, quotas, credentials, tax IDs, Zoho document mode, R2 access, callback URLs, CORS, WAF rules, and backup restoration must be verified in the relevant provider account before their feature flag is enabled.
