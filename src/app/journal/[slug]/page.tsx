import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { journalPosts } from '@/lib/journal'
import { generateMeta } from '@/lib/seo'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import { articleSchema, breadcrumbSchema, faqSchema } from '@/lib/structuredData'

export function generateStaticParams() {
  return journalPosts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = journalPosts.find(item => item.slug === slug)
  if (!post) return generateMeta({ title: 'Article Not Found' })
  return generateMeta({
    title: post.seoTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    path: `/journal/${post.slug}`,
    image: post.image,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
    authors: [post.author ?? 'Garmops Production Team'],
    keywords: post.keywords,
  })
}

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = journalPosts.find(item => item.slug === slug)
  if (!post) notFound()

  return (
    <div className="app-liquid-bg">
    <JsonLd data={articleSchema(post)} />
    <JsonLd data={breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Journal', path: '/journal' },
      { name: post.title, path: `/journal/${post.slug}` },
    ])} />
    {post.faq && <JsonLd data={faqSchema(post.faq)} />}
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-20">
      <Breadcrumbs crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Journal', href: '/journal' },
        { label: post.title },
      ]} />
      <div className="mb-8 border-b border-[#ECE7DF] pb-8 sm:mb-10 sm:pb-10">
        <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-[#111111]/45">
          <span className="liquid-glass-chip rounded-full px-3 py-1">{post.category}</span>
          <time dateTime={post.publishedAt}>{post.date}</time>
          <span aria-hidden="true">·</span>
          <span>{post.readTime}</span>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#111111] sm:text-5xl">{post.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-[#111111]/60 sm:mt-6 sm:text-lg">{post.excerpt}</p>
        <p className="mt-5 text-xs text-[#111111]/45">
          Written and reviewed by {post.author ?? 'Garmops Production Team'}
          {post.updatedAt && post.updatedAt !== post.publishedAt ? (
            <> · Updated <time dateTime={post.updatedAt}>{post.updatedAt}</time></>
          ) : null}
        </p>
      </div>
      {post.takeaways && (
        <aside className="liquid-glass-surface mb-10 rounded-3xl border p-5 sm:p-7" aria-labelledby="key-takeaways">
          <h2 id="key-takeaways" className="text-lg font-bold tracking-tight text-[#111111]">Key takeaways</h2>
          <ul className="mt-4 space-y-3">
            {post.takeaways.map(item => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-[#111111]/70">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-teal)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <div className="space-y-8 sm:space-y-10">
        {post.sections.map(section => (
          <section key={section.heading}>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-[#111111]">{section.heading}</h2>
            <div className="space-y-4">
              {section.paragraphs.map(paragraph => (
                <p key={paragraph} className="leading-7 text-[#111111]/70">{paragraph}</p>
              ))}
            </div>
            {section.bullets && (
              <ul className="mt-5 space-y-2.5">
                {section.bullets.map(item => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-[#111111]/70">
                    <span aria-hidden="true" className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-teal)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.table && (
              <div className="liquid-glass-panel mt-6 overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto" role="region" aria-label={`${section.heading} comparison table`} tabIndex={0}>
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-white/35">
                      <tr>
                        {section.table.headers.map(header => (
                          <th key={header} scope="col" className="px-4 py-3 font-semibold text-[#111111]">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/60">
                      {section.table.rows.map(row => (
                        <tr key={row.join('|')}>
                          {row.map((cell, index) => (
                            <td key={`${cell}-${index}`} className={`px-4 py-3 align-top leading-6 ${index === 0 ? 'font-medium text-[#111111]' : 'text-[#111111]/65'}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {section.links && (
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                {section.links.map(link => (
                  <Link key={link.href} href={link.href} className="text-sm font-medium text-[var(--color-teal-dark)] underline decoration-[var(--color-teal)]/30 underline-offset-4 hover:decoration-[var(--color-teal)]">
                    {link.label} →
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      {post.faq && (
        <section className="mt-12 border-t border-[#ECE7DF] pt-10 sm:mt-14" aria-labelledby="article-faq">
          <h2 id="article-faq" className="text-2xl font-bold tracking-tight text-[#111111]">Frequently asked questions</h2>
          <div className="mt-6 space-y-4">
            {post.faq.map(item => (
              <div key={item.q} className="liquid-glass-panel rounded-2xl border p-5">
                <h3 className="font-semibold leading-6 text-[#111111]">{item.q}</h3>
                <p className="mt-2 text-sm leading-6 text-[#111111]/65">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {post.relatedLinks && (
        <section className="mt-10" aria-labelledby="continue-planning">
          <h2 id="continue-planning" className="text-lg font-bold tracking-tight text-[#111111]">Continue planning your order</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {post.relatedLinks.map(link => (
              <Link key={link.href} href={link.href} className="liquid-glass-panel rounded-2xl border p-4 text-sm font-medium leading-5 text-[#111111] transition-colors hover:!border-[var(--color-teal)]/45 hover:text-[var(--color-teal-dark)]">
                {link.label} →
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="liquid-glass-surface mt-12 flex flex-col gap-4 rounded-3xl border p-5 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h2 className="font-semibold text-[#111111]">Planning a production run?</h2>
          <p className="mt-1 text-sm text-[#111111]/55">Configure your order or ask us about the right specification.</p>
        </div>
        <Link href="/contact" className="shrink-0 rounded-full bg-[var(--color-teal)] px-6 py-3 text-center text-sm font-medium text-white hover:bg-[var(--color-teal-dark)]">
          Talk to us
        </Link>
      </div>
    </article>
    </div>
  )
}
