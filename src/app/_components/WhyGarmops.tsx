'use client'

import Image from 'next/image'
import { useState } from 'react'

const accordionItems = [
  {
    title: 'Built around custom apparel decisions',
    body: 'Compare fit, fabric weight, garment construction and sizes before you customise. Product information is written to help non-technical buyers choose a sensible starting point.',
    image: '/products/regular-fit-tee-200gsm.webp',
    alt: 'Classic T-Shirt product used as a custom apparel starting point',
    objectClass: 'object-cover',
  },
  {
    title: 'Customise it in one guided flow',
    body: 'Choose the garment colour, add artwork, define print placements and build the quantity and size split without moving the order across disconnected messages and spreadsheets.',
    image: '/garments/artwork-sample.svg',
    alt: 'Artwork sample representing the Garmops garment customisation workflow',
    objectClass: 'object-contain p-10 sm:p-16',
  },
  {
    title: 'Start from 50 pieces',
    body: 'Custom production starts from 50 pieces per product configuration. You can split that quantity across the sizes available for the selected garment.',
    image: '/images/flexiblemoq.webp',
    alt: 'Small batch garment production representing custom orders from 50 pieces',
    objectClass: 'object-cover',
  },
  {
    title: 'Production you can follow',
    body: 'After checkout, the approved configuration stays attached to the order and its status can move through the production workflow instead of disappearing into an offline handoff.',
    image: '/images/manufacturing-facility.webp',
    alt: 'Garment manufacturing floor representing the Garmops production workflow',
    objectClass: 'object-cover',
  },
]

export default function WhyGarmops() {
  const [openIndex, setOpenIndex] = useState<number>(0)

  return (
    <section className="techpack-section py-14 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Why Garmops</p>
            <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:mb-10 sm:text-4xl">
              A clearer way to order custom apparel.
            </h2>

            <div className="flex flex-col divide-y divide-[#E5E5E5] border-y border-[#E5E5E5]">
              {accordionItems.map((item, i) => (
                <div
                  key={item.title}
                  className={openIndex === i ? 'techpack-panel my-2 rounded-[4px] border px-3 sm:px-4' : 'px-3 sm:px-4'}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(i)}
                    id={`why-garmops-button-${i}`}
                    aria-expanded={openIndex === i}
                    aria-controls={`why-garmops-panel-${i}`}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className={`text-base font-semibold leading-snug transition-colors ${openIndex === i ? 'text-[var(--color-accent)]' : 'text-[var(--text-primary)]/65'}`}>
                      {item.title}
                    </span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center transition-colors ${openIndex === i ? 'text-[var(--color-accent)]' : 'text-[#666666]'}`}>
                      <svg
                        aria-hidden="true"
                        className={`h-4 w-4 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  <div
                    id={`why-garmops-panel-${i}`}
                    role="region"
                    aria-labelledby={`why-garmops-button-${i}`}
                    className={`grid transition-all duration-300 ease-in-out ${openIndex === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <p className="-mt-1 pb-5 text-sm leading-relaxed text-[#4a4a4a]">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-[#ECE7DF] bg-[var(--color-cream-soft)]">
            {accordionItems.map((item, i) => (
              <Image
                key={item.image}
                src={item.image}
                alt={openIndex === i ? item.alt : ''}
                aria-hidden={openIndex !== i}
                fill
                className={`${item.objectClass} transition-opacity duration-300 ease-in-out ${openIndex === i ? 'opacity-100' : 'opacity-0'}`}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
