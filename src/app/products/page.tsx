import Link from 'next/link'
import Image from 'next/image'
import { products } from '@/lib/products'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Products',
  description: 'Shop Garmops\'s own line — designed and manufactured in-house. Heavyweight tees, hoodies, sweatpants, and more.',
  path: '/products',
})

export default function Products() {
  return (
    <>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Garmops</p>
        <h1 className="text-5xl font-bold text-[#111111] leading-tight mb-4 tracking-tight">Products</h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">
          Order samples of our products before placing a bulk order. All pieces are manufactured in-house.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-[#ECE7DF] bg-white px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
          <p className="text-sm text-[#111111]/60">
            Ships within 24 hours.
          </p>
          <div className="flex gap-6 text-xs text-[#111111]/40 shrink-0">
            <span>Free shipping above ₹2000 spend</span>
            <span>Easy returns</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <Link key={p.id} href={`/products/${p.slug}`}
              className="group bg-white flex flex-col overflow-hidden rounded-2xl border border-[#ECE7DF] shadow-[0_4px_16px_rgba(22,33,43,0.04)] hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)] hover:border-[var(--color-teal)] transition-all duration-300">
              <div className="relative w-full aspect-[3/4] bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                {p.image ? (
                  <Image src={p.image} alt={p.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <span className="text-xs text-[#111111]/20 uppercase tracking-wide">Product photo</span>
                )}
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 className="text-sm font-semibold text-[#111111] leading-snug group-hover:underline">{p.name}</h3>
                <p className="text-xs text-[#111111]/40">{p.gsm} GSM{p.fits ? ` · ${p.fits[0]} fit` : ''}</p>
                <div className="flex items-center justify-between pt-3 border-t border-[#ECE7DF] mt-auto">
                  <p className="text-base font-bold text-[#111111]">&#8377;{p.price.toLocaleString('en-IN')}</p>
                  <span className="text-xs text-[#111111]/40">{p.sizes.length > 1 ? `${p.sizes.length} sizes` : p.sizes[0]}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[var(--color-cream)] border-t border-[#ECE7DF] py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">Want merch like this for your brand?</h2>
            <p className="text-[#111111]/50 text-sm">Custom apparel for brands, cafes, and companies. MOQ 50 pieces.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/configurator" className="bg-[var(--color-teal)] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition">Start designing</Link>
          </div>
        </div>
      </section>
    </>
  )
}
