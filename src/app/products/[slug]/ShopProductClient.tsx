'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Product } from '@/lib/products'
import { useCartStore } from '@/lib/store'
import Link from 'next/link'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { getSizeChart } from '@/lib/sizecharts'

export default function ShopProductClient({
  product,
  allProducts,
}: {
  product: Product
  allProducts: Product[]
}) {
  const router = useRouter()
  const addItem = useCartStore(s => s.addItem)

  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState('')

  const sizeChart = getSizeChart(product.slug)

  const related = allProducts
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 3)

  function handleAdd() {
    if (product.sizes.length > 1 && !selectedSize) {
      setError('Please select a size')
      return
    }
    setError('')
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      size: selectedSize || product.sizes[0],
      quantity,
      image: product.image,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleBuyNow() {
    if (product.sizes.length > 1 && !selectedSize) {
      setError('Please select a size')
      return
    }
    setError('')
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      size: selectedSize || product.sizes[0],
      quantity,
      image: product.image,
    })
    router.push('/cart')
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <Breadcrumbs crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: product.name },
        ]} />

        <div className="grid md:grid-cols-2 gap-16">

          {/* Image */}
          <div className="relative">
            {product.image ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#ECE7DF] shadow-[0_8px_30px_rgba(22,33,43,0.06)]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[3/4] bg-[var(--color-cream-soft)] rounded-2xl border border-[#ECE7DF] flex items-center justify-center">
                <span className="text-xs text-[#111111]/20 uppercase tracking-wide">Product photo</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs text-[#111111]/40 uppercase tracking-widest mb-2">
                {product.category}
              </p>
              <h1 className="text-3xl font-bold text-[#111111] leading-tight tracking-tight mb-2">
                {product.name}
              </h1>
              <p className="text-xs text-[#111111]/40 mb-3">
                {product.gsm} GSM{product.fits ? ` · ${product.fits[0]} fit` : ''}
              </p>
              <p className="text-2xl font-bold text-[#111111]">
                &#8377;{product.price.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-[#111111]/40 mt-1">Per piece</p>
            </div>

            <p className="text-sm text-[#111111]/60 leading-relaxed">{product.description}</p>

            {/* Size selector */}
            {product.sizes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest mb-3">
                  Size
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSelectedSize(s); setError('') }}
                      className={`w-12 h-12 text-sm border transition-colors ${
                        selectedSize === s
                          ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]'
                          : 'border-[#E5E5E5] text-[#111111] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              </div>
            )}

            {/* Quantity */}
            <div>
              <p className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest mb-3">
                Quantity
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full border border-[#E5E5E5] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors flex items-center justify-center text-lg"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-full border border-[#E5E5E5] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors flex items-center justify-center text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full rounded-full bg-[var(--color-teal)] text-white py-4 text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors"
              >
                Buy now
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="w-full rounded-full border border-[var(--color-teal)] text-[var(--color-teal)] py-4 text-sm font-medium hover:bg-[var(--color-teal)] hover:text-white transition-colors"
              >
                {added ? 'Added to cart' : 'Add to cart'}
              </button>
              <Link
  href="/configurator"
  className="
    w-full
    rounded-full
    bg-[var(--color-teal)]
    py-4
    text-center
    text-sm
    font-semibold
    text-white
    shadow-lg
    transition-all
    duration-300
    hover:-translate-y-0.5
    hover:bg-[var(--color-teal-dark)]
    hover:shadow-xl
    active:translate-y-0
  "
>
  Start Designing
</Link>
            </div>

            {/* Details */}
            <div className="border-t border-[#E5E5E5] pt-6">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                Details
              </p>
              <ul className="flex flex-col gap-1.5">
                {product.details.map(d => (
                  <li key={d} className="flex gap-2 text-xs text-[#111111]/60">
                    <span className="text-[#111111]/20 shrink-0">&#8212;</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* Care */}
            <div className="border-t border-[#E5E5E5] pt-6">
              <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                Care instructions
              </p>
              <ul className="flex flex-col gap-1.5">
                {product.careInstructions.map(c => (
                  <li key={c} className="flex gap-2 text-xs text-[#111111]/60">
                    <span className="text-[#111111]/20 shrink-0">&#8212;</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Size chart */}
            {sizeChart && (
              <div className="border-t border-[#E5E5E5] pt-6">
                <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">
                  Size chart
                </p>
                <div className="border border-[#ECE7DF] rounded-2xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-cream-soft)]">
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Size</th>
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Chest</th>
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Length</th>
                        {sizeChart.sizes[0].shoulder && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Shoulder</th>
                        )}
                        {sizeChart.sizes[0].waist && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Waist</th>
                        )}
                        {sizeChart.sizes[0].inseam && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Inseam</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E5E5]">
                      {sizeChart.sizes.map(row => (
                        <tr key={row.size}>
                          <td className="px-4 py-3 font-semibold text-[#111111]">{row.size}</td>
                          <td className="px-4 py-3 text-[#111111]/60">{row.chest}</td>
                          <td className="px-4 py-3 text-[#111111]/60">{row.length}</td>
                          {row.shoulder && (
                            <td className="px-4 py-3 text-[#111111]/60">{row.shoulder}</td>
                          )}
                          {row.waist && (
                            <td className="px-4 py-3 text-[#111111]/60">{row.waist}</td>
                          )}
                          {row.inseam && (
                            <td className="px-4 py-3 text-[#111111]/60">{row.inseam}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sizeChart.note && (
                  <p className="text-xs text-[#111111]/30 mt-2">{sizeChart.note}</p>
                )}
              </div>
            )}

            <p className="text-xs text-[#111111]/40">
              Free shipping above &#8377;2000. Ships within 7 days.
            </p>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-24 border-t border-[#ECE7DF] pt-16">
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#111111]/40 mb-8">
            More in {product.category}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {related.map(p => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group bg-white flex flex-col overflow-hidden rounded-2xl border border-[#ECE7DF] shadow-[0_4px_16px_rgba(22,33,43,0.04)] hover:border-[var(--color-teal)] hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)] transition-all duration-300"
              >
                <div className="relative w-full aspect-[3/4] bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-xs text-[#111111]/20 uppercase tracking-wide">
                      Product photo
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-[#111111] group-hover:underline">
                    {p.name}
                  </h3>
                  <p className="text-xs text-[#111111]/40">
                    {p.gsm} GSM{p.fits ? ` · ${p.fits[0]} fit` : ''}
                  </p>
                  <p className="text-base font-bold mt-1">
                    &#8377;{p.price.toLocaleString('en-IN')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
