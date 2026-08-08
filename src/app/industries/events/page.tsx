import type { Metadata } from 'next'
import IndustryLandingPage from '@/components/marketing/IndustryLandingPage'
import { industryPages } from '@/lib/industries'
import { generateMeta } from '@/lib/seo'

const content = industryPages.events

export const metadata: Metadata = generateMeta({
  title: content.seo.title,
  description: content.seo.description,
  path: `/${content.slug}`,
  image: content.seo.image,
})

export default function EventMerchandisePage() {
  return <IndustryLandingPage content={content} />
}
