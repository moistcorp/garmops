'use client'
import Image from 'next/image'
import { useState } from 'react'

const accordionItems = [
  {
    title: 'Manufactured in India, built for global standards',
    body: 'Our facilities across India runs on the same processes trusted by export-grade fashion brands. Every order - from 50 pieces to 5,000 - goes through the same QA rigour.',
    image: '/images/manufacturing-facility.webp',
    alt: 'Garment manufacturing facility floor in India with QA processes in place',
  },
  {
    title: 'Extensive Customisation',
    body: 'Choose from ready-stock colours, custom dye references, and professional print and embroidery techniques to bring your merch vision to life.',
    image: '/images/print-techniques.webp',
    alt: 'Our 6 print and embroidery techniques — Screen Print, DTG, DTF, Reflective Heat Transfer, Embroidery, 3D Embroidery, Puff',
  },
  {
    title: 'Flexible MOQs from 50 pieces',
    body: 'No warehouse minimums, no padding. Order exactly what you need. Volume discounts kick in automatically from 100 pieces.',
    image: '/images/flexiblemoq.webp',
    alt: 'Small batch garment production run showing flexible order quantities',
  },
  {
    title: 'Fast, predictable lead times',
    body: 'Standard orders in 35 working days. Rush orders in 18 working days. Timelines confirmed at order, not after.',
    image: '/images/fast-lead-times.webp',
    alt: 'Garments packed and ready for dispatch, showing fast turnaround',
  },
]

export default function WhyGarmops() {
  const [openIndex, setOpenIndex] = useState<number>(0)

  return (
    <section className="techpack-section py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-16">

          {/* LEFT — heading + accordion */}
          <div>
            <p className="text-xs text-[#595959] font-medium mb-4 tracking-widest uppercase">
              Why Garmops
            </p>
            <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:mb-10 sm:text-4xl">
              Merch made right,<br />in India.
            </h2>

            <div className="flex flex-col divide-y divide-[#E5E5E5] border-t border-b border-[#E5E5E5]">
              {accordionItems.map((item, i) => (
                <div
                  key={i}
                  className={openIndex === i ? 'techpack-panel my-2 rounded-[4px] border px-3 sm:px-4' : 'px-3 sm:px-4'}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(i)}
                    id={`why-garmops-button-${i}`}
                    aria-expanded={openIndex === i}
                    aria-controls={`why-garmops-panel-${i}`}
                    className="w-full flex items-center justify-between py-5 text-left gap-4"
                  >
                    <span className={`text-base font-semibold leading-snug transition-colors ${openIndex === i ? 'text-[var(--color-accent)]' : 'text-[var(--text-primary)]/60'}`}>
                      {item.title}
                    </span>
                    <span className={`shrink-0 w-5 h-5 flex items-center justify-center transition-colors ${openIndex === i ? 'text-[var(--color-accent)]' : 'text-[#666666]'}`}>
                      <svg
                        aria-hidden="true"
                        className={`w-4 h-4 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {openIndex === i && (
                    <p
                      id={`why-garmops-panel-${i}`}
                      role="region"
                      aria-labelledby={`why-garmops-button-${i}`}
                      className="pb-5 text-sm text-[#4a4a4a] leading-relaxed -mt-1"
                    >
                      {item.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — dynamic image, crossfades with active section */}
          <div className="relative w-full aspect-square border border-[#ECE7DF] overflow-hidden rounded-[4px] ">
            {accordionItems.map((item, i) => (
              <Image
                key={item.image}
                src={item.image}
                alt={openIndex === i ? item.alt : ''}
                aria-hidden={openIndex !== i}
                fill
                className={`object-cover transition-opacity duration-300 ease-in-out ${
                  openIndex === i ? 'opacity-100' : 'opacity-0'
                }`}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
