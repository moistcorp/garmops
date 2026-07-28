import Link from 'next/link'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import { faqSchema } from '@/lib/structuredData'

export const metadata: Metadata = generateMeta({
  title: 'Custom Apparel Manufacturing Process',
  description: 'See how a Garmops bulk custom apparel order moves from garment selection and artwork to sampling, production, quality control and delivery.',
  path: '/how-it-works',
  keywords: [
    'custom apparel manufacturing process',
    'bulk T-shirt order process',
    'custom merchandise production India',
    'apparel quality control',
  ],
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
      <JsonLd data={faqSchema(faqs)} />
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">The process</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">
          Custom apparel, from brief to <span className="text-[var(--color-teal)]">delivery</span>
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-[#111111]/50 sm:text-lg">
          A straightforward process built around your timeline. No back-and-forth, no surprises.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="flex flex-col gap-4">
          {steps.map(s => (
            <div key={s.num} className="liquid-glass-panel grid items-start gap-3 rounded-[24px] border p-5 sm:gap-6 sm:p-6 md:grid-cols-12 md:p-8">
              <p className="md:col-span-1 text-2xl font-bold text-[#111111]/15">{s.num}</p>
              <h3 className="md:col-span-4 text-base font-semibold text-[#111111]">{s.title}</h3>
              <p className="md:col-span-7 text-[#111111]/50 leading-relaxed text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-liquid-section py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">FAQ</p>
          <h2 className="mb-8 text-3xl font-bold tracking-tight text-[#111111] sm:mb-12 sm:text-4xl">Common questions</h2>
          <div className="grid gap-4">
            {faqs.map(f => (
              <div key={f.q} className="liquid-glass-panel grid gap-3 rounded-2xl border p-5 sm:gap-6 sm:p-6 md:grid-cols-2">
                <p className="text-[#111111] font-medium text-sm">{f.q}</p>
                <p className="text-[#111111]/50 leading-relaxed text-sm">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-14 text-center sm:px-6 sm:py-20">
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Ready to start?</h2>
        <p className="text-[#111111]/50 mb-8 text-sm">Configure your order in minutes. We&apos;ll take it from there.</p>
        <Link href="/configurator" className="inline-block bg-[var(--color-teal)] text-white px-8 py-4 rounded-full hover:bg-[var(--color-teal-dark)] transition text-sm font-medium">
          Start designing
        </Link>
      </section>
    </div>
  )
}
