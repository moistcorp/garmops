'use client'
import Image from 'next/image'
import Link from 'next/link'
import { CaseStudy } from '@/lib/casestudies'
import Breadcrumbs from '@/components/ui/Breadcrumbs'

export default function WorkDetailClient({
  cs,
  related,
}: {
  cs: CaseStudy
  related: CaseStudy[]
}) {
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <Breadcrumbs crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Work', href: '/work' },
          { label: cs.client },
        ]} />

        <div className="grid lg:grid-cols-3 gap-16">

          {/* Main content */}
          <div className="lg:col-span-2">

            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs border border-[#ECE7DF] rounded-full px-2.5 py-1 text-[#111111]/50">
                  {cs.industry}
                </span>
                <span className="text-xs text-[#111111]/30">{cs.date}</span>
              </div>
              <h1 className="text-4xl font-bold text-[#111111] leading-tight tracking-tight mb-4">
                {cs.title}
              </h1>
              <p className="text-lg text-[#111111]/60 leading-relaxed">{cs.excerpt}</p>
            </div>

            {/* Cover image */}
            <div className="relative w-full aspect-video bg-[var(--color-cream-soft)] rounded-2xl flex items-center justify-center mb-12 overflow-hidden">
              {cs.coverImage ? (
                <Image src={cs.coverImage} alt={cs.client} fill sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
              ) : (
                <span className="text-xs text-[#111111]/20 uppercase tracking-widest">{cs.client}</span>
              )}
            </div>

            {/* Challenge */}
            <div className="mb-10">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                The challenge
              </p>
              <p className="text-[#111111]/70 leading-relaxed text-sm">{cs.challenge}</p>
            </div>

            {/* Solution */}
            <div className="mb-10">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                Our approach
              </p>
              <p className="text-[#111111]/70 leading-relaxed text-sm">{cs.solution}</p>
            </div>

            {/* Result */}
            <div className="mb-12 bg-[var(--color-cream)] border border-[#ECE7DF] rounded-2xl p-8 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                The result
              </p>
              <p className="text-[#111111] leading-relaxed text-sm font-medium">{cs.result}</p>
            </div>

            {/* Sections */}
            {cs.sections.map((section, i) => (
              <div key={i} className="mb-12">
                <h2 className="text-xl font-bold text-[#111111] mb-4 tracking-tight">
                  {section.heading}
                </h2>
                <p className="text-[#111111]/60 leading-relaxed text-sm">{section.body}</p>
                {section.image && (
                  <div className="relative mt-6 w-full aspect-video bg-[var(--color-cream-soft)] rounded-2xl overflow-hidden">
                    <Image src={section.image} alt={section.heading} fill sizes="(max-width: 1024px) 100vw, 66vw" className="object-cover" />
                  </div>
                )}
              </div>
            ))}

            {/* Testimonial */}
            {cs.testimonial && (
              <div className="bg-[var(--color-cream)] rounded-3xl border border-[#ECE7DF] p-8 mb-12 shadow-[0_8px_30px_rgba(22,33,43,0.06)]">
                <p className="text-2xl text-[#111111] leading-snug mb-6 font-semibold tracking-tight">
                  &ldquo;{cs.testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-teal)] text-sm font-semibold text-white">
                    {cs.testimonial.author.split(' ').map(part => part[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">{cs.testimonial.author}</p>
                    <p className="text-xs text-[#111111]/50">{cs.testimonial.role}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6 lg:pt-20">

            {/* Project details */}
            <div className="border border-[#ECE7DF] rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-4">
                Project details
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Client', value: cs.client },
                  { label: 'Industry', value: cs.industry },
                  { label: 'Quantity', value: `${cs.quantity} pieces` },
                  { label: 'Turnaround', value: cs.turnaround },
                  { label: 'Date', value: cs.date },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-[#111111]/40 mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-[#111111]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverables */}
            <div className="border border-[#ECE7DF] rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-4">
                Deliverables
              </p>
              <ul className="flex flex-col gap-2">
                {cs.deliverables.map(d => (
                  <li key={d} className="flex gap-2 text-sm text-[#111111]/70">
                    <span className="text-[#111111]/20 shrink-0">&#8212;</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-[var(--color-navy)] rounded-2xl p-6 flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">Want something similar?</p>
              <p className="text-xs text-white/50 leading-relaxed">
                We work with brands across India. MOQ 50 pieces, quote in 24 hours.
              </p>
              <Link
                href="/configurator"
                className="bg-white text-[var(--color-navy)] px-4 py-2.5 rounded-full text-xs font-medium text-center hover:bg-white/90 transition-colors"
              >
                Start designing
              </Link>
              <Link
                href="/contact"
                className="border border-white/20 text-white/70 px-4 py-2.5 rounded-full text-xs font-medium text-center hover:bg-white/10 transition-colors"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Related case studies */}
      {related.length > 0 && (
        <section className="border-t border-[#ECE7DF] py-16">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-8">
              More work
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {related.map(cs => (
                <Link
                  key={cs.slug}
                  href={`/work/${cs.slug}`}
                  className="group bg-white flex flex-col overflow-hidden rounded-2xl border border-[#ECE7DF] shadow-[0_4px_16px_rgba(22,33,43,0.04)] hover:border-[var(--color-teal)] hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)] transition-all duration-300"
                >
                  <div className="relative w-full aspect-video bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                    {cs.coverImage ? (
                      <Image
                        src={cs.coverImage}
                        alt={cs.client}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <span className="text-xs text-[#111111]/20 uppercase tracking-widest">{cs.client}</span>
                    )}
                  </div>
                  <div className="p-6 flex flex-col gap-2">
                    <span className="text-xs text-[#111111]/30">{cs.industry}</span>
                    <h3 className="text-base font-semibold text-[#111111] group-hover:underline leading-snug">
                      {cs.title}
                    </h3>
                    <p className="text-xs text-[#111111]/50">{cs.quantity} pieces · {cs.turnaround}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
