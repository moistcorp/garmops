'use client'

import Link from 'next/link'
import Image from 'next/image'
import { caseStudies } from '@/lib/casestudies'

// Featured testimonial for the homepage pull-quote — pulled from a real case study
// rather than invented copy, matching the specific-outcome quotes Nugget uses.
const featuredTestimonial = caseStudies.find(cs => cs.testimonial)?.testimonial

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function HomepageCaseStudies() {
  return (
    <section className="app-liquid-section py-24">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-12 items-start">

          <div className="lg:sticky lg:top-24">
            <p className="text-xs text-[#666666] font-medium mb-4 tracking-widest uppercase">
              Case Studies
            </p>

            <h2 className="text-4xl font-bold text-[#111111] tracking-tight leading-[1.05] mb-6">
              How the best brands use Garmops
            </h2>

            <p className="text-[#4a4a4a] leading-relaxed mb-10">
              Brand is more important than ever, and clothes are the ultimate storytellers. See for yourself how industry leaders are using merch to build brand and community.
            </p>

            <Link
              href="/work"
              className="inline-flex items-center gap-2 text-sm font-medium border-b border-[#111111] pb-1 hover:opacity-60 transition-opacity"
            >
              Discover more stories
              <span>→</span>
            </Link>
          </div>

          {/* Horizontally scrolling case-study cards */}
          <div className="min-w-0">
            <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 pr-6 [scroll-padding-left:0] sm:gap-6">

            {caseStudies.slice(0, 3).map((cs) => (

              <Link
                key={cs.slug}
                href={`/work/${cs.slug}`}
                className="group w-[82vw] max-w-[430px] shrink-0 snap-start sm:w-[420px] lg:w-[380px] xl:w-[420px]"
              >

                <div className="liquid-glass-panel overflow-hidden rounded-[24px] border transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-teal)]/45">

                  {/* Image */}

                  <div className="relative h-[430px] overflow-hidden bg-[#F7F7F7] sm:h-[520px]">

                    {/* Chips */}

                    <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">

                      <span className="liquid-glass-chip rounded-full px-3 py-1 text-xs font-medium">
                        ● {cs.color}
                      </span>

                      <span className="liquid-glass-chip rounded-full px-3 py-1 text-xs font-medium">
                        {cs.product}
                      </span>

                      <span className="liquid-glass-chip rounded-full px-3 py-1 text-xs font-medium">
                        {cs.printMethod}
                      </span>

                    </div>

                    {cs.coverImage ? (

                      <Image
                        src={cs.coverImage}
                        alt={cs.client}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />

                    ) : (

                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs uppercase tracking-widest text-[#111111]/20">
                          Upload Cover Image
                        </span>
                      </div>

                    )}

                    {/* Bottom gradient */}

                    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                  </div>

                  {/* Content */}

                  <div className="p-6">

                    <p className="text-2xl font-semibold tracking-tight text-[#111111] mb-1 group-hover:underline">
                      {cs.client}
                    </p>

                    <p className="text-sm text-[#555555] mb-5">
                      {cs.industry}
                    </p>

                    <div className="flex justify-between items-center pt-5 border-t border-[#E5E5E5]">

                      <div className="flex gap-4 text-xs text-[#555555]">
                        <span>{cs.quantity} pcs</span>
                        <span>{cs.turnaround}</span>
                      </div>

                      <span className="text-sm font-medium">
                        Read story →
                      </span>

                    </div>

                  </div>

                </div>

              </Link>

            ))}

            </div>
            <p className="mt-2 text-xs text-[#666666] lg:hidden">
              Swipe to explore more stories →
            </p>
          </div>

        </div>

        {/* Pull-quote testimonial */}
        {featuredTestimonial && (
          <div className="mt-20 pt-16 border-t border-[#ECE7DF]">
            <div className="max-w-3xl">
              <p className="text-2xl md:text-3xl font-semibold text-[#111111] tracking-tight leading-snug mb-8">
                &ldquo;{featuredTestimonial.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[var(--color-teal)] text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {initials(featuredTestimonial.author)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{featuredTestimonial.author}</p>
                  <p className="text-xs text-[#666666]">{featuredTestimonial.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
