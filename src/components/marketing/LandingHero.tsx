import Image from 'next/image'
import LandingTrackedLink from './LandingTrackedLink'
import type { SeoLandingPageContent } from '@/lib/landingPages'

export default function LandingHero({ content }: { content: SeoLandingPageContent }) {
  const path = `/${content.slug}`

  return (
    <header className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-20">
      <div className="max-w-3xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-[#111111]/45">
          {content.eyebrow}
        </p>
        <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-tight text-[#111111] sm:text-5xl lg:text-6xl">
          {content.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
          {content.lead}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LandingTrackedLink
            href={content.cta.primary.href}
            page={path}
            event="seo_landing_cta_click"
            label="primary"
            className="rounded-full bg-[var(--color-teal)] px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-teal-dark)]"
          >
            {content.cta.primary.label}
          </LandingTrackedLink>
          {content.cta.secondary && (
            <LandingTrackedLink
              href={content.cta.secondary.href}
              page={path}
              event="seo_landing_cta_click"
              label="secondary"
              className="liquid-glass-control rounded-full border px-6 py-3.5 text-center text-sm font-medium text-[#111111] transition-colors hover:!border-[var(--color-teal)] hover:text-[var(--color-teal-dark)]"
            >
              {content.cta.secondary.label}
            </LandingTrackedLink>
          )}
        </div>
      </div>

      {content.heroImage && (
        <div className="liquid-glass-surface relative aspect-[4/3] overflow-hidden rounded-[28px] border sm:rounded-[34px] lg:aspect-[5/6]">
          <Image
            src={content.heroImage}
            alt={content.heroImageAlt ?? content.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="object-cover"
          />
        </div>
      )}
    </header>
  )
}
