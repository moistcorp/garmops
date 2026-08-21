import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import { industryHubCards } from '@/lib/industries'
import { products } from '@/lib/products'
import { breadcrumbSchema } from '@/lib/structuredData'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Industries | Branded Apparel by Use Case | Garmops',
  description: 'Find the right branded apparel for companies, cafés, hospitality, events, sports, creative teams and arts organisations.',
  path: '/industries',
  image: '/industries/companies-startups.webp',
})

export default function IndustriesPage() {
  return (
    <main className="techpack-canvas">
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Industries', path: '/industries' }])} />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
        <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Industries' }]} />
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-20">
        <div className="max-w-4xl">
          <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Industries</p>
          <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-5xl lg:text-6xl">
            Merchandise made for how you’ll actually use it.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
            Whether you’re outfitting a team, running an event or building merchandise for customers, start with your use case. We’ll help you narrow the garment before you enter the configurator.
          </p>
          <div className="mt-7 flex flex-col gap-3 min-[360px]:flex-row">
            <a href="#industry-options" className="rounded-sm bg-(--color-accent) px-6 py-3.5 text-center text-sm font-medium text-white">Choose your industry</a>
            <Link href="/products" className="rounded-sm border border-(--color-rule) px-6 py-3.5 text-center text-sm font-medium text-(--text-primary)">Browse garments</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {['From 50 pieces', 'Samples available', '35-day standard delivery'].map(point => <span key={point} className="rounded-sm border border-(--color-rule) bg-white px-3 py-1.5 text-xs text-(--text-muted)">{point}</span>)}
          </div>
        </div>
      </section>

      <section id="industry-options" className="techpack-section scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Choose your industry</p>
            <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Choose the situation closest to your order.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
              Each guide turns a business need into practical garment, artwork and quantity starting points.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {industryHubCards.map(card => {
              const actionHref = card.href ?? card.contactHref ?? '/contact'
              const actionLabel = card.href ? `Explore ${card.name}` : 'Discuss this requirement'

              return (
                <article id={card.id} key={card.id} className="techpack-panel scroll-mt-24 overflow-hidden rounded-sm border">
                  <Link href={actionHref} className="relative block aspect-[16/10] overflow-hidden bg-(--color-cream-soft) sm:aspect-[4/3]" aria-label={`Open the ${card.name} industry guide`}>
                    <Image
                      src={card.image}
                      alt={card.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="storefront-interactive-image object-cover"
                    />
                    <span className="absolute left-3 top-3 rounded-sm border border-white/60 bg-white/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-widest text-(--text-primary)">Industry guide</span>
                  </Link>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-xl font-semibold text-(--text-primary)"><Link href={actionHref}>{card.name}</Link></h3>
                    <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{card.description}</p>

                    <div className="mt-5 border-t border-(--color-rule) pt-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--text-muted)">For</p>
                      <p className="mt-2 text-sm leading-6 text-(--text-primary)/70">{card.for.slice(0, 2).join(' · ')}<span className="hidden sm:inline"> · {card.for.slice(2).join(' · ')}</span></p>
                    </div>

                    <div className="mt-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--text-muted)">Popular products</p>
                      <div className="mt-2 flex flex-wrap gap-2">{card.popularProducts.map(name => { const product = products.find(item => item.name === name); return product ? <Link key={name} href={`/products/${product.slug}`} className="rounded-sm border border-(--color-rule) px-2.5 py-1 text-xs text-(--text-primary)/70 hover:border-(--color-accent)">{name}</Link> : null })}</div>
                    </div>

                    <Link
                      href={actionHref}
                      className="mt-5 inline-flex text-sm font-medium text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-4 hover:decoration-current"
                    >
                      {actionLabel} guide →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="techpack-dark rounded-sm border p-6 text-white sm:p-10 lg:p-14">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Already know which garment you want?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              Skip the industry guidance and compare the full product catalogue by fit, feel and intended use.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/configurator" className="rounded-sm bg-white px-6 py-3.5 text-center font-mono text-xs uppercase tracking-[0.05em] text-(--color-navy)">
                Start designing
              </Link>
              <Link href="/products" className="rounded-sm border border-white/30 bg-white/5 px-6 py-3.5 text-center font-mono text-xs uppercase tracking-[0.05em] text-white">
                Browse products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
