'use client'

import Link from 'next/link'
import { caseStudies } from '@/lib/casestudies'

export default function HomepageCaseStudies() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-12 items-start">

          <div className="lg:sticky lg:top-24">
            <p className="text-xs text-[#666666] font-medium mb-4 tracking-widest uppercase">
              Case Studies
            </p>

            <h2 className="text-4xl font-bold text-[#111111] tracking-tight leading-[1.05] mb-6">
              How the best brands use Foundry
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

          {/* Cards */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

            {caseStudies.slice(0, 3).map((cs) => (

              <Link
                key={cs.slug}
                href={`/work/${cs.slug}`}
                className="group"
              >

                <div className="overflow-hidden rounded-xl border border-[#E5E5E5] hover:border-[#111111] transition-all duration-300 bg-white">

                  {/* Image */}

                  <div className="relative h-[520px] overflow-hidden bg-[#F7F7F7]">

                    {/* Chips */}

                    <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">

                      <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-medium">
                        ● {cs.color}
                      </span>

                      <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-medium">
                        {cs.product}
                      </span>

                      <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-medium">
                        {cs.printMethod}
                      </span>

                    </div>

                    {cs.coverImage ? (

                      <img
                        src={cs.coverImage}
                        alt={cs.client}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
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

        </div>

      </div>
    </section>
  )
}
