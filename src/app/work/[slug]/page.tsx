import { caseStudies } from '@/lib/casestudies'
import { notFound } from 'next/navigation'
import WorkDetailClient from './WorkDetailClient'
import { generateMeta } from '@/lib/seo'
import type { Metadata } from 'next'

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
  return <WorkDetailClient cs={cs} related={related} />
}
