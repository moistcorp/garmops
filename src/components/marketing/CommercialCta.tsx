import Link from 'next/link'
import type { SeoLandingPageContent } from '@/lib/landingPages'

export default function CommercialCta({ content }: { content: SeoLandingPageContent }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="techpack-dark relative overflow-hidden rounded-sm border p-6 text-white sm:p-10 lg:p-14">
        <div className="relative max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{content.cta.title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">{content.cta.description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={content.cta.primary.href}
              className="rounded-sm bg-white px-6 py-3.5 text-center font-mono text-xs uppercase tracking-[0.05em] text-(--color-navy) transition-colors hover:bg-white/90"
            >
              {content.cta.primary.label}
            </Link>
            {content.cta.secondary && (
              <Link
                href={content.cta.secondary.href}
                className="rounded-sm border border-white/30 bg-white/5 px-6 py-3.5 text-center font-mono text-xs uppercase tracking-[0.05em] text-white transition-colors hover:bg-white/10"
              >
                {content.cta.secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
