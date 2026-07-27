'use client'
import HomepageCaseStudies from '@/components/home/HomepageCaseStudies'
import HowItWorks from '@/app/_components/HowItWorks'
import HeroScrollVideo from '@/app/HeroScrollVideo'
import WhyGarmops from '@/app/_components/WhyGarmops'
import EmailCapture from '@/app/_components/EmailCapture'
import Reveal from '@/app/_components/Reveal'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { PRODUCT_PRICES, DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from '@/lib/pricing'

const industries = [
  { name: 'Hotels & Restaurants', desc: 'Merchandise designed for hospitality brands, from staff apparel to retail collections and guest experiences.', image: '/industries/hotels-restaurants.jpg' },
  { name: 'Music & Events', desc: 'Merch created for releases, tours, and live events, from artist collections to large-scale drops.', image: '/industries/music-events.jpg' },
  { name: 'Sports & Fitness', desc: 'Merchandise for teams, clubs, and active brands, built for both function and identity.', image: '/industries/sports-fitness.jpg' },
  { name: 'Arts & Culture', desc: 'Merchandise developed for exhibitions, institutions, and artists, from limited releases to curated retail collections.', image: '/industries/arts-culture.jpg' },
  { name: 'Creative Studios', desc: 'Design-led merchandise for studios and agencies, built to extend brand systems into physical products.', image: '/industries/creative-studios.jpg' },
  { name: 'Companies & Startups', desc: 'Custom merchandise for teams and organisations, from onboarding kits to team apparel and client gifting.', image: '/industries/companies-startups.jpg' },
]

const faqs = [
  { q: "What's the minimum order quantity?", a: 'Just 50 pieces per style, with volume discounts kicking in as quantity increases.' },
  { q: 'How long does delivery take?', a: `Standard delivery takes ${DELIVERY_DAYS} days from order confirmation. Need it sooner? Rush delivery is available in ${RUSH_DELIVERY_DAYS} days.` },
  { q: 'Do you provide GST-compliant invoices and accept company POs?', a: 'Yes to both. Every order includes a GST-compliant tax invoice with HSN codes, and we accept Purchase Orders with 50% advance on confirmation, balance due before dispatch.' },
]

// Lowest starting price across the catalog, used for the homepage pricing teaser
const startingPrice = Math.min(...Object.values(PRODUCT_PRICES))

const pricingHighlights = ['50 pc MOQ', 'GST Invoicing', `${DELIVERY_DAYS}-day delivery`]

export default function HomeClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <>
      {/* HERO */}

     <HeroScrollVideo />

      {/* INDUSTRIES */}
      <section className="bg-white"> <div className="max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <p className="text-xs text-[#595959] font-medium mb-4 tracking-widest uppercase">Who we work with</p>
          <h2 className="text-4xl font-bold mb-3 tracking-tight">Premium merch for every <span className="text-[var(--color-teal)]">industry</span></h2>
          <p className="text-[#4a4a4a] text-sm mb-12 max-w-lg leading-relaxed">
            From hospitality to creative agencies, Garmops delivers premium branded merchandise tailored to different industries.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((i, idx) => (
            <Reveal key={i.name} delay={idx * 80}>
              <div className="group flex flex-col bg-white rounded-2xl border border-[#ECE7DF] overflow-hidden shadow-[0_4px_16px_rgba(22,33,43,0.04)] hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)] hover:border-[var(--color-teal)] transition-all duration-300">
                <div className="relative w-full h-[380px] bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                  {i.image ? (
                    <Image src={i.image} alt={i.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <span className="text-xs text-[#111111]/20 uppercase tracking-widest">{i.name}</span>
                  )}
                  {/* Pill tag overlay, Nugget-style */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-white/90 backdrop-blur-md rounded-full px-3.5 py-1.5 text-xs font-medium text-[#111111] shadow-sm">
                      {i.name}
                    </span>
                  </div>
                  {/* Liquid glass reveal button on hover */}
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-full backdrop-blur-md bg-white/80 border border-white/60 flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                    <svg className="w-4 h-4 text-[var(--color-teal)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H8M17 7v9" />
                    </svg>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-[#111111]">{i.name}</h3>
                  <p className="text-xs text-[#4a4a4a] leading-relaxed">{i.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      </section>

     <WhyGarmops />

     <HowItWorks />

<HomepageCaseStudies />

      {/* PRICING TEASER — lightweight, links out to full estimator on /pricing */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="relative overflow-hidden bg-[var(--color-navy)] rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10">
              {/* Ambient liquid-glass orbs */}
              <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 bg-[var(--color-teal)]/20 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 left-1/3 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

              <div className="relative max-w-lg">
                <p className="text-xs text-white/60 font-medium mb-4 tracking-widest uppercase">Pricing</p>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
                  Starts at &#8377;{startingPrice.toLocaleString('en-IN')}/piece
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mb-5">
                  Fabric, stitching, single-color print, and neck label included. Volume discounts from 50 pieces
                  and delivery in {DELIVERY_DAYS} days ({RUSH_DELIVERY_DAYS}-day rush available).
                </p>
                <div className="flex flex-wrap gap-2">
                  {pricingHighlights.map(f => (
                    <span key={f} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 text-xs text-white/90">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative flex flex-col gap-3 w-full md:w-auto shrink-0">
                <Link href="/pricing" className="bg-white text-[var(--color-navy)] text-sm font-medium px-8 py-3.5 rounded-full text-center hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
                  Get a detailed estimate
                </Link>
                <Link href="/configurator" className="backdrop-blur-md bg-white/5 border border-white/30 text-white text-sm font-medium px-8 py-3.5 rounded-full text-center hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap">
                  Start designing
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-[300px_1fr] gap-12">
            <Reveal>
              <p className="text-xs text-[#595959] font-medium mb-4 tracking-widest uppercase">FAQ</p>
              <h2 className="text-4xl font-bold mb-3 tracking-tight">Common <span className="text-[var(--color-teal)]">questions</span></h2>
              <p className="text-[#4a4a4a] text-sm leading-relaxed">
                Can&apos;t find what you&apos;re looking for? <Link href="/contact" className="underline hover:text-[var(--color-teal)]">Get in touch</Link>.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className="flex flex-col border-t border-[#E5E5E5]">
                {faqs.map((item, i) => (
                  <div key={item.q} className="border-b border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      id={`homepage-faq-button-${i}`}
                      aria-expanded={openFaq === i}
                      aria-controls={`homepage-faq-panel-${i}`}
                      className="w-full flex items-center justify-between gap-6 py-6 text-left"
                    >
                      <span className="text-base font-semibold text-[#111111]">{item.q}</span>
                      <svg
                        aria-hidden="true"
                        className={`w-4 h-4 shrink-0 transition-all duration-300 ${openFaq === i ? 'rotate-45 text-[var(--color-teal)]' : 'text-[#555555]'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {/* Smooth grid-based accordion expand instead of instant show/hide */}
                    <div
                      id={`homepage-faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`homepage-faq-button-${i}`}
                      aria-hidden={openFaq !== i}
                      className={`grid transition-all duration-300 ease-in-out ${
                        openFaq === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm text-[#4a4a4a] leading-relaxed pb-6 pr-10">{item.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <EmailCapture />
    </>
  )
}
