# Dead-code audit

## Removed

- `src/app/_components/EmailCapture.tsx`: no static/dynamic import or route/content reference; the Formspree-only environment variable is no longer part of active application behavior.
- `src/components/home/HomepageCaseStudies.tsx`: no static/dynamic import; current homepage owns its customer-facing sections elsewhere.
- Unsupported-technique guide discovery and redirect: the article was already filtered out of published journal data; stale machine-readable promotion and redirect were removed.
- Shipping-payment customer component, staff actions/forms and PayU initiation branch: superseded by canonical free shipping.

## Retained

- `HomeClient`, `Reveal`, and `WhyGarmops`: statically imported by active homepage code.
- Current product and garment assets: referenced by the catalogue/configurator or renderer signal manifest.
- Legacy Supabase migration history: retained because applied migrations are immutable; forward migrations remove the active behavior.

## Uncertain

- Hidden OS `.DS_Store` files have no application imports but are left untouched by this code change; they can be removed in a separate repository-hygiene change.
