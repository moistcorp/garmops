'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  type CaseStudy,
  formatCaseStudyProducts,
  getCaseStudyIndustry,
  getCaseStudyProduct,
  getCaseStudyProductSpecs,
} from '@/lib/casestudies'
import Breadcrumbs from '@/components/ui/Breadcrumbs'

function FieldGrid({ fields }: { fields: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {fields.map(field => (
        <div key={`${field.label}-${field.value}`}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-(--text-muted)">{field.label}</dt>
          <dd className="mt-1 text-sm leading-6 text-(--text-primary)">{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProjectFacts({ study }: { study: CaseStudy }) {
  const facts = [
    study.totalQuantity ? { label: 'Total order', value: `${study.totalQuantity} pcs` } : null,
    study.products.length ? { label: 'Products', value: String(study.products.length) } : null,
    study.printTechniques.length ? { label: 'Print method', value: study.printTechniques.join(' · ') } : null,
    study.productionTimeline ? { label: 'Production timeline', value: study.productionTimeline } : null,
    study.artworkCount ? { label: 'Artworks', value: String(study.artworkCount) } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact)).slice(0, 5)

  return (
    <dl className="grid grid-cols-2 border-y border-(--color-rule) sm:grid-cols-4 lg:grid-cols-5">
      {facts.map(fact => (
        <div key={fact.label} className="border-b border-(--color-rule) px-4 py-4 first:pl-0 sm:border-b-0 sm:border-r last:border-r-0 lg:px-5 lg:first:pl-0">
          <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-(--text-muted)">{fact.label}</dt>
          <dd className="mt-2 text-sm font-semibold leading-5 text-(--text-primary)">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProductSpecification({ productRecord }: { productRecord: CaseStudy['products'][number] }) {
  const product = getCaseStudyProduct(productRecord.productId)
  if (!product) return null

  const specs = [
    { label: 'Colour', value: productRecord.colour },
    { label: 'Print', value: productRecord.printTechniques?.join(' · ') },
    { label: 'Artwork', value: productRecord.artwork },
    { label: 'Quantity', value: productRecord.quantity ? `${productRecord.quantity} pieces` : undefined },
    { label: 'Sizes', value: productRecord.sizeRange },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value))

  return (
    <article className="techpack-panel rounded-sm border p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-(--text-primary)">{product.name}</h3>
          <p className="mt-2 text-sm text-(--text-primary)/60">{getCaseStudyProductSpecs(product.slug).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link
            href={`/products/${product.slug}`}
            className="rounded-sm border border-(--color-rule) px-3 py-2 text-xs font-medium text-(--text-primary) transition hover:border-(--color-accent) hover:text-(--color-accent-dark)"
          >
            View product
          </Link>
          <Link
            href={`/configurator/build/${product.slug}`}
            className="rounded-sm bg-(--color-accent) px-3 py-2 text-xs font-medium text-white transition hover:bg-(--color-accent-dark)"
          >
            Customise product
          </Link>
        </div>
      </div>

      {specs.length > 0 && (
        <dl className="mt-6 grid gap-x-5 gap-y-4 border-t border-(--color-rule) pt-5 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map(spec => (
            <div key={spec.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-muted)">{spec.label}</dt>
              <dd className="mt-1 text-sm leading-6 text-(--text-primary)">{spec.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

export default function WorkDetailClient({
  cs,
  related,
}: {
  cs: CaseStudy
  related: CaseStudy[]
}) {
  const industry = getCaseStudyIndustry(cs.industryId)
  const heroAlt = cs.gallery?.[0]?.alt ?? `${cs.client} project image`

  return (
    <main className="techpack-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: 'Case Studies', href: '/work' },
            { label: cs.client },
          ]}
        />

        <header className="mt-10 max-w-4xl sm:mt-16">
          {industry?.href ? (
            <Link href={industry.href} className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-4">
              {industry.name}
            </Link>
          ) : (
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">{industry?.name ?? cs.industryId}</p>
          )}
          <p className="mt-5 text-sm font-medium text-(--text-muted)">{cs.client}</p>
          <h1 className="mt-2 text-4xl font-bold leading-[1.05] tracking-tight text-(--text-primary) sm:text-6xl">{cs.headline}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">{cs.summary}</p>
        </header>

        <div className="mt-10 sm:mt-14">
          <ProjectFacts study={cs} />
        </div>

        <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-sm bg-(--color-cream-soft) sm:mt-10 sm:aspect-[16/8]">
          {cs.coverImage ? <Image src={cs.coverImage} alt={heroAlt} fill priority sizes="(max-width: 768px) 100vw, 1200px" className="object-cover" /> : null}
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-20 lg:mt-24">
          <div className="min-w-0">
            <section aria-labelledby="brief-heading">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">01 / Context</p>
              <h2 id="brief-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">The brief</h2>
              <div className="mt-7 rounded-sm border border-(--color-rule) p-5 sm:p-7">
                <FieldGrid fields={cs.brief} />
              </div>
            </section>

            <section aria-labelledby="made-heading" className="mt-16 sm:mt-24">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">02 / Production</p>
              <h2 id="made-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">What we made</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f]">{formatCaseStudyProducts(cs)} configured around the stored project brief.</p>
              <div className="mt-7 grid gap-5">
                {cs.products.map(productRecord => (
                  <ProductSpecification key={productRecord.productId} productRecord={productRecord} />
                ))}
              </div>
            </section>

            {cs.configuration && cs.configuration.length > 0 && (
              <section aria-labelledby="configuration-heading" className="mt-16 sm:mt-24">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">03 / Order specification</p>
                <h2 id="configuration-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Project configuration</h2>
                <div className="mt-7 rounded-sm bg-(--color-cream-soft) p-5 sm:p-7">
                  <FieldGrid fields={cs.configuration} />
                </div>
              </section>
            )}

            {cs.gallery && cs.gallery.length > 1 && (
              <section aria-labelledby="process-heading" className="mt-16 sm:mt-24">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">04 / Visual record</p>
                <h2 id="process-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">From artwork to finished garment</h2>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  {cs.gallery.map(image => (
                    <figure key={image.src} className="overflow-hidden rounded-sm border border-(--color-rule)">
                      <div className="relative aspect-[4/3] bg-(--color-cream-soft)">
                        <Image src={image.src} alt={image.alt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                      </div>
                      {image.caption ? <figcaption className="p-4 text-xs leading-5 text-(--text-muted)">{image.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {cs.outcomes && cs.outcomes.length > 0 && (
              <section aria-labelledby="outcome-heading" className="mt-16 sm:mt-24">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">05 / Record</p>
                <h2 id="outcome-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Outcome</h2>
                <div className="mt-7 divide-y divide-(--color-rule) border-y border-(--color-rule)">
                  {cs.outcomes.map(outcome => (
                    <article key={outcome.title} className="py-5 sm:py-6">
                      <h3 className="text-base font-semibold text-(--text-primary)">{outcome.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{outcome.description}</p>
                      {outcome.sourceNote ? <p className="mt-2 text-xs leading-5 text-(--text-muted)">{outcome.sourceNote}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {cs.testimonial && (
              <section aria-labelledby="quote-heading" className="mt-16 border-t border-(--color-rule) pt-10 sm:mt-24 sm:pt-12">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Client comment</p>
                <h2 id="quote-heading" className="sr-only">Client comment</h2>
                <blockquote className="mt-5 max-w-3xl text-2xl font-semibold leading-snug tracking-tight text-(--text-primary) sm:text-3xl">“{cs.testimonial.quote}”</blockquote>
                <p className="mt-6 text-sm font-semibold text-(--text-primary)">{cs.testimonial.name}</p>
                {cs.testimonial.role || cs.testimonial.company ? (
                  <p className="mt-1 text-xs text-(--text-muted)">{[cs.testimonial.role, cs.testimonial.company].filter(Boolean).join(' · ')}</p>
                ) : null}
              </section>
            )}
          </div>

          <aside className="lg:pt-1">
            <div className="techpack-dark rounded-sm border p-6 text-white sm:p-7 lg:sticky lg:top-24">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/65">Building something similar?</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Start with the same garment.</h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Choose the product, then configure your artwork, colour and quantity with the current Garmops print methods.
              </p>
              <div className="mt-6 grid gap-3">
                {cs.products[0] ? (
                  <Link href={`/configurator/build/${cs.products[0].productId}`} className="rounded-sm bg-white px-4 py-3 text-center text-sm font-medium text-(--color-navy) transition hover:bg-white/90">
                    Customise {getCaseStudyProduct(cs.products[0].productId)?.name ?? 'this product'} →
                  </Link>
                ) : null}
                {industry?.href ? (
                  <Link href={industry.href} className="rounded-sm border border-white/25 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10">
                    Explore {industry.name} →
                  </Link>
                ) : (
                  <Link href="/products" className="rounded-sm border border-white/25 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10">
                    Explore products →
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="techpack-section py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Related work</p>
            <h2 id="related-heading" className="mt-3 text-3xl font-bold tracking-tight text-(--text-primary)">More production work</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {related.map(item => (
                <Link key={item.slug} href={`/work/${item.slug}`} className="techpack-panel rounded-sm border p-5 transition-colors hover:!border-(--color-accent)/55 sm:p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-(--text-muted)">{getCaseStudyIndustry(item.industryId)?.name ?? item.industryId}</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight text-(--text-primary)">{item.client}</h3>
                  <p className="mt-2 text-sm text-(--text-primary)/60">{formatCaseStudyProducts(item)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
