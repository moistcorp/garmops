import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, CircleHelp, PackageCheck, Truck } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import { products } from '@/lib/products'
import { generateMeta, siteConfig } from '@/lib/seo'
import { breadcrumbSchema } from '@/lib/structuredData'
import PricingClient from './PricingClient'

export const metadata: Metadata = generateMeta({
  title: 'Custom Apparel Pricing India | MOQ 50',
  description: 'Estimate blank garment costs for bulk custom T-shirts, hoodies, polos and totes in India. Compare volume discounts, GST and rush production from 50 pieces.',
  path: '/pricing',
  keywords: ['custom T-shirt printing price India', 'bulk apparel pricing India', 'custom hoodie price India', 'custom merchandise cost', 'MOQ 50 apparel'],
})

const priceFactors = [
  { Icon: PackageCheck, title: 'Garment', description: 'Fabric weight, fit and product determine the catalogue starting price.' },
  { Icon: Check, title: 'Artwork', description: 'Screen Print, DTF or Reflective Print is priced when you choose the technique and placement.' },
  { Icon: CircleHelp, title: 'Custom details', description: 'Custom dye, back artwork and a custom label update the configured price before checkout.' },
  { Icon: Truck, title: 'Delivery & shipping', description: 'Rush production is +₹75 per unit before GST. Shipping is free.' },
]

export default function PricingPage() {
  return (
    <main className="techpack-canvas">
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }])} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${siteConfig.url}/pricing#service`,
        name: 'Bulk custom apparel manufacturing',
        serviceType: 'Custom apparel and branded merchandise manufacturing',
        provider: { '@id': `${siteConfig.url}/#organization` },
        areaServed: { '@type': 'Country', name: 'India' },
        audience: { '@type': 'BusinessAudience', audienceType: 'Brands, companies, hospitality teams, studios, events and organisations' },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: Math.min(...products.map(product => product.price)),
          highPrice: Math.max(...products.map(product => product.price)),
          offerCount: products.length,
          url: `${siteConfig.url}/pricing`,
        },
      }} />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
        <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Pricing' }]} />
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-(--color-accent)">Pricing, made practical</p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-(--text-primary) sm:text-5xl lg:text-6xl">See the garment math before you design.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-(--text-primary)/65 sm:text-lg sm:leading-8">Start with the blank garment, quantity and timeline. Then carry those choices into Studio, where artwork and custom options produce the configured total.</p>
          </div>
          <div className="techpack-panel rounded-sm border p-5 text-sm leading-6 text-(--text-primary)/65">
            <p className="font-semibold text-(--text-primary)">What this estimate includes</p>
            <p className="mt-2">Blank garment, volume pricing, optional rush production, GST and free shipping.</p>
            <p className="mt-3 border-t border-(--color-rule) pt-3"><strong className="text-(--text-primary)">Added in Studio:</strong> custom dye, artwork technique and placement, back print and custom neck label.</p>
          </div>
        </div>
      </section>

      <PricingClient />

      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-(--color-accent)">What changes your price</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">No hidden production assumptions.</h2><p className="mt-4 text-sm leading-7 text-(--text-primary)/60 sm:text-base">The calculator starts simple. Studio makes each production choice visible before checkout.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {priceFactors.map(({ Icon, title, description }) => <article key={title} className="techpack-panel rounded-sm border p-5"><Icon size={18} className="text-(--color-accent)" /><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-(--text-primary)/60">{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-(--color-navy)">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 text-white sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/65">Ready when your brief is</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Build the exact order next.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Choose the garment, colour, artwork and size split. You will see the configured total before payment.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row"><Link href="/configurator" className="rounded-sm bg-white px-6 py-3.5 text-center text-sm font-semibold text-(--color-navy) transition hover:bg-[#F4F1EB]">Start designing</Link><Link href="/products" className="rounded-sm border border-white/25 px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-white/10">Browse products</Link></div>
        </div>
      </section>
    </main>
  )
}
