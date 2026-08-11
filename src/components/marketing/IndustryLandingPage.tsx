import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import ProofLinks from '@/components/marketing/ProofLinks'
import IndustryPrintTechniques from '@/components/marketing/IndustryPrintTechniques'
import { caseStudies, matchesCaseStudyIndustry } from '@/lib/casestudies'
import type { IndustryPageContent } from '@/lib/industries'
import { products, productFabricFeel, productFitLabel, productImageAlt } from '@/lib/products'
import { breadcrumbSchema, faqSchema, productItemListSchema, serviceSchema } from '@/lib/structuredData'

const processSteps = [
  {
    title: 'Choose your garment',
    description: 'Compare the fit, fabric feel and intended use before deciding which product should carry the artwork.',
  },
  {
    title: 'Add your artwork',
    description: 'Choose the garment colour, upload the approved artwork and define the print position and physical size.',
  },
  {
    title: 'Add quantities & sizes',
    description: 'Allocate the order across the available sizes for that exact product and confirm the total quantity.',
  },
  {
    title: 'Review & produce',
    description: 'Review the final specification and artwork before the order moves into production.',
  },
]

function ProductMiniLink({ slug }: { slug: string }) {
  const product = products.find(item => item.slug === slug)
  if (!product) return null

  return (
    <Link
      href={`/products/${product.slug}`}
      className="inline-flex rounded-sm border border-(--color-rule) bg-white px-3 py-2 text-xs font-medium text-(--text-primary) transition-colors hover:border-(--color-accent) hover:text-(--color-accent-dark)"
    >
      {product.name}
    </Link>
  )
}

