# Phase 4 implementation report

Date: 2026-07-29  
Scope: Supabase SSR authentication, verified customer onboarding, invite-only staff access, authenticator MFA, protected portal shells, Turnstile, and durable auth abuse controls.

## Outcome

Phase 4 is implemented across the database, server security boundary, proxy, and explicitly authorized frontend routes.

The rollout remains isolated to the existing Supabase Free Development project and Vercel Development variables. No Preview or Production Supabase database, auth flag, Turnstile test key, staff identity, or customer identity was created.

## Supabase client boundaries

The application now has four explicit Supabase contexts:

- `src/lib/supabase/client.ts`: publishable-key browser client;
- `src/lib/supabase/server.ts`: request-scoped cookie client for Server Components, Server Actions, and Route Handlers;
- `src/lib/supabase/proxy.ts`: session refresh that propagates cookies and no-cache headers;
- `src/lib/supabase/admin.ts`: server-only secret-key client with persistence and URL session detection disabled.

The service/secret key is never imported by a Client Component or exposed with a `NEXT_PUBLIC_` name.

## Next.js 16 proxy composition

`src/proxy.ts` remains the sole proxy.

The existing agent-readable behavior is preserved:

- `Accept: text/markdown` still rewrites eligible public routes to the Markdown handler;
- `Content-Signal`, `Vary`, and alternate/discovery `Link` headers remain intact;
- non-GET/HEAD requests are not subjected to Markdown negotiation;
- Supabase refresh is composed into normal application requests;
- unauthenticated `/account` and `/staff` requests receive optimistic login redirects;
- final authorization is still repeated in pages, data access, and Server Actions.

Runtime validation returned:

- `/login`: `200`;
- unauthenticated `/account`: `307` to `/login?next=%2Faccount`;
- unauthenticated `/staff`: `307` to `/login?next=%2Fstaff`;
- `/about` with Markdown accept header: `200`, `text/markdown`, and the original `Content-Signal`;
- `/about` as HTML: `200` with the alternate Markdown link.

## Customer authentication and onboarding

Implemented routes:

- `/login`;
- `/register`;
- `/verify-email`;
- `/forgot-password`;
- `/reset-password`;
- `/auth/callback`;
- `/auth/error`;
- server-side logout action.

The flow supports email and password only. Social login, phone OTP, passkeys, SAML, paid SMS, and magic-link login were not added.

Public auth actions:

- validate with Zod;
- apply salted durable limits before provider calls;
- verify Cloudflare Turnstile server-side;
- use generic responses where email/account enumeration would otherwise be possible;
- constrain redirects to local paths;
- perform authorization again inside each action.

Registration captures the required identity, company, phone, and legal acceptance fields. Email verification is required before onboarding. The `complete_customer_onboarding` RPC atomically creates or completes:

- the profile;
- recorded terms and privacy versions;
- one organization;
- an active owner membership for the first registrant;
- an audit record.

The RPC is idempotent when the user already has an active organization membership.

## Staff invitation and MFA

Staff is invite-only.

Only an active `super_admin` session at AAL2 can provision or deactivate staff. The invitation action:

1. generates a Supabase invite token with the server-only admin client;
2. creates an inactive staff record with an authoritative role and team;
3. sends a custom time-limited token-hash link through the existing verified Resend sender;
4. compensates by deleting the generated auth identity if provisioning or delivery fails.

The custom token-hash callback avoids relying on URL-fragment sessions, which server-side auth routes cannot read.

Invited staff must:

1. accept the invitation;
2. set a password;
3. enroll a TOTP authenticator;
4. verify the six-digit code and reach AAL2;
5. activate the previously inactive staff record.

Active staff with an enrolled factor are sent through `/staff/mfa/challenge`. Phone MFA is disabled. Staff permission helpers still fail closed below AAL2, even if a user bypasses the UI.

Invitation, activation, and deactivation operations are audited. Self-deactivation and self role escalation are rejected. Deactivation immediately makes the database staff predicate fail.

## Protected portal shells

The authorized frontend work added Garmops-styled, responsive shells rather than a generic dashboard.

Customer shell paths:

- `/account`;
- `/account/orders`;
- `/account/designs`;
- `/account/documents`;
- `/account/company`;
- `/account/notifications`;
- `/account/settings/profile`;
- `/account/settings/security`.

Staff shell paths:

- `/staff`;
- `/staff/orders`;
- `/staff/customers`;
- `/staff/invoices`;
- `/staff/files`;
- `/staff/audit`;
- `/staff/settings/team`;
- `/staff/settings/security`.

