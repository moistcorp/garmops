import Link from 'next/link'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import { journalPosts as posts } from '@/lib/journal'

export const metadata: Metadata = generateMeta({
  title: 'Custom Apparel & Merchandise Guides',
  description: 'Practical guides to bulk custom T-shirt printing, apparel manufacturing, print methods, low MOQs and corporate merchandise in India.',
  path: '/journal',
  keywords: [
    'custom apparel guides',
    'bulk T-shirt printing India',
    'custom merchandise India',
    'apparel manufacturing guide',
  ],
})

export default function Journal() {
  return (
    <div className="techpack-canvas">
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Guides</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] max-w-2xl leading-tight mb-6 tracking-tight">Custom apparel &amp; merchandise guides</h1>
        <p className="max-w-2xl text-base leading-relaxed text-[#111111]/50 sm:text-lg">Clear, production-led answers about bulk T-shirt printing, garment specifications, decoration methods, pricing, MOQs and planning branded merchandise in India.</p>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="techpack-dark flex flex-col items-stretch gap-7 rounded-[4px] border p-6 sm:rounded-[4px] sm:p-10 md:flex-row md:items-start md:p-14">
          <div className="flex-1">
            <span className="inline-block text-xs px-2.5 py-1 border border-white/20 text-white/60 mb-4">{posts[0].category}</span>
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight tracking-tight">{posts[0].title}</h2>
            <p className="text-white/50 leading-relaxed mb-6 max-w-lg text-sm">{posts[0].excerpt}</p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <time dateTime={posts[0].publishedAt}>{posts[0].date}</time>
              <span>{posts[0].readTime}</span>
            </div>
          </div>
          <Link href={`/journal/${posts[0].slug}`} className="shrink-0 self-stretch rounded-[4px] bg-white px-6 py-3 text-center text-sm font-medium text-[var(--color-navy)] transition hover:bg-white/90 sm:self-end md:self-center">
            Read article
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.slice(1).map(post => (
            <Link key={post.slug} href={`/journal/${post.slug}`}
              className="techpack-panel group flex flex-col gap-4 rounded-[4px] border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-accent)]/45">
              <div className="flex items-center justify-between">
                <span className="text-xs border border-[#ECE7DF] rounded-[4px] px-2.5 py-1 text-[#111111]/50">{post.category}</span>
                <span className="text-xs text-[#111111]/30">{post.readTime}</span>
              </div>
              <h3 className="text-sm font-semibold text-[#111111] leading-snug group-hover:underline">{post.title}</h3>
              <p className="text-xs text-[#111111]/50 leading-relaxed flex-1">{post.excerpt}</p>
              <time dateTime={post.publishedAt} className="text-xs text-[#111111]/30">{post.date}</time>
            </Link>
          ))}
        </div>
      </section>

      <section className="techpack-section py-12 sm:py-16">
        <div className="max-w-7xl mx-auto flex flex-col items-stretch justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Ready to place an order?</h2>
            <p className="text-[#111111]/50 text-sm">50 pieces minimum. Quote within 24 hours.</p>
          </div>
          <div className="flex flex-col gap-3 min-[360px]:flex-row">
            <Link href="/configurator" className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-accent-dark)]">Start designing</Link>
            <Link href="/contact" className="rounded-[4px] border border-[var(--color-accent)] px-6 py-3 text-center text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white">Contact us</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
