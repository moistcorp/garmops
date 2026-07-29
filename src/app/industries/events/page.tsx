import type { Metadata } from 'next'
import SeoLandingPage from '@/components/marketing/SeoLandingPage'
import { landingPages } from '@/lib/landingPages'
import { generateMeta } from '@/lib/seo'

const content = landingPages.events

export const metadata: Metadata = generateMeta({
  title: content.seo.title,
  description: content.seo.description,
  path: `/${content.slug}`,
  image: content.seo.image,
})

export default function EventMerchandisePage() {
  return <SeoLandingPage content={content} />
}
