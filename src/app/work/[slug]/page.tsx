import { caseStudies, getCaseStudy, getRelatedCaseStudies } from '@/lib/casestudies'
import { notFound } from 'next/navigation'
import WorkDetailClient from './WorkDetailClient'
import { generateMeta } from '@/lib/seo'
import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { breadcrumbSchema } from '@/lib/structuredData'

export const dynamicParams = false

export function generateStaticParams() {
  return caseStudies.map(caseStudy => ({ slug: caseStudy.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cs = getCaseStudy(slug)
  if (!cs) {
    return {
      title: 'Case Study Not Found',
      robots: { index: false, follow: false, nocache: true },
    }
  }
  return generateMeta({
    title: `${cs.client} Case Study | Garmops`,
    description: cs.summary,
    path: `/work/${cs.slug}`,
    image: cs.coverImage ?? undefined,
  })
}

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cs = getCaseStudy(slug)
  if (!cs) notFound()
  const related = getRelatedCaseStudies(cs)
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Case Studies', path: '/work' },
        { name: cs.client, path: `/work/${cs.slug}` },
      ])} />
      <WorkDetailClient cs={cs} related={related} />
    </>
  )
}
