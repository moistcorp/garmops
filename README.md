# Garmops

Garmops is a custom-apparel storefront and order configurator for small-batch
production. The application includes a sample shop, bulk-pricing calculator,
garment configurator, checkout flows, case studies, and a journal.

- Production: [www.garmops.com](https://www.garmops.com)
- Repository: [moistcorp/garmops](https://github.com/moistcorp/garmops)

## Stack

- Next.js 16 App Router and React 19
- TypeScript
- Tailwind CSS 4
- Zustand for the sample-shop cart
- PayU for payment initialization
- Resend for confirmation and contact emails

## Requirements

- Node.js 20.9 or newer
- npm (the repository includes `package-lock.json`)

## Local setup

Install exact locked dependencies:

```bash
npm ci
```

Copy the environment template and replace the placeholder values when testing
real payments or email:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run the customer app, Foundry, Medusa, PostgreSQL, Redis, and ClamAV as one
self-contained Docker deployment, keep this repository beside
`garmops-medusa` and run `./scripts/portable-up.sh` from `garmops-medusa`.
The frontend image is built as a Next.js standalone server; no host Node.js
installation is needed for that deployment.

Without PayU credentials, durable payment initialization is unavailable. Normal
CI never calls live PayU, Resend, R2, Sentry, or the malware scanner.
Optional integrations remain off until their feature flag and validated
credentials are configured.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PAYU_MERCHANT_KEY` | Server-side PayU merchant key |
| `PAYU_SALT` | Server-side PayU signing salt |
| `PAYMENT_SIGNING_SECRET` | Recommended secret for short-lived payment-result cookies; falls back to `PAYU_SALT` |
| `NEXT_PUBLIC_PAYU_BASE_URL` | PayU form endpoint; use the test endpoint during sandbox testing |
| `RESEND_API_KEY` | Server-side Resend API key |
| `RESEND_FROM_EMAIL` | Sender on a domain verified by Resend |
| `CONTACT_TO_EMAIL` | Recipient for contact enquiries and paid sample-order notifications |
| `NEXT_PUBLIC_ASSET_CDN_URL` | Public origin for immutable garment and flatlay assets; defaults to `https://assets.garmops.com` |
| `GOOGLE_SITE_VERIFICATION` | Optional Google Search Console HTML-tag verification token; DNS verification is preferred |
| `SENTRY_ENABLED` | Privacy-redacted Sentry kill switch |
| `MALWARE_SCANNING_ENABLED` | Private-file quarantine/scanner kill switch |
| `ABANDONED_DESIGN_EMAILS_ENABLED` | Consent-gated saved-design recovery kill switch |

Never expose `PAYU_SALT`, `PAYMENT_SIGNING_SECRET`, or `RESEND_API_KEY` with
a `NEXT_PUBLIC_` prefix.

## Validation

Run the checks used before shipping:

```bash
npm run lint
npm run typecheck
npm test
npm run db:test
npm run build
npm run seo:check
npm run agent:check
npm run e2e
npm run assets:verify
```

The SEO check validates the production sitemap, robots rules, canonical metadata,
index/noindex directives, and image file formats after a successful build. The
agent-readiness check validates Markdown discovery and negotiation, AI content
signals, `llms.txt`, and the integrity digest for every published Agent Skill.
GitHub Actions runs these checks, a clean local Supabase migration/test job, and Playwright. Production database backups are scheduled separately; see `docs/operations/database-restore.md`.

## Project structure

- `src/app/` — routes, metadata routes, and API route handlers
- `src/components/` — shared storefront and configurator UI
- `src/lib/` — catalog, pricing, SEO, agent-readable content, persistence, and configurator data
- `src/proxy.ts` — public-page Markdown negotiation and agent discovery headers
- `public/` — product media, crawler directives, machine-readable guides, Agent Skills, templates, and downloads

This repository uses Next.js 16. Before changing framework APIs or conventions,
read the relevant local guide in `node_modules/next/dist/docs/` as directed by
`AGENTS.md`.
