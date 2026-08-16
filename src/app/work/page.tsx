import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { caseStudies, formatCaseStudyProducts, getCaseStudyIndustry } from '@/lib/casestudies'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Made with Garmops — Apparel Production Work',
  description: 'A documented Garmops Screen Print project, showing the garments, production configuration and finished project record.',
  path: '/work',
  keywords: ['Garmops production work', 'Screen Print case study', 'festival merchandise India'],
})

function ProjectImage({
  src,
  alt,
  sizes,
  className = 'object-cover',
}: {
  src: string | null
  alt: string
  sizes: string
  className?: string
}) {
  if (!src) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center bg-(--color-cream-soft)">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-(--text-muted)">Image unavailable</span>
      </div>
    )
  }

  return <Image src={src} alt={alt} fill sizes={sizes} className={className} preload />
}

export default function Work() {
  return (
    <main className="techpack-canvas">
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-20 lg:pb-20">
        <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Case Studies</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-6xl">
          Made with Garmops.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
          Real apparel projects, from the original brief through artwork, production and delivery.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-6">
          {caseStudies.map(study => {
            const industry = getCaseStudyIndustry(study.industryId)

            return (
              <Link
                key={study.slug}
                href={`/work/${study.slug}`}
                className="storefront-interactive-card techpack-panel group flex flex-col overflow-hidden rounded-sm border lg:grid lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-(--color-cream-soft) lg:aspect-auto lg:min-h-[520px]">
                  <ProjectImage
                    src={study.coverImage}
                    alt={study.gallery?.[0]?.alt ?? `${study.client} project image`}
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="storefront-interactive-image object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-center p-5 sm:p-8 lg:p-10">
                  {industry?.href ? (
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-(--color-accent-dark)">{industry.name}</span>
                  ) : (
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-(--text-muted)">{industry?.name ?? study.industryId}</span>
                  )}
                  <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-(--text-primary) group-hover:underline sm:text-3xl">
                    {study.client}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-(--text-primary)/75">{formatCaseStudyProducts(study)}</p>
                  <p className="mt-3 text-sm leading-6 text-[#3f3f3f]">{study.summary}</p>

                  <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-(--color-rule) pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-muted)">
                    <span>{study.printTechniques.join(' · ')}</span>
                    {study.totalQuantity ? <span>{study.totalQuantity} pieces</span> : null}
                  </div>
                  <span className="mt-6 text-sm font-medium text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-4">
                    View project →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="techpack-section py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="techpack-dark flex flex-col gap-6 rounded-sm border p-6 text-white sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Building something similar?</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                Start with the product, then configure your artwork, colour and quantity. Current print methods are Screen Print, DTF and Reflective Print.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 min-[360px]:flex-row">
              <Link
                href="/configurator/build/boxy-fit-tee-260gsm"
                className="rounded-sm bg-white px-5 py-3.5 text-center text-sm font-medium text-(--color-navy) transition hover:bg-white/90"
              >
                Customise this T-Shirt →
              </Link>
              <Link
                href="/industries/events"
                className="rounded-sm border border-white/25 px-5 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10"
              >
                Explore Events &amp; Entertainment →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
