import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { products } from '@/lib/products'
import ProductSelector from './ProductSelector'
import type { Metadata } from 'next'
import { absoluteUrl, generateMeta, siteConfig } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { getCaseStudy } from '@/lib/casestudies'
import { breadcrumbSchema } from '@/lib/structuredData'

export const metadata: Metadata = generateMeta({
  title: 'Custom Apparel Products & Samples',
  description: 'Compare and order samples of custom-ready T-shirts, hoodies, sweatshirts, polos and canvas totes made by Garmops in India.',
  path: '/products',
  keywords: [
    'custom T-shirts India',
    'custom hoodies India',
    'bulk polo T-shirts',
    'heavyweight T-shirt manufacturer India',
    'custom apparel samples',
  ],
})

export default function Products() {
  const featuredStudy = getCaseStudy('soundwave-festival-merch')
  const featuredProducts = featuredStudy?.products
    .map(item => products.find(product => product.slug === item.productId))
    .filter(product => product !== undefined)
    .slice(0, 2) ?? []
  return (
    <div className="techpack-canvas">
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Products', path: '/products' }])} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${absoluteUrl('/products')}#collection`,
        name: 'Garmops custom apparel products',
        description: 'Custom-ready garments and sample products manufactured by Garmops in India.',
        isPartOf: { '@id': `${siteConfig.url}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: products.length,
          itemListElement: products.map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/products/${product.slug}`),
            name: product.name,
          })),
        },
      }} />
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8"><Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Products' }]} /></div>
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-14">
        <p className="text-xs text-(--text-muted) font-medium mb-4 tracking-widest uppercase">Garmops</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-(--text-primary) leading-tight mb-4 tracking-tight">Custom apparel products</h1>
        <p className="max-w-lg text-base leading-relaxed text-(--text-muted) sm:text-lg">
          Compare T-shirts, hoodies, sweatshirts, polos and totes, then order a sample before placing a bulk custom run. All pieces are manufactured in India.
        </p>
      </section>

    
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24"><div className="h-96 animate-pulse rounded-sm border border-(--color-rule) bg-(--color-cream-soft)" /></div>}>
        <ProductSelector products={products} />
      </Suspense>

      {featuredStudy ? (
        <section className="techpack-section">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-(--text-muted)">See a finished programme</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">From garment bases to event merchandise.</h2>
              <p className="mt-4 text-sm leading-7 text-(--text-primary)/65">Soundwave used an oversized T-shirt and canvas tote across a 300-piece festival merchandise run.</p>
              <Link href={`/work/${featuredStudy.slug}`} className="mt-6 inline-flex rounded-sm bg-(--color-accent) px-5 py-3 text-sm font-medium text-white">Read the case study →</Link>
            </div>
            <Link href={`/work/${featuredStudy.slug}`} className="grid grid-cols-2 gap-2" aria-label="Read the Soundwave Festival case study">
              {featuredProducts.map(product => (
                <span key={product.slug} className="relative aspect-[4/5] overflow-hidden rounded-sm border border-(--color-rule) bg-(--color-cream-soft)">
                  <Image src={product.image ?? product.icon} alt={`${product.name}, one of the garment bases in the Soundwave specification`} fill sizes="(max-width: 1024px) 50vw, 28vw" className="object-cover" />
                  <span className="absolute inset-x-2 bottom-2 rounded-sm bg-white/90 px-2 py-1 text-center text-[11px] font-medium text-(--text-primary) backdrop-blur-sm">{product.name}</span>
                </span>
              ))}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="techpack-section py-12 sm:py-16">
        <div className="max-w-7xl mx-auto flex flex-col items-stretch justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div className="text-left">
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Ready to customise one of these garments?</h2>
            <p className="text-(--text-muted) text-sm">Choose a base garment, then add artwork, colour and quantities from 50 pieces.</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/configurator" className="w-full rounded-sm bg-(--color-accent) px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-(--color-accent-dark) md:w-auto">Start designing</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
