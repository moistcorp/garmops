import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import JsonLd from '@/components/seo/JsonLd'
import { generateMeta } from '@/lib/seo'
import { organizationSchema } from '@/lib/structuredData'

export const metadata: Metadata = generateMeta({
  title: 'About Our Custom Apparel Company',
  description: 'Garmops is a custom apparel and branded merchandise manufacturer operated by Moist Corp in Greater Noida, India. Learn what we make and who we serve.',
  path: '/about',
  keywords: [
    'Garmops',
    'custom apparel manufacturer Greater Noida',
    'custom merchandise company India',
    'Moist Corp apparel',
  ],
})

const facts = [
  ['Minimum order', '50 pieces per style'],
  ['Standard delivery', '35 days from order confirmation'],
  ['Rush delivery', '18 days for feasible orders'],
  ['Base', 'Greater Noida, Uttar Pradesh, India'],
]

export default function AboutPage() {
  return (
    <div className="techpack-canvas">
      <JsonLd data={organizationSchema()} />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-(--text-muted)">About Garmops</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-(--text-primary) sm:text-5xl">
            Custom apparel production, made clearer
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-(--text-primary)/65 sm:text-lg">
            Garmops is a B2B custom apparel and branded merchandise platform operated by Moist Corp from Greater Noida, India. We help businesses turn a product, artwork and quantity into a production-ready order without an opaque sourcing process.
          </p>
        </div>
        <figure>
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-(--color-cream-soft)">
            <Image src="/images/manufacturing-facility.webp" alt="Garment manufacturing floor used to illustrate the Garmops production workflow" fill sizes="(max-width: 1024px) 100vw, 56vw" className="object-cover" preload />
          </div>
          <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-(--text-muted)">Garment manufacturing · Production reference</figcaption>
        </figure>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 sm:pb-24 lg:grid-cols-[1.4fr_1fr]">
        <div className="border-y border-(--color-rule) py-7 sm:py-9 lg:pr-10">
          <h2 className="text-2xl font-bold tracking-tight text-(--text-primary)">What we make</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-(--text-primary)/65">
            <p>
              Our catalogue covers regular and boxy T-shirts, long-sleeve tees, polos, sweatshirts, hoodies and canvas tote bags. Projects can combine ready-stock or custom garment colours with Screen Print, DTF, Reflective Print and custom neck-label details.
            </p>
            <p>
              The platform is designed for brands, startups, companies, hospitality teams, gyms, creative studios, artists and event organisers. Buyers can compare products, order samples, estimate pricing and configure artwork before the production team reviews the final specification.
            </p>
            <p>
              Garmops provides GST-compliant invoicing. Moist Corp is a Udyam-registered MSME and an export-registered business with an Import Export Code.
            </p>
          </div>
          <div className="mt-7 flex flex-col gap-3 min-[360px]:flex-row">
            <Link href="/products" className="rounded-sm bg-(--color-accent) px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark)">
              Explore products
            </Link>
            <Link href="/contact" className="rounded-sm border border-(--color-accent) px-6 py-3 text-center text-sm font-medium text-(--color-accent-dark) transition-colors hover:bg-(--color-accent) hover:text-white">
              Talk to the team
            </Link>
          </div>
        </div>

        <aside className="rounded-sm bg-(--color-navy) p-6 text-white sm:p-8" aria-label="Garmops at a glance">
          <h2 className="text-lg font-bold tracking-tight">At a glance</h2>
          <dl className="mt-5 divide-y divide-white/15">
            {facts.map(([label, value]) => (
              <div key={label} className="py-4 first:pt-0 last:pb-0">
                <dt className="text-xs uppercase tracking-wider text-white/65">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </div>
  )
}
