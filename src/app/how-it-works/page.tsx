import Link from 'next/link'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'How It Works',
  description: 'From brief to delivery in 35 days. Learn how Garmops handles custom apparel orders — configuration, production, QA, and shipping.',
  path: '/how-it-works',
})

const steps = [
  { num: '01', title: 'Choose your garment', desc: 'Browse our catalogue of premium blanks - tees, hoodies, totes,longsleeves, sweatshirts and more.' },
  { num: '02', title: 'Configure your order', desc: 'Select your fabric color, upload your artwork, choose print placement and technique. Set your size breakdown and quantity.' },
  { num: '03', title: 'We confirm your order', desc: 'Our team reviews your configuration and begins production within 24 hours. Once confirmed, production begins immediately.' },
  { num: '04', title: 'Production & QA', desc: 'Your order is manufactured at one of our facilities in India. Every piece goes through quality checks before packing.' },
  { num: '05', title: 'Delivery', desc: 'Packed and shipped to your door within 35 days (18 days if rush service availed) of order confirmation. Full tracking provided at every stage.' },
]

const faqs = [
  { q: 'What is the minimum order quantity?', a: '50 pieces per design. This applies across all garment types.' },
  { q: 'How long does production take?', a: 'Standard turnaround is 35 days from order confirmation. Rush timelines are shorter (18 days).' },
  { q: 'What print techniques do you offer?', a: 'Screen printing, DTG, DTF, Reflective Heat Transfer, Embroidery, Puff. We recommend based on your artwork and fabric.' },
  { q: 'Can I get a sample before full production?', a: 'Yes. Pre-production samples are available for an additional charge and take 7-10 days.' },
  { q: 'Do you ship pan-India and internationally?', a: 'Yes. We ship across India and internationally. Shipping costs are calculated at quote stage.' },
]

export default function HowItWorks() {
  return (
    <div className="app-liquid-bg">
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">The process</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">
          From brief to <span className="text-[var(--color-teal)]">delivery</span>
        </h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">
          A straightforward process built around your timeline. No back-and-forth, no surprises.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex flex-col gap-4">
          {steps.map(s => (
            <div key={s.num} className="liquid-glass-panel grid items-start gap-6 rounded-[24px] border p-6 md:grid-cols-12 md:p-8">
              <p className="md:col-span-1 text-2xl font-bold text-[#111111]/15">{s.num}</p>
              <h3 className="md:col-span-4 text-base font-semibold text-[#111111]">{s.title}</h3>
              <p className="md:col-span-7 text-[#111111]/50 leading-relaxed text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-liquid-section py-20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">FAQ</p>
          <h2 className="text-4xl font-bold text-[#111111] mb-12 tracking-tight">Common questions</h2>
          <div className="grid gap-4">
            {faqs.map(f => (
              <div key={f.q} className="liquid-glass-panel grid gap-6 rounded-2xl border p-6 md:grid-cols-2">
                <p className="text-[#111111] font-medium text-sm">{f.q}</p>
                <p className="text-[#111111]/50 leading-relaxed text-sm">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4 tracking-tight">Ready to start?</h2>
        <p className="text-[#111111]/50 mb-8 text-sm">Configure your order in minutes. We&apos;ll take it from there.</p>
        <Link href="/configurator" className="inline-block bg-[var(--color-teal)] text-white px-8 py-4 rounded-full hover:bg-[var(--color-teal-dark)] transition text-sm font-medium">
          Start designing
        </Link>
      </section>
    </div>
  )
}
