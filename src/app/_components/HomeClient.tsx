import HeroScrollVideo from '@/app/HeroScrollVideo'
import HomeFaqAccordion from '@/app/_components/HomeFaqAccordion'
import HomeMobileCta from '@/app/_components/HomeMobileCta'
import Reveal from '@/app/_components/Reveal'
import Link from 'next/link'
import Image from 'next/image'
import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from '@/lib/pricing'
import { products, type Product } from '@/lib/products'
import { industryHubCards, type IndustryHubCard } from '@/lib/industries'
import { getCaseStudy } from '@/lib/casestudies'

const workflowSteps = [
  {
    number: '01',
    title: 'Choose your garment',
    description: 'Compare fit, fabric weight and intended use before you start customising.',
  },
  {
    number: '02',
    title: 'Make it yours',
    description: 'Choose colour, add artwork and select Screen Print, DTF or Reflective Print.',
  },
  {
    number: '03',
    title: 'Add quantities & sizes',
    description: 'Build the quantity for that product and split it across its available sizes.',
  },
  {
    number: '04',
    title: 'Review your order',
    description: 'Check the specification and order details before payment and production.',
  },
]

const trustPoints = [
  'From 50 pieces',
  'Made in India',
  'Samples available',
  `${DELIVERY_DAYS}-day standard delivery`,
  'GST invoicing',
]

const featuredProductSlugs = [
  'regular-fit-tee-200gsm',
  'boxy-fit-tee-260gsm',
  'polo-280gsm',
  'regular-fit-hoodie-320gsm',
]

const featuredProducts = featuredProductSlugs
  .map(slug => products.find(product => product.slug === slug))
  .filter((product): product is Product => Boolean(product))

const featuredIndustryIds = ['companies-teams', 'cafes-hospitality', 'events-entertainment']
const featuredIndustries = featuredIndustryIds
  .map(id => industryHubCards.find(industry => industry.id === id))
  .filter((industry): industry is IndustryHubCard => Boolean(industry))

const featuredCaseStudy = getCaseStudy('soundwave-festival-merch')

const printMethods = [
  {
    name: 'Screen Print',
    index: '01',
    description: 'A strong starting point for bold artwork, solid colours and repeat bulk production.',
    bestFor: 'Logos · Typography · Larger graphics',
  },
  {
    name: 'DTF',
    index: '02',
    description: 'Useful for detailed or multi-colour artwork where screen separations are less practical.',
    bestFor: 'Detailed graphics · Multi-colour artwork',
  },
  {
    name: 'Reflective Print',
    index: '03',
    description: 'A speciality finish designed to become highly visible when direct light hits the artwork.',
    bestFor: 'Events · Statement graphics · Special effects',
  },
]

function productMeta(product: (typeof products)[number]) {
  return [product.selectorFeel, product.selectorFit ? `${product.selectorFit} fit` : null]
    .filter(Boolean)
    .join(' · ')
}

