import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import { caseStudies, formatCaseStudyProducts, getCaseStudyIndustry, getCaseStudyProduct } from '@/lib/casestudies'
import { absoluteUrl, generateMeta, siteConfig } from '@/lib/seo'
import { breadcrumbSchema } from '@/lib/structuredData'

export const metadata: Metadata = generateMeta({
  title: 'Garmops Case Study — Soundwave Festival Merchandise',
  description: 'A documented Garmops festival merchandise project: 300 T-shirts and canvas totes, three screen-print designs and a 22-day production timeline.',
  path: '/work',
  keywords: ['Garmops production work', 'screen print case study', 'festival merchandise India'],
})

export default function Work() {
  return (
    <main className="techpack-canvas">
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Case Study', path: '/work' }])} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${absoluteUrl('/work')}#collection`,
        name: 'Garmops case study',
        description: 'A documented custom apparel production project by Garmops.',
        isPartOf: { '@id': `${siteConfig.url}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: caseStudies.length,
          itemListElement: caseStudies.map((study, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/work/${study.slug}`),
            name: study.projectName,
          })),
        },
      }} />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
        <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Case Study' }]} />
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:pb-20">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Documented project</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-6xl">
          One project, shown with the details we have.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
          Soundwave is the current documented case study in our portfolio. Its product specification, production timeline and recorded outcome are laid out below.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        {caseStudies.map(study => {
          const industry = getCaseStudyIndustry(study.industryId)
          const projectProducts = study.products
            .map(item => getCaseStudyProduct(item.productId))
            .filter(product => product !== undefined)

          return (
            <article key={study.slug} className="techpack-panel overflow-hidden rounded-sm border lg:grid lg:grid-cols-[1.15fr_0.85fr]">
              <Link href={`/work/${study.slug}`} className="group grid grid-cols-2 gap-2 bg-(--color-cream-soft) p-2" aria-label={`View the ${study.client} project`}>
                {projectProducts.map(product => (
                  <span key={product.slug} className="relative aspect-[4/5] overflow-hidden rounded-sm bg-white lg:min-h-[500px] lg:aspect-auto">
                    <Image
                      src={product.image ?? product.icon}
                      alt={`${product.name}, a garment base in the documented ${study.client} specification`}
                      fill
                      sizes="(max-width: 1024px) 50vw, 30vw"
                      className="storefront-interactive-image object-cover"
                      preload
                    />
                    <span className="absolute inset-x-3 bottom-3 rounded-sm bg-white/90 px-3 py-2 text-center text-[11px] font-medium text-(--text-primary) backdrop-blur-sm">{product.name}</span>
                  </span>
                ))}
              </Link>

              <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-(--color-accent-dark)">{industry?.name ?? study.industryId}</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-(--text-primary) sm:text-3xl">{study.client}</h2>
                <p className="mt-2 text-sm font-medium text-(--text-primary)/75">{formatCaseStudyProducts(study)}</p>
                <p className="mt-4 text-sm leading-6 text-[#3f3f3f]">{study.summary}</p>

                <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-(--color-rule) bg-(--color-rule)">
                  <ProjectFact label="Run" value={`${study.totalQuantity ?? '—'} pcs`} />
                  <ProjectFact label="Timeline" value={study.productionTimeline ?? '—'} />
                  <ProjectFact label="Recorded sales" value="280 / 300" />
                </dl>

                {study.testimonial ? (
                  <blockquote className="mt-6 border-l-2 border-(--color-accent) pl-4 text-sm leading-6 text-(--text-primary)/75">
                    “{study.testimonial.quote}”
                    <footer className="mt-2 text-xs text-(--text-muted)">{study.testimonial.name}, {study.testimonial.role}</footer>
                  </blockquote>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-(--color-rule) pt-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--text-muted)">{study.projectDate} · {study.printTechniques.join(' · ')}</span>
                  <Link href={`/work/${study.slug}`} className="text-sm font-medium text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-4">View full project →</Link>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="techpack-section py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="techpack-dark flex flex-col gap-6 rounded-sm border p-6 text-white sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Building something similar?</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Start with a garment, then configure the colour, artwork and quantity for your own brief.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 min-[360px]:flex-row">
              <Link href="/configurator/build/boxy-fit-tee-260gsm" className="rounded-sm bg-white px-5 py-3.5 text-center text-sm font-medium text-(--color-navy) transition hover:bg-white/90">Start a similar order →</Link>
              <Link href="/industries/events" className="rounded-sm border border-white/25 px-5 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10">Explore event merchandise →</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function ProjectFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-3 sm:p-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--text-muted)">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-(--text-primary)">{value}</dd>
    </div>
  )
}