export default function IndustryLandingPage({ content }: { content: IndustryPageContent }) {
  const path = `/${content.slug}`
  const recommendedProducts = content.recommendations.flatMap(item => {
    const product = products.find(candidate => candidate.slug === item.slug)
    return product ? [{ ...item, product }] : []
  })
  const relevantCaseStudies = content.proofIndustries
    ? caseStudies.filter(study => content.proofIndustries?.some(industry => matchesCaseStudyIndustry(study, industry))).slice(0, 2)
    : []
  const breadcrumbItems = [
    { name: 'Home', path: '/' },
    { name: 'Industries', path: '/industries' },
    { name: content.breadcrumbLabel, path },
  ]

  return (
    <article className="techpack-canvas">
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />
      <JsonLd
        data={serviceSchema({
          id: 'service',
          name: content.title,
          description: content.seo.description,
          path,
          serviceType: content.serviceType,
          audience: content.audience,
          image: content.seo.image,
        })}
      />
      {recommendedProducts.length > 0 && (
        <JsonLd data={productItemListSchema('Recommended products', path, recommendedProducts.map(item => item.product))} />
      )}
      <JsonLd data={faqSchema(content.faqs.map(item => ({ q: item.question, a: item.answer })))} />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: 'Industries', href: '/industries' },
            { label: content.breadcrumbLabel },
          ]}
        />
      </div>

      <header className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.06fr_0.94fr] lg:gap-14 lg:pb-20">
        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">
            {content.eyebrow}
          </p>
          <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-5xl lg:text-6xl">
            {content.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">{content.lead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#recommended-products"
              className="rounded-sm bg-(--color-accent) px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark)"
            >
              Explore recommended products
            </a>
            <Link
              href="/configurator"
              className="techpack-control rounded-sm border px-6 py-3.5 text-center text-sm font-medium text-(--text-primary) transition-colors hover:!border-(--color-accent) hover:text-(--color-accent-dark)"
            >
              Start designing
            </Link>
          </div>
        </div>

        <div className="techpack-surface relative aspect-[4/3] overflow-hidden rounded-sm border lg:aspect-[5/6]">
          <Image
            src={content.heroImage}
            alt={content.heroImageAlt}
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="object-cover"
          />
        </div>
      </header>

      <section aria-label="Order facts" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="techpack-surface grid overflow-hidden rounded-sm border sm:grid-cols-2 lg:grid-cols-3">
          {content.trustPoints.map(point => (
            <p
              key={point}
              className="border-b border-white/70 px-5 py-4 text-sm font-medium text-(--text-primary)/65 last:border-b-0 sm:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
            >
              {point}
            </p>
          ))}
        </div>
      </section>

      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">
              Start with the job
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">What are you making?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
              Pick the use case first. The product recommendations below are starting points, not rigid rules.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {content.useCases.map(useCase => (
              <article key={useCase.title} className="techpack-panel rounded-sm border p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-(--text-primary)">{useCase.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{useCase.description}</p>
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-primary)/45">
                  Recommended starting points
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {useCase.productSlugs.map(slug => <ProductMiniLink key={slug} slug={slug} />)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="recommended-products" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">Products</p>
          <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Recommended starting points</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
            These garments cover the most common needs for this industry. Open a product to check its size chart, material and full specification before customising it.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recommendedProducts.map(({ product, reason }) => (
            <Link
              key={product.slug}
              href={`/products/${product.slug}`}
              className="techpack-panel group flex min-w-0 flex-col overflow-hidden rounded-sm border transition-transform hover:-translate-y-0.5 hover:!border-(--color-accent)/45"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-(--color-cream-soft)">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={productImageAlt(product)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold leading-snug text-(--text-primary) group-hover:underline">{product.name}</h3>
                <p className="mt-1 text-xs font-medium text-(--text-primary)/55">
                  {productFabricFeel(product)} · {productFitLabel(product)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-sm bg-(--color-cream-soft) px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-(--text-primary)/55">
                    {product.gsm} GSM
                  </span>
                  <span className="rounded-sm bg-(--color-cream-soft) px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-(--text-primary)/55">
                    {product.selectorMaterial}
                  </span>
                </div>
                <p className="mt-4 flex-1 text-sm leading-6 text-[#3f3f3f]">{reason}</p>
                <span className="mt-5 border-t border-(--color-rule) pt-4 text-sm font-medium text-(--color-accent-dark)">
                  View product →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {relevantCaseStudies.length > 0 && (
        <div className="techpack-section">
          <ProofLinks caseStudies={relevantCaseStudies} />
        </div>
      )}

      <IndustryPrintTechniques introduction={content.printIntro} notes={content.printNotes} />

      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">How it works</p>
            <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">From garment to production</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
              The same four-step flow applies across industries so the product, artwork and quantities stay connected.
            </p>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, index) => (
              <li key={step.title} className="techpack-panel rounded-sm border p-5 sm:p-6">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-(--color-accent-dark)">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-base font-semibold text-(--text-primary)">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">Planning</p>
          <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">{content.planningTitle}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">{content.planningIntroduction}</p>
        </div>

        <details className="techpack-panel mt-8 rounded-sm border">
          <summary className="cursor-pointer list-none px-5 py-5 text-sm font-semibold text-(--text-primary) sm:px-6">
            Planning & order notes <span className="ml-2 text-(--text-primary)/40">+</span>
          </summary>
          <div className="grid gap-px border-t border-(--color-rule) bg-(--color-rule) sm:grid-cols-2">
            {content.planningNotes.map(note => (
              <div key={note.title} className="bg-(--color-cream) p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-(--text-primary)">{note.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{note.description}</p>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-primary)/45">FAQ</p>
            <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Common questions before you start</h2>
          </div>
          <div className="mt-8 grid gap-3">
            {content.faqs.map(faq => (
              <details key={faq.question} className="techpack-panel rounded-sm border">
                <summary className="cursor-pointer list-none px-5 py-5 text-sm font-semibold leading-6 text-(--text-primary) sm:px-6">
                  {faq.question} <span className="ml-2 text-(--text-primary)/40">+</span>
                </summary>
                <p className="border-t border-(--color-rule) px-5 py-5 text-sm leading-6 text-[#3f3f3f] sm:px-6">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap gap-x-6 gap-y-3 border-y border-(--color-rule) py-5">
          {content.relatedLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-4 hover:decoration-current"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="techpack-dark overflow-hidden rounded-sm border p-6 text-white sm:p-10 lg:p-14">
          <div className="max-w-3xl">
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
    </article>
  )
}