export default function HomeClient() {
  return (
    <>
      <HeroScrollVideo />

      {/* TRUST STRIP */}
      <section className="border-y border-[#E5E5E5] bg-(--color-cream-soft)/45">
        <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 md:grid-cols-5">
          {trustPoints.map((point, index) => (
            <div
              key={point}
              className={`flex min-h-16 items-center py-3 text-xs font-medium text-(--text-primary)/70 sm:min-h-[76px] sm:py-4 md:justify-center md:px-4 md:text-center ${
                index % 2 === 1 && index !== trustPoints.length - 1 ? 'border-l border-[#E5E5E5] pl-4 md:pl-4' : ''
              } ${index >= 2 ? 'border-t border-[#E5E5E5] md:border-t-0' : ''} ${index > 0 ? 'md:border-l md:border-[#E5E5E5]' : ''} ${index === trustPoints.length - 1 ? 'col-span-2 justify-center text-center md:col-span-1' : ''}`}
            >
              {point}
            </div>
          ))}
        </div>
      </section>

      {/* CUSTOMER PROOF */}
      {featuredCaseStudy && (
        <section className="techpack-section">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
            <Reveal>
              <article className="techpack-panel grid overflow-hidden rounded-sm border lg:grid-cols-[0.9fr_1.1fr]">
                <Link
                  href={`/work/${featuredCaseStudy.slug}`}
                  className="group relative min-h-[300px] overflow-hidden bg-(--color-cream-soft) sm:min-h-[520px] lg:min-h-full"
                  aria-label={`Read the ${featuredCaseStudy.client} case study`}
                >
                  <Image
                    src={featuredCaseStudy.coverImage ?? '/work/soundwave/cover.webp'}
                    alt={`${featuredCaseStudy.client} custom merchandise project`}
                    fill
                    sizes="(max-width: 1023px) 100vw, 45vw"
                    className="storefront-interactive-image object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-sm border border-white/60 bg-white/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-(--text-primary) backdrop-blur-sm">
                    Customer story
                  </span>
                </Link>

                <div className="flex flex-col p-5 sm:p-10 lg:p-12">
                  <p className="text-xs font-medium uppercase tracking-widest text-[#595959]">
                    {featuredCaseStudy.client} · Case study
                  </p>
                  <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">
                    {featuredCaseStudy.headline}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#4a4a4a]">
                    {featuredCaseStudy.summary}
                  </p>

                  <dl className="mt-6 grid grid-cols-2 border-y border-[#E5E5E5] sm:mt-8 sm:grid-cols-3">
                    <div className="border-r border-[#E5E5E5] py-5 pr-4">
                      <dt className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">Pieces</dt>
                      <dd className="mt-2 text-2xl font-semibold text-(--text-primary)">{featuredCaseStudy.totalQuantity}</dd>
                    </div>
                    <div className="py-5 pl-4 sm:border-r sm:border-[#E5E5E5] sm:px-4">
                      <dt className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">Production</dt>
                      <dd className="mt-2 text-2xl font-semibold text-(--text-primary)">{featuredCaseStudy.productionTimeline}</dd>
                    </div>
                    <div className="col-span-2 border-t border-[#E5E5E5] py-5 sm:col-span-1 sm:border-t-0 sm:pl-4">
                      <dt className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">Festival result</dt>
                      <dd className="mt-2 text-sm font-semibold leading-6 text-(--text-primary)">{featuredCaseStudy.outcomes?.[0]?.title}</dd>
                    </div>
                  </dl>

                  {featuredCaseStudy.testimonial && (
                    <blockquote className="mt-6 border-l-2 border-(--color-accent) pl-4 sm:mt-8 sm:pl-5">
                      <p className="text-base leading-7 text-(--text-primary)">“{featuredCaseStudy.testimonial.quote}”</p>
                      <footer className="mt-3 text-xs text-[#595959]">
                        {featuredCaseStudy.testimonial.name}
                        {featuredCaseStudy.testimonial.role ? `, ${featuredCaseStudy.testimonial.role}` : ''}
                      </footer>
                    </blockquote>
                  )}

                  <Link
                    href={`/work/${featuredCaseStudy.slug}`}
                    className="mt-6 w-fit rounded-sm bg-(--color-accent) px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark) sm:mt-8"
                  >
                    Read the case study →
                  </Link>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <Reveal>
            <div className="mb-7 max-w-2xl sm:mb-12">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">How Garmops works</p>
              <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">
                From garment to production in one flow.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#4a4a4a]">
                Choose the garment, position your artwork, select the print technique and allocate sizes. The approved specification then carries forward into production.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              {workflowSteps.map((step, index) => (
                <Reveal key={step.number} delay={index * 50}>
                  <div className="techpack-panel h-full rounded-sm border p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between sm:mb-8">
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--color-accent-dark)">{step.number}</span>
                      <span className="h-px w-10 bg-[#D7D7D7]" />
                    </div>
                    <h3 className="text-base font-semibold text-(--text-primary)">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">{step.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={100}>
              <div className="techpack-dark flex h-full flex-col overflow-hidden rounded-sm border p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/65">Garmops Studio</p>
                    <p className="mt-1 text-sm font-medium text-white">Build your product specification</p>
                  </div>
                  <span className="rounded-sm border border-white/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] text-white/60">01 / 04</span>
                </div>

                <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_0.9fr]">
                  <div className="relative min-h-[230px] overflow-hidden rounded-sm bg-white/95 sm:min-h-[390px]">
                    <Image
                      src="/products/boxy-fit-tee-260gsm.webp"
                      alt="Premium Oversized T-Shirt preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 40vw"
                    />
                    <div className="absolute left-3 top-3 rounded-sm border border-black/10 bg-white/90 px-3 py-2 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-widest text-[#595959]">Selected</p>
                      <p className="mt-0.5 text-xs font-semibold text-(--text-primary)">Premium Oversized T-Shirt</p>
                    </div>
                  </div>

                  <div className="hidden flex-col gap-2 sm:flex">
                    {[
                      ['Garment', 'Premium Oversized T-Shirt'],
                      ['Colour', 'Choose in Studio'],
                      ['Artwork', 'Upload & position'],
                      ['Print', 'Screen · DTF · Reflective'],
                      ['Order', 'Quantity & sizes'],
                    ].map(([label, value], index) => (
                      <div key={label} className="rounded-sm border border-white/15 bg-white/[0.04] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-white/65">{label}</p>
                          <span className="font-mono text-[11px] text-white/65">0{index + 1}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-white/80">{value}</p>
                      </div>
                    ))}
                    <Link
                      href="/products"
                      className="mt-auto rounded-sm bg-white px-4 py-3 text-center font-mono text-sm uppercase tracking-[0.05em] text-(--color-navy) transition-colors hover:bg-white/90"
                    >
                      Start with a product →
                    </Link>
                  </div>
                </div>
                <Link
                  href="/products"
                  className="mt-4 block rounded-sm bg-white px-4 py-3 text-center font-mono text-sm uppercase tracking-[0.05em] text-(--color-navy) transition-colors hover:bg-white/90 sm:hidden"
                >
                  Start with a product →
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="mt-8 border-t border-[#E5E5E5] pt-8 sm:mt-14 sm:pt-14">
            <div className="mb-6 grid gap-4 sm:mb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-12">
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Made in India</p>
                <h3 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">
                  From your approved order to production.
                </h3>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-[#4a4a4a] lg:justify-self-end">
                Production follows the garment, colour, artwork placement, print technique, quantities and sizes you approved online—giving the team one clear specification to make against.
              </p>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-sm border border-[#E5E5E5] bg-black">
              <video
                className="h-full w-full object-cover"
                src="/videos/homepage-reel.mp4"
                poster="/hero.webp"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                aria-label="Garmops apparel production showcase"
              />
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR PRODUCTS */}
      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 md:flex-row md:items-end">
            <Reveal>
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Popular starting points</p>
                <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Popular places to begin.</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4a4a4a]">Start with the garment that best matches how you want the finished apparel to feel and be used.</p>
              </div>
            </Reveal>
            <Link href="/products" className="text-sm font-medium text-(--color-accent-dark) hover:underline">View all products →</Link>
          </div>

          <div data-home-product-grid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <Reveal key={product.slug} delay={index * 50} className={index >= 2 ? 'hidden sm:block' : ''}>
                <Link
                  href={`/products/${product.slug}`}
                  className="storefront-interactive-card techpack-panel group flex h-full flex-col overflow-hidden rounded-sm border"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-(--color-cream-soft) sm:aspect-[4/5]">
                    {product.image && (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="storefront-interactive-image object-cover"
                      />
                    )}
                    <div className="absolute left-3 top-3 rounded-sm border border-white/50 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-(--text-primary) backdrop-blur-sm">
                      {product.selectorBadge}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-(--text-primary)">{product.name}</h3>
                    <p className="mt-1 text-xs text-[#595959]">{productMeta(product)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-sm border border-[#E5E5E5] px-2.5 py-1 text-[11px] text-[#595959]">{product.gsm} GSM</span>
                      <span className="rounded-sm border border-[#E5E5E5] px-2.5 py-1 text-[11px] text-[#595959]">{product.selectorMaterial}</span>
                    </div>
                    <div className="mt-auto pt-5">
                      <div className="flex items-end justify-between gap-4 border-t border-[#E5E5E5] pt-4">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">Blank garment</p>
                          <p className="mt-1 text-base font-semibold text-(--text-primary)">
                            From ₹{product.price.toLocaleString('en-IN')} / pc
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">MOQ</p>
                          <p className="mt-1 text-sm font-semibold text-(--text-primary)">{product.minimumOrderQuantity} pcs</p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs font-medium text-(--color-accent-dark)">View product →</p>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING BASICS */}
      <section className="py-10 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="techpack-dark relative flex flex-col items-stretch justify-between gap-6 overflow-hidden rounded-sm border p-5 sm:gap-8 sm:p-10 md:flex-row md:items-center md:p-14">
              <div className="relative max-w-xl">
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-white/65">Pricing</p>
                <h2 className="font-mono text-3xl font-bold tracking-tight text-white md:text-4xl">Clear pricing before production.</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Build the product and quantity first, then review how the order is priced before you commit. Standard delivery is {DELIVERY_DAYS} days, with a {RUSH_DELIVERY_DAYS}-day rush option where available.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {['From 50 pcs per custom product', 'Volume pricing', 'GST invoice'].map(item => (
                    <span key={item} className="rounded-sm border border-white/20 bg-white/10 px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.05em] text-white/85">{item}</span>
                  ))}
                </div>
              </div>
              <Link
                href="/pricing"
                className="relative shrink-0 rounded-sm bg-white px-6 py-3.5 text-center font-mono text-sm uppercase tracking-[0.05em] text-(--color-navy) transition-colors hover:bg-white/90 sm:px-8"
              >
                See how pricing works →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FEATURED INDUSTRIES */}
      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 md:flex-row md:items-end">
            <Reveal>
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Find by industry</p>
                <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Start with what you are making.</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4a4a4a]">Industry guides connect common use cases to practical garment choices before you enter the configurator.</p>
              </div>
            </Reveal>
            <Link href="/industries" className="text-sm font-medium text-(--color-accent-dark) hover:underline">Explore all industries →</Link>
          </div>

          <div data-home-industry-grid className="grid gap-5 lg:grid-cols-3">
            {featuredIndustries.map((industry, index) => (
              <Reveal key={industry.id} delay={index * 70} className={index >= 2 ? 'hidden sm:block' : ''}>
                <Link
                  href={industry.href ?? industry.contactHref ?? '/industries'}
                  className="storefront-interactive-card techpack-panel group flex h-full flex-col overflow-hidden rounded-sm border"
                >
                  <div className="relative h-[220px] overflow-hidden bg-(--color-cream-soft) sm:h-[360px]">
                    <Image
                      src={industry.image}
                      alt={industry.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="storefront-interactive-image object-cover"
                    />
                    <div className="absolute left-4 top-4 rounded-sm border border-white/60 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-(--text-primary) backdrop-blur-sm">
                      {industry.name}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4 sm:p-6">
                    <h3 className="text-xl font-semibold tracking-tight text-(--text-primary)">{industry.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#4a4a4a]">{industry.description}</p>
                    <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
                      {industry.for.slice(0, 3).map(useCase => (
                      <span key={useCase} className="rounded-sm border border-[#E5E5E5] px-2.5 py-1 text-xs text-[#595959]">{useCase}</span>
                      ))}
                    </div>
                    <p className="mt-auto pt-6 text-sm font-medium text-(--color-accent-dark)">Explore recommendations →</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRINT METHODS */}
      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <Reveal>
            <div className="mb-8 max-w-2xl sm:mb-10">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Print methods</p>
              <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Three ways to print.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4a4a4a]">Keep the technique decision simple. Garmops currently offers Screen Print, DTF and Reflective Print, with suitability depending on the garment and artwork.</p>
            </div>
          </Reveal>

          <div className="grid gap-0 md:grid-cols-3 md:gap-4">
            {printMethods.map((method, index) => (
              <Reveal key={method.name} delay={index * 60}>
                <div className="h-full border-t-2 border-(--color-rule) px-1 py-5 sm:py-8">
                  <div className="mb-5 flex items-center justify-between sm:mb-9">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--color-accent-dark)">{method.index}</span>
                    <span className="h-px w-10 bg-[#D7D7D7]" />
                  </div>
                  <h3 className="text-lg font-semibold text-(--text-primary)">{method.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4a4a4a]">{method.description}</p>
                  <div className="mt-4 border-t border-[#E5E5E5] pt-4 sm:mt-6">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-[#777777]">Good for</p>
                    <p className="mt-1.5 text-xs leading-5 text-(--text-primary)/75">{method.bestFor}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
            <Reveal>
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">FAQ</p>
                <h2 className="mb-3 text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Common questions</h2>
                <p className="text-sm leading-relaxed text-[#4a4a4a]">
                  Have a requirement that does not fit these answers? <Link href="/contact" className="underline hover:text-(--color-accent)">Get in touch</Link>.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <HomeFaqAccordion />
            </Reveal>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="homepage-final-cta" className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
          <Reveal>
            <div className="techpack-panel rounded-sm border p-5 sm:p-10 md:p-14">
              <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-2xl">
                  <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Ready to make something?</p>
                  <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Start with the garment or the use case.</h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#4a4a4a]">If you already know what you want, start designing. If you need help choosing, browse products or use the industry recommendations.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                    <Link href="/configurator" className="rounded-sm bg-(--color-accent) px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark)">Start designing</Link>
                    <Link href="/products" className="rounded-sm border border-(--text-primary)/20 px-6 py-3.5 text-center text-sm font-medium text-(--text-primary) transition-colors hover:border-(--text-primary)">Explore products</Link>
                  </div>
                  <Link href="/industries" className="text-center text-sm font-medium text-(--color-accent-dark) hover:underline">Find by industry →</Link>
                </div>
              </div>
              <div className="mt-8 border-t border-[#E5E5E5] pt-5 text-xs text-[#595959]">
                Have a specific requirement? <Link href="/contact" className="font-medium text-(--color-accent-dark) hover:underline">Contact us →</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <HomeMobileCta />
    </>
  )
}
