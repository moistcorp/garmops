import LandingTrackedLink from './LandingTrackedLink'
import type { SeoLandingPageContent } from '@/lib/landingPages'

export default function CommercialCta({ content }: { content: SeoLandingPageContent }) {
  const path = `/${content.slug}`

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="liquid-glass-dark relative overflow-hidden rounded-[28px] border p-6 text-white sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--color-teal)]/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{content.cta.title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">{content.cta.description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LandingTrackedLink
              href={content.cta.primary.href}
              page={path}
              event="seo_landing_cta_click"
              label="primary_footer"
              className="rounded-full bg-white px-6 py-3.5 text-center text-sm font-medium text-[var(--color-navy)] transition-colors hover:bg-white/90"
            >
              {content.cta.primary.label}
            </LandingTrackedLink>
            {content.cta.secondary && (
              <LandingTrackedLink
                href={content.cta.secondary.href}
                page={path}
                event="seo_landing_cta_click"
                label="secondary_footer"
                className="rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                {content.cta.secondary.label}
              </LandingTrackedLink>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
