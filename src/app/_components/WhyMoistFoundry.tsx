'use client'
import Image from 'next/image'
import { useState } from 'react'

const accordionItems = [
  {
    title: 'Manufactured in India, built for global standards',
    body: 'Our facilities across India runs on the same processes trusted by export-grade fashion brands. Every order - from 50 pieces to 5,000 - goes through the same QA rigour.',
  },
  {
    title: 'Extensive Customisation',
    body: 'Over 2500 colours to match your brand identity and 6 professional embellishment techniques to bring your merch vision to life.',
  },
  {
    title: 'Flexible MOQs from 50 pieces',
    body: 'No warehouse minimums, no padding. Order exactly what you need. Volume discounts kick in automatically from 100 pieces.',
  },
  {
    title: 'Fast, predictable lead times',
    body: 'Standard orders in 35 working days. Rush orders in 18 working days. Timelines confirmed at order, not after.',
  },
]

export default function WhyMoistFoundry() {
  const [openIndex, setOpenIndex] = useState<number>(0)

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-start">

          {/* LEFT — heading + accordion */}
          <div>
            <p className="text-xs text-[#595959] font-medium mb-4 tracking-widest uppercase">
              Why Moist Foundry
            </p>
            <h2 className="text-4xl font-bold text-[#111111] tracking-tight leading-tight mb-10">
              Merch made right,<br />in India.
            </h2>

            <div className="flex flex-col divide-y divide-[#E5E5E5] border-t border-b border-[#E5E5E5]">
              {accordionItems.map((item, i) => (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
                    className="w-full flex items-center justify-between py-5 text-left gap-4"
                  >
                    <span className={`text-base font-semibold leading-snug transition-colors ${openIndex === i ? 'text-[#111111]' : 'text-[#111111]/60'}`}>
                      {item.title}
                    </span>
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#666666]">
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {openIndex === i && (
                    <p className="pb-5 text-sm text-[#4a4a4a] leading-relaxed -mt-1">
                      {item.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — techniques image */}
            <div className="relative w-full aspect-square border border-[#E5E5E5] overflow-hidden rounded-2xl">
              <Image
                src="/images/print-techniques.jpg"
                alt="Our 6 print and embroidery techniques — Screen Print, DTG, DTF, Reflective Heat Transfer, Embroidery, 3D Embroidery, Puff"
                fill
                className="object-cover"  
               sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

        </div>
      </div>
    </section>
  )
}
