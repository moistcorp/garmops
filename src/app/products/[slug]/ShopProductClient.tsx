'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Product,
  productCategoryLandingPath,
  productCategoryLinkLabel,
  productDecorationMethods,
  productImageAlt,
  productSuitableUseCases,
} from '@/lib/products'
import { MAX_SAMPLE_ITEM_QUANTITY, useCartStore } from '@/lib/store'
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
  const categoryPath = productCategoryLandingPath(product)
  const suitableUseCases = productSuitableUseCases(product)
  const decorationMethods = productDecorationMethods(product)

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
    <div className="techpack-canvas">
      <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 sm:py-16">
        <Breadcrumbs crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: product.name },
        ]} />

        <div className="grid gap-8 sm:gap-12 md:grid-cols-2 md:gap-16">

          {/* Image */}
          <div className="relative">
            {product.image ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-[4px] border border-[#ECE7DF] ">
                <Image
                  src={product.image}
                  alt={productImageAlt(product)}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="aspect-[3/4] bg-[var(--color-cream-soft)] rounded-[4px] border border-[#ECE7DF] flex items-center justify-center">
                <span className="text-xs text-[#111111]/20 uppercase tracking-wide">Product photo</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="techpack-surface flex flex-col gap-6 rounded-[4px] border p-4 sm:rounded-[4px] sm:p-7">
            <div>
              <p className="text-xs text-[#111111]/40 uppercase tracking-widest mb-2">
                {product.category}
              </p>
              <h1 className="mb-2 text-2xl font-bold leading-tight tracking-tight text-[#111111] sm:text-3xl">
                {product.name}
              </h1>
              <p className="text-xs text-[#111111]/40 mb-3">
                {product.gsm} GSM{product.fits ? ` · ${product.fits[0]} fit` : ''}
              </p>
              <p className="text-2xl font-bold text-[#111111]">
                &#8377;{product.price.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-[#111111]/40 mt-1">Catalogue sample price per piece</p>
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
                      className={`min-w-12 h-12 rounded-[4px] px-3 text-sm whitespace-nowrap border transition-colors ${
                        selectedSize === s
                          ? 'techpack-selected'
                          : 'techpack-control text-[#111111] hover:!border-[var(--color-accent)] hover:text-[var(--color-accent)]'
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
                  className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-lg transition-colors hover:!border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(MAX_SAMPLE_ITEM_QUANTITY, q + 1))}
                  disabled={quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                  className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-lg transition-colors hover:!border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
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
                className="w-full rounded-[4px] bg-[var(--color-accent)] text-white py-4 text-sm font-medium hover:bg-[var(--color-accent-dark)] transition-colors"
              >
                Buy now
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="w-full rounded-[4px] border border-[var(--color-accent)] text-[var(--color-accent)] py-4 text-sm font-medium hover:bg-[var(--color-accent)] hover:text-white transition-colors"
              >
                {added ? 'Added to cart' : 'Add to cart'}
              </button>
              <Link
                href="/configurator"
                className="w-full py-2 text-center text-sm font-medium text-[#111111]/55 underline-offset-4 transition-colors hover:text-[var(--color-accent)] hover:underline"
              >
                Customise this product in the configurator
              </Link>
              <Link
                href={categoryPath}
                className="w-full py-1 text-center text-sm font-medium text-[#111111]/55 underline-offset-4 transition-colors hover:text-[var(--color-accent)] hover:underline"
              >
                {productCategoryLinkLabel(product)}
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
                <div className="techpack-panel overflow-hidden rounded-[4px] border">
                  <div className="overflow-x-auto" role="region" aria-label="Product size chart" tabIndex={0}>
                  <table className="min-w-max w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-cream-soft)]">
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Size</th>
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">{sizeChart.chestLabel ?? 'Chest'}</th>
                        <th className="text-left px-4 py-3 font-medium text-[#111111]/50">{sizeChart.lengthLabel ?? 'Length'}</th>
                        {sizeChart.sizes[0].shoulder && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Shoulder</th>
                        )}
                        {sizeChart.sizes[0].waist && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Waist</th>
                        )}
                        {sizeChart.sizes[0].inseam && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Inseam</th>
                        )}
                        {sizeChart.sizes[0].sleeve && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Sleeve</th>
                        )}
                        {sizeChart.sizes[0].handles && (
                          <th className="text-left px-4 py-3 font-medium text-[#111111]/50">Handles</th>
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
                          {row.sleeve && (
                            <td className="px-4 py-3 text-[#111111]/60">{row.sleeve}</td>
                          )}
                          {row.handles && (
                            <td className="px-4 py-3 text-[#111111]/60">{row.handles}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
                {sizeChart.note && (
                  <p className="text-xs text-[#111111]/30 mt-2">{sizeChart.note}</p>
                )}
              </div>
            )}

            <p className="text-xs text-[#111111]/40">
              Free shipping above &#8377;2,000. Dispatches within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6 sm:pb-8 sm:pt-4">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#111111]/40">Bulk orders</p>
          <h2 className="text-3xl font-bold tracking-tight text-[#111111] sm:text-4xl">
            Plan a branded run with this garment
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#111111]/60 sm:text-base">
            The displayed price is for a catalogue sample. Bulk orders begin from 50 pieces per style and are reviewed against the complete garment, artwork, quantity, size and delivery specification.
          </p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <article className="techpack-panel rounded-[4px] border p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[#111111]">Suitable use cases</h3>
            <ul className="mt-4 space-y-2">
              {suitableUseCases.map(useCase => (
                <li key={useCase} className="text-sm leading-6 text-[#111111]/60">— {useCase}</li>
              ))}
            </ul>
          </article>
          <article className="techpack-panel rounded-[4px] border p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[#111111]">Decoration methods to review</h3>
            <ul className="mt-4 space-y-2">
              {decorationMethods.map(method => (
                <li key={method} className="text-sm leading-6 text-[#111111]/60">— {method}</li>
              ))}
            </ul>
          </article>
          <article className="techpack-panel rounded-[4px] border p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[#111111]">Continue the order</h3>
            <div className="mt-4 flex flex-col items-start gap-3">
              <Link href={categoryPath} className="text-sm font-medium text-[var(--color-accent-dark)] underline underline-offset-4">
                {productCategoryLinkLabel(product)}
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-[var(--color-accent-dark)] underline underline-offset-4">
                Estimate bulk apparel pricing
              </Link>
              <Link href="/configurator" className="text-sm font-medium text-[var(--color-accent-dark)] underline underline-offset-4">
                Configure this garment for a bulk order
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#111111]/40 mb-8">
            More in {product.category}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {related.map(p => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="techpack-panel group flex flex-col overflow-hidden rounded-[4px] border transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-accent)]/45"
              >
                <div className="relative w-full aspect-[3/4] bg-[var(--color-cream-soft)] flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={productImageAlt(p)}
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
    </div>
  )
}
