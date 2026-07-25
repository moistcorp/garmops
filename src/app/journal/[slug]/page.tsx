import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { journalPosts } from '@/lib/journal'
import { generateMeta } from '@/lib/seo'
import Breadcrumbs from '@/components/ui/Breadcrumbs'

export function generateStaticParams() {
  return journalPosts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = journalPosts.find(item => item.slug === slug)
  if (!post) return generateMeta({ title: 'Article Not Found' })
  return generateMeta({
    title: post.title,
    description: post.excerpt,
    path: `/journal/${post.slug}`,
  })
}

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = journalPosts.find(item => item.slug === slug)
  if (!post) notFound()

  return (
    <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 sm:pt-20">
      <Breadcrumbs crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Journal', href: '/journal' },
        { label: post.title },
      ]} />
      <div className="mb-10 border-b border-[#ECE7DF] pb-10">
        <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-[#111111]/45">
          <span className="rounded-full border border-[#ECE7DF] px-3 py-1">{post.category}</span>
          <time>{post.date}</time>
          <span aria-hidden="true">·</span>
          <span>{post.readTime}</span>
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#111111] sm:text-5xl">{post.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-[#111111]/60">{post.excerpt}</p>
      </div>
      <div className="space-y-10">
        {post.sections.map(section => (
          <section key={section.heading}>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-[#111111]">{section.heading}</h2>
            <div className="space-y-4">
              {section.paragraphs.map(paragraph => (
                <p key={paragraph} className="leading-7 text-[#111111]/70">{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-14 flex flex-col gap-4 rounded-3xl bg-[var(--color-cream)] p-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#111111]">Planning a production run?</h2>
          <p className="mt-1 text-sm text-[#111111]/55">Configure your order or ask us about the right specification.</p>
        </div>
        <Link href="/contact" className="shrink-0 rounded-full bg-[var(--color-teal)] px-6 py-3 text-center text-sm font-medium text-white hover:bg-[var(--color-teal-dark)]">
          Talk to us
        </Link>
      </div>
    </article>
  )
}
