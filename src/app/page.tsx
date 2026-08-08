import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import HomeClient from './_components/HomeClient'
import JsonLd from '@/components/seo/JsonLd'
import { faqSchema, organizationSchema, websiteSchema } from '@/lib/structuredData'
import { homeFaqs } from '@/lib/homeContent'

export const metadata: Metadata = {
  ...generateMeta({
    title: 'Custom Apparel & Bulk Merchandise India',
    description: 'Choose a garment, add your artwork and build custom T-shirts, hoodies, polos and merchandise online. Made in India with custom production from 50 pieces per product configuration.',
    path: '/',
    keywords: [
      'custom apparel manufacturer India',
      'bulk custom merchandise India',
      'custom T-shirt printing India',
      'branded apparel for businesses',
      'low MOQ custom clothing India',
    ],
  }),
  title: { absolute: 'Custom Apparel & Bulk Merchandise India | Garmops' },
}

export default function Home() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <JsonLd data={faqSchema(homeFaqs.map(item => ({ ...item })))} />
      <HomeClient />
    </>
  )
}
