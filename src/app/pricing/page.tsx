import type { Metadata } from 'next'
import { generateMeta, siteConfig } from '@/lib/seo'
import PricingClient from './PricingClient'
import JsonLd from '@/components/seo/JsonLd'
import { products } from '@/lib/products'

export const metadata: Metadata = generateMeta({
  title: 'Custom Apparel Pricing India | MOQ 50',
  description: 'Estimate bulk custom T-shirt, hoodie, polo and tote pricing in India. See starting garment price, volume discounts, GST and 18-day rush options from 50 pieces.',
  path: '/pricing',
  keywords: [
    'custom T-shirt printing price India',
    'bulk apparel pricing India',
    'custom hoodie price India',
    'custom merchandise cost',
    'MOQ 50 apparel',
  ],
})

export default function PricingPage() {
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${siteConfig.url}/pricing#service`,
        name: 'Bulk custom apparel manufacturing',
        serviceType: 'Custom apparel and branded merchandise manufacturing',
        provider: { '@id': `${siteConfig.url}/#organization` },
        areaServed: { '@type': 'Country', name: 'India' },
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Brands, companies, hospitality teams, studios, events and organisations',
        },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: Math.min(...products.map(product => product.price)),
          highPrice: Math.max(...products.map(product => product.price)),
          offerCount: products.length,
          url: `${siteConfig.url}/pricing`,
        },
      }} />
      <PricingClient />
    </>
  )
}
