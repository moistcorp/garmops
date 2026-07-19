import Link from 'next/link'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Journal',
  description: 'Production guides, industry insights, and notes on custom apparel from the Moist Foundry team.',
  path: '/journal',
})

const posts = [
  { slug: 'why-low-moq-matters', title: 'Why low MOQ is a game changer for small brands', excerpt: 'Most manufacturers require 500+ pieces minimum. Here is why we built Moist Foundry around 50 — and what it means for brands just getting started.', date: 'June 12, 2025', category: 'Industry', readTime: '4 min read' },
  { slug: 'screen-print-vs-dtg', title: 'Screen print vs DTG — which is right for your order?', excerpt: 'Two of the most common print techniques, but they serve very different needs. We break down when to use each one based on artwork, quantity, and budget.', date: 'May 28, 2025', category: 'Production', readTime: '5 min read' },
  { slug: 'how-to-brief-a-manufacturer', title: 'How to brief a manufacturer — what to send and what to expect', excerpt: 'A good brief saves weeks of back and forth. Here is exactly what information you need to provide to get an accurate quote and smooth production run.', date: 'May 14, 2025', category: 'Guide', readTime: '6 min read' },
  { slug: 'fabric-weight-guide', title: 'Fabric weight explained — GSM and what it means for your merch', excerpt: 'GSM stands for grams per square metre. It is the single most important spec when choosing a blank. Here is how to pick the right weight for your product.', date: 'April 30, 2025', category: 'Guide', readTime: '4 min read' },
  { slug: 'cafe-merch-guide', title: 'The cafe merch playbook — what sells and what sits on the shelf', excerpt: 'After working with dozens of cafe brands, we have a clear picture of what custom merch actually moves. Totes, yes. Lanyards, no. Here is the full breakdown.', date: 'April 15, 2025', category: 'Industry', readTime: '5 min read' },
  { slug: 'pantone-to-fabric', title: 'From Pantone to fabric — how color matching actually works', excerpt: 'Your brand color looks perfect on screen. Getting it right on fabric is a different challenge. Here is how we handle color accuracy at Moist Foundry.', date: 'April 2, 2025', category: 'Production', readTime: '3 min read' },
]

export default function Journal() {
  return (
    <>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Journal</p>
        <h1 className="text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">Notes on making things</h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">Guides, production insights, and industry notes from the Moist Foundry team.</p>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-[#111111] p-10 md:p-14 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-1">
            <span className="inline-block text-xs px-2.5 py-1 border border-white/20 text-white/60 mb-4">{posts[0].category}</span>
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight tracking-tight">{posts[0].title}</h2>
            <p className="text-white/50 leading-relaxed mb-6 max-w-lg text-sm">{posts[0].excerpt}</p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>{posts[0].date}</span>
              <span>{posts[0].readTime}</span>
            </div>
          </div>
          <Link href={`/journal/${posts[0].slug}`} className="shrink-0 bg-white text-[#111111] px-6 py-3 text-sm font-medium hover:bg-[#E5E5E5] transition self-end md:self-center">
            Read article
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E5E5E5]">
          {posts.slice(1).map(post => (
            <Link key={post.slug} href={`/journal/${post.slug}`}
              className="group bg-white p-6 flex flex-col gap-4 hover:bg-[#F7F7F7] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs border border-[#E5E5E5] px-2.5 py-1 text-[#111111]/50">{post.category}</span>
                <span className="text-xs text-[#111111]/30">{post.readTime}</span>
              </div>
              <h3 className="text-sm font-semibold text-[#111111] leading-snug group-hover:underline">{post.title}</h3>
              <p className="text-xs text-[#111111]/50 leading-relaxed flex-1">{post.excerpt}</p>
              <p className="text-xs text-[#111111]/30">{post.date}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-[#E5E5E5] py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Ready to place an order?</h2>
            <p className="text-[#111111]/50 text-sm">50 pieces minimum. Quote within 24 hours.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/configurator" className="bg-[#111111] text-white px-6 py-3 text-sm font-medium hover:bg-black transition">Start designing</Link>
            <Link href="/contact" className="border border-[#111111] text-[#111111] px-6 py-3 text-sm font-medium hover:bg-[#111111] hover:text-white transition">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  )
}
