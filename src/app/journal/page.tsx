import Link from 'next/link'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import { journalPosts as posts } from '@/lib/journal'

export const metadata: Metadata = generateMeta({
  title: 'Journal',
  description: 'Production guides, industry insights, and notes on custom apparel from the Garmops team.',
  path: '/journal',
})

export default function Journal() {
  return (
    <div className="app-liquid-bg">
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Journal</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">Notes on making things</h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">Guides, production insights, and industry notes from the Garmops team.</p>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="liquid-glass-dark flex flex-col items-start gap-8 rounded-3xl border p-10 md:flex-row md:p-14">
          <div className="flex-1">
            <span className="inline-block text-xs px-2.5 py-1 border border-white/20 text-white/60 mb-4">{posts[0].category}</span>
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight tracking-tight">{posts[0].title}</h2>
            <p className="text-white/50 leading-relaxed mb-6 max-w-lg text-sm">{posts[0].excerpt}</p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>{posts[0].date}</span>
              <span>{posts[0].readTime}</span>
            </div>
          </div>
          <Link href={`/journal/${posts[0].slug}`} className="shrink-0 bg-white text-[var(--color-navy)] px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition self-end md:self-center">
            Read article
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.slice(1).map(post => (
            <Link key={post.slug} href={`/journal/${post.slug}`}
              className="liquid-glass-panel group flex flex-col gap-4 rounded-[24px] border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-teal)]/45">
              <div className="flex items-center justify-between">
                <span className="text-xs border border-[#ECE7DF] rounded-full px-2.5 py-1 text-[#111111]/50">{post.category}</span>
                <span className="text-xs text-[#111111]/30">{post.readTime}</span>
              </div>
              <h3 className="text-sm font-semibold text-[#111111] leading-snug group-hover:underline">{post.title}</h3>
              <p className="text-xs text-[#111111]/50 leading-relaxed flex-1">{post.excerpt}</p>
              <p className="text-xs text-[#111111]/30">{post.date}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="app-liquid-section py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Ready to place an order?</h2>
            <p className="text-[#111111]/50 text-sm">50 pieces minimum. Quote within 24 hours.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/configurator" className="bg-[var(--color-teal)] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition">Start designing</Link>
            <Link href="/contact" className="border border-[var(--color-teal)] text-[var(--color-teal)] px-6 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal)] hover:text-white transition">Contact us</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
