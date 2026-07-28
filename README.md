# Garmops

Garmops is a custom-apparel storefront and order configurator for small-batch
production. The application includes a sample shop, bulk-pricing calculator,
garment configurator, checkout flows, case studies, and a journal.

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

Install dependencies:

```bash
npm install
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

Without PayU credentials, payment initialization uses the local mock flow in
development. Without a Resend API key, email endpoints return a configuration
error.

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
| `NEXT_PUBLIC_FORMSPREE_ENDPOINT` | Optional Formspree endpoint for email capture |
| `GOOGLE_SITE_VERIFICATION` | Optional Google Search Console HTML-tag verification token; DNS verification is preferred |

Never expose `PAYU_SALT`, `PAYMENT_SIGNING_SECRET`, or `RESEND_API_KEY` with
a `NEXT_PUBLIC_` prefix.

## Validation

Run the checks used before shipping:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run seo:check
npm run agent:check
```

The SEO check validates the production sitemap, robots rules, canonical metadata,
index/noindex directives, and image file formats after a successful build. The
agent-readiness check validates Markdown discovery and negotiation, AI content
signals, `llms.txt`, and the integrity digest for every published Agent Skill.
There is currently no general automated test suite.

## Project structure

- `src/app/` — routes, metadata routes, and API route handlers
- `src/components/` — shared storefront and configurator UI
- `src/lib/` — catalog, pricing, SEO, agent-readable content, persistence, and configurator data
- `src/proxy.ts` — public-page Markdown negotiation and agent discovery headers
- `public/` — product media, crawler directives, machine-readable guides, Agent Skills, templates, and downloads

This repository uses Next.js 16. Before changing framework APIs or conventions,
read the relevant local guide in `node_modules/next/dist/docs/` as directed by
`AGENTS.md`.
