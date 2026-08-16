import Image from 'next/image'
import Link from 'next/link'
import type { SeoLandingPageContent } from '@/lib/landingPages'

export default function LandingHero({ content }: { content: SeoLandingPageContent }) {
  return (
    <header className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-20">
      <div className="max-w-3xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-(--text-muted)">
          {content.eyebrow}
        </p>
        <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-5xl lg:text-6xl">
          {content.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
          {content.lead}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={content.cta.primary.href}
            className="rounded-sm bg-(--color-accent) px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark)"
          >
            {content.cta.primary.label}
          </Link>
          {content.cta.secondary && (
            <Link
              href={content.cta.secondary.href}
              className="techpack-control rounded-sm border px-6 py-3.5 text-center text-sm font-medium text-(--text-primary) transition-colors hover:!border-(--color-accent) hover:text-(--color-accent-dark)"
            >
              {content.cta.secondary.label}
            </Link>
          )}
        </div>
      </div>

      {content.heroImage && (
        <div className="techpack-surface relative aspect-[4/3] overflow-hidden rounded-sm border sm:rounded-sm lg:aspect-[5/6]">
          <Image
            src={content.heroImage}
            alt={content.heroImageAlt ?? content.title}
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="object-cover"
          />
        </div>
      )}
    </header>
  )
}
