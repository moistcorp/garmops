import { caseStudies } from '@/lib/casestudies'
import { notFound } from 'next/navigation'
import WorkDetailClient from './WorkDetailClient'
import { generateMeta } from '@/lib/seo'
import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { breadcrumbSchema } from '@/lib/structuredData'

export function generateStaticParams() {
  return caseStudies.map(caseStudy => ({ slug: caseStudy.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cs = caseStudies.find(c => c.slug === slug)
  if (!cs) return generateMeta({ title: 'Case Study Not Found' })
  return generateMeta({
    title: `${cs.client} — ${cs.title}`,
    description: cs.excerpt,
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
  const cs = caseStudies.find(c => c.slug === slug)
  if (!cs) notFound()
  const related = caseStudies.filter(c => c.slug !== cs.slug).slice(0, 2)
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Work', path: '/work' },
        { name: cs.client, path: `/work/${cs.slug}` },
      ])} />
      <WorkDetailClient cs={cs} related={related} />
    </>
  )
}
