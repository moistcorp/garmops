import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import Image from 'next/image'
import Link from 'next/link'
import { caseStudies } from '@/lib/casestudies'

export const metadata: Metadata = generateMeta({
  title: 'Work',
  description: 'Case studies from Garmops — custom apparel for restaurants, events, gyms, and creative studios.',
  path: '/work',
})

export default function Work() {
  return (
    <div className="app-liquid-bg">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Case studies</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] leading-tight mb-6 tracking-tight">
          Our work
        </h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">
          A selection of projects across restaurants, events, gyms, and creative studios. Real briefs, real timelines, real results.
        </p>
      </section>

      {/* Featured — first case study */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <Link href={`/work/${caseStudies[0].slug}`} className="group block">
          <div className="liquid-glass-surface grid gap-0 overflow-hidden rounded-[28px] border transition-all duration-300 hover:!border-[var(--color-teal)]/45 md:grid-cols-2">
            {/* Image */}
            <div className="relative aspect-video md:aspect-auto bg-[var(--color-cream-soft)] flex items-center justify-center min-h-64 overflow-hidden">
              {caseStudies[0].coverImage ? (
                <Image
                  src={caseStudies[0].coverImage}
                  alt={caseStudies[0].client}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <span className="text-xs text-[#111111]/20 uppercase tracking-widest">
                  {caseStudies[0].client}
                </span>
              )}
            </div>
            {/* Content */}
            <div className="p-10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xs border border-[#ECE7DF] rounded-full px-2.5 py-1 text-[#111111]/50">
                    {caseStudies[0].industry}
                  </span>
                  <span className="text-xs text-[#111111]/30">{caseStudies[0].date}</span>
                </div>
                <h2 className="text-3xl font-bold text-[#111111] leading-tight tracking-tight mb-4 group-hover:underline">
                  {caseStudies[0].title}
                </h2>
                <p className="text-[#111111]/60 text-sm leading-relaxed mb-8">
                  {caseStudies[0].excerpt}
                </p>
                <div className="flex gap-6 text-xs text-[#111111]/40">
                  <span>{caseStudies[0].quantity} pieces</span>
                  <span>{caseStudies[0].turnaround}</span>
                  <span>{caseStudies[0].deliverables.length} deliverables</span>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-[#ECE7DF]">
                <span className="text-xs font-medium text-[var(--color-teal)] group-hover:underline">
                  Read case study
                </span>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* Grid — remaining case studies */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseStudies.slice(1).map(cs => (
            <Link
              key={cs.slug}
              href={`/work/${cs.slug}`}
              className="liquid-glass-panel group flex flex-col overflow-hidden rounded-[24px] border transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-teal)]/45"
            >
              {/* Image */}
              <div className="relative w-full aspect-video bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                {cs.coverImage ? (
                  <Image
                    src={cs.coverImage}
                    alt={cs.client}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <span className="text-xs text-[#111111]/20 uppercase tracking-widest">{cs.client}</span>
                )}
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs border border-[#ECE7DF] rounded-full px-2.5 py-1 text-[#111111]/50">
                    {cs.industry}
                  </span>
                  <span className="text-xs text-[#111111]/30">{cs.date}</span>
                </div>
                <h3 className="text-base font-semibold text-[#111111] leading-snug group-hover:underline">
                  {cs.title}
                </h3>
                <p className="text-xs text-[#111111]/50 leading-relaxed flex-1">{cs.excerpt}</p>
                <div className="flex gap-4 text-xs text-[#111111]/30 pt-3 border-t border-[#ECE7DF]">
                  <span>{cs.quantity} pcs</span>
                  <span>{cs.turnaround}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="app-liquid-section py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="liquid-glass-dark flex w-full flex-col items-start justify-between gap-6 rounded-[30px] border p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Want results like these?
            </h2>
            <p className="text-white/40 text-sm">MOQ 50 pieces. Quote within 24 hours.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/configurator"
              className="bg-white text-[var(--color-navy)] px-7 py-3.5 rounded-full text-sm font-medium hover:bg-white/90 transition whitespace-nowrap"
            >
              Start designing
            </Link>
            <Link
              href="/contact"
              className="border border-white/30 text-white px-7 py-3.5 rounded-full text-sm font-medium hover:bg-white/10 transition whitespace-nowrap"
            >
              Contact us
            </Link>
          </div>
          </div>
        </div>
      </section>
    </div>
  )
}
