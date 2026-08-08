import Link from 'next/link'
import { products } from '@/lib/products'
import ProductSelector from './ProductSelector'
import type { Metadata } from 'next'
import { absoluteUrl, generateMeta, siteConfig } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'

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
  return (
    <div className="techpack-canvas">
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
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-20">
        <p className="text-xs text-[var(--text-primary)]/40 font-medium mb-4 tracking-widest uppercase">Garmops</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] leading-tight mb-4 tracking-tight">Custom apparel products</h1>
        <p className="max-w-lg text-base leading-relaxed text-[var(--text-primary)]/50 sm:text-lg">
          Compare T-shirts, hoodies, sweatshirts, polos and totes, then order a sample before placing a bulk custom run. All pieces are manufactured in India.
        </p>
      </section>

    
      <ProductSelector products={products} />

      <section className="techpack-section py-12 sm:py-16">
        <div className="max-w-7xl mx-auto flex flex-col items-stretch justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div className="text-left">
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Want merch like this for your brand?</h2>
            <p className="text-[var(--text-primary)]/50 text-sm">Custom apparel for brands, cafes, and companies. MOQ 50 pieces.</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/configurator" className="w-full rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-accent-dark)] md:w-auto">Start designing</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