The team page includes invitation and deactivation tooling. Operational data widgets remain placeholders until their scheduled backend phases; no fake customer or order data is shown.

All account, staff, auth, and API responses are no-indexed. Account and staff responses are private/no-store. The public site chrome is replaced only for configurator, auth, account, and staff routes. The account entry appears in public navigation only when the customer account flag is enabled.

## Abuse controls

Phase 4 uses three layers:

1. Cloudflare Turnstile Free verification on enabled registration, login, password recovery, verification resend, and contact submission;
2. `auth_rate_limits`, a forced-RLS, service-only PostgreSQL fixed-window limiter keyed by salted HMAC subjects;
3. one Vercel WAF fixed-window rule, scoped to `/login`, `/register`, `/forgot-password`, `/verify-email`, and `/api/send-confirmation`, limited to 30 requests per 60 seconds per IP with deny on excess.

The contact form keeps its previous in-process limit while the customer account rollout flag is disabled, preventing an unconfigured Production Turnstile widget from breaking the current public form. When accounts are enabled, the contact route requires both durable limiting and successful Turnstile verification.

The CSP now allows only the configured exact Supabase origin plus Cloudflare's documented Turnstile origin. No wildcard Supabase origin was added.

Vercel currently documents one rate-limit rule and 1,000,000 included allowed requests for Hobby, with usage above the included allowance metered. The rule is intentionally narrow to keep that exposure bounded and should be monitored in the Firewall dashboard.

## Database migration and verification

Migration:

- `20260729143000_auth_onboarding_and_rate_limits.sql`.

It adds:

- profile legal acceptance columns and consistency checks;
- forced-RLS `auth_rate_limits`;
- service-only `consume_auth_rate_limit`;
- verified `complete_customer_onboarding`;
- MFA-gated `provision_staff_invitation`;
- AAL2-only `activate_invited_staff`;
- audited `deactivate_staff_member`;
- AAL2-only `record_staff_login`.

`supabase/tests/04_auth_onboarding.sql` adds 34 Phase 4 assertions. Together with Phases 1–3, the suite now has 276 passing assertions.

Hosted Development verification:

- migration history contains `20260729143000`;
- the new table has RLS enabled and forced;
- all six reviewed functions exist;
- anonymous execution grants across the six functions: zero;
- hosted profiles: zero;
- hosted organizations: zero;
- hosted staff members: zero.

The local deterministic seed was not copied.

## Environment and external state

Added environment contract names:

- `SUPABASE_SECRET_KEY`, with the legacy service-role key accepted as a server-only fallback;
- `AUTH_RATE_LIMIT_SALT`;
- existing Turnstile and Resend values are now required when their auth/staff surfaces are enabled.

Vercel Development now contains:

- a generated rate-limit salt;
- Cloudflare's official always-pass Development test site and verification keys;
- enabled customer-account and staff-portal flags;
- the existing Resend API key and verified sender for invitation delivery.

The official test keys are intentionally restricted to Development and must never be copied to Preview or Production.

Local email templates are checked in under `supabase/templates/` for confirmation, recovery, and invitation testing. Hosted staff invitations do not depend on a hosted template because the application sends the token-hash link itself.

The permission-restricted temporary Vercel environment file and HTTP validation artifacts were deleted after use. The secret file deletion is intentional and not recoverable. Existing `.env.local` values were neither printed nor changed.

## Validation

| Check | Result |
| --- | --- |
| Clean local database rebuild | Passed |
| Supabase pgTAP | Passed; 4 files, 276 assertions |
| Supabase schema lint | Passed; no warnings |
| Generated database types | Passed |
| TypeScript | Passed |
| ESLint | Passed |
| Vitest | Passed; 2 files, 7 tests |
| Next.js production build | Passed; 62 pages |
| SEO readiness | Passed |
| Agent readiness | Passed; Markdown proxy preserved |
| Hosted migration dry-run | Exactly one Phase 4 migration; no seed or roles |
| Hosted migration apply | Passed |
| Hosted catalog/data verification | Passed |
| Runtime route/proxy/CSP checks | Passed |
| Vercel WAF rule | Published and verified |

The first sandboxed production build failed because Turbopack could not bind its internal worker port. The approved unrestricted rerun passed; this was an execution sandbox restriction, not an application failure.

## Rollout boundary

- Development uses official Turnstile test keys. A real Cloudflare Turnstile widget and approved redirect URLs are required before enabling accounts in Preview or Production.
- Preview and Production account/staff flags remain disabled.
- Production operational data integrations remain scheduled for later phases.
- R2 private file handling belongs to Phase 5.
- The explicit frontend permission granted for Phase 4 does not automatically carry into later phases.
