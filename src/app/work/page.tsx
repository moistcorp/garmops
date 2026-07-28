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
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Case studies</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] leading-tight mb-6 tracking-tight">
          Our work
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-[#111111]/50 sm:text-lg">
          A selection of projects across restaurants, events, gyms, and creative studios. Real briefs, real timelines, real results.
        </p>
      </section>

      {/* Featured — first case study */}
      <section className="max-w-7xl mx-auto px-4 pb-12 sm:px-6 sm:pb-16">
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
            <div className="flex flex-col justify-between p-5 sm:p-8 md:p-10">
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-6">
                  <span className="text-xs border border-[#ECE7DF] rounded-full px-2.5 py-1 text-[#111111]/50">
                    {caseStudies[0].industry}
                  </span>
                  <span className="text-xs text-[#111111]/30">{caseStudies[0].date}</span>
                </div>
                <h2 className="mb-4 text-2xl font-bold leading-tight tracking-tight text-[#111111] group-hover:underline sm:text-3xl">
                  {caseStudies[0].title}
                </h2>
                <p className="text-[#111111]/60 text-sm leading-relaxed mb-8">
                  {caseStudies[0].excerpt}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#111111]/40">
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
      <section className="max-w-7xl mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
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
      <section className="app-liquid-section py-12 sm:py-16">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
          <div className="liquid-glass-dark flex w-full flex-col items-stretch justify-between gap-6 rounded-[26px] border p-6 sm:rounded-[30px] sm:p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Want results like these?
            </h2>
            <p className="text-white/40 text-sm">MOQ 50 pieces. Quote within 24 hours.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 min-[360px]:flex-row">
            <Link
              href="/configurator"
              className="rounded-full bg-white px-6 py-3.5 text-center text-sm font-medium text-[var(--color-navy)] transition hover:bg-white/90 sm:px-7"
            >
              Start designing
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/30 px-6 py-3.5 text-center text-sm font-medium text-white transition hover:bg-white/10 sm:px-7"
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
