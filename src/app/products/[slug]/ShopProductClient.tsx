'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import {
  Product,
  productBenefits,
  productDecorationMethods,
  productFabricFeel,
  productFitDescription,
  productFitLabel,
  productImageAlt,
  productSpecifications,
} from '@/lib/products'
import { MAX_SAMPLE_ITEM_QUANTITY, useCartStore } from '@/lib/store'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { getSizeChart, type SizeChart, type SizeRow } from '@/lib/sizecharts'

function displaySize(size: string) {
  return size === 'XXL' ? '2XL' : size
}

function hasMeasurement(chart: SizeChart, key: keyof SizeRow) {
  return chart.sizes.some(row => Boolean(row[key]))
}

function MeasurementGuide({ product, sizeChart }: { product: Product; sizeChart: SizeChart }) {
  const isTote = product.selectorCategory === 'Tote Bags'
  const hasShoulder = hasMeasurement(sizeChart, 'shoulder')
  const hasSleeve = hasMeasurement(sizeChart, 'sleeve')

  return (
    <div className="techpack-panel rounded-[4px] border p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/40">How to read the chart</p>

      <div className="mt-5 rounded-[4px] bg-[var(--color-cream-soft)] p-4">
        {isTote ? (
          <svg viewBox="0 0 280 210" className="mx-auto h-auto w-full max-w-[300px]" role="img" aria-label="Tote bag measurement guide">
            <rect x="70" y="60" width="140" height="120" rx="2" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
            <path d="M105 62 C105 20 175 20 175 62" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
            <line x1="70" y1="195" x2="210" y2="195" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <line x1="70" y1="188" x2="70" y2="202" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <line x1="210" y1="188" x2="210" y2="202" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <text x="140" y="207" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.65">WIDTH</text>
            <line x1="230" y1="60" x2="230" y2="180" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <line x1="223" y1="60" x2="237" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <line x1="223" y1="180" x2="237" y2="180" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <text x="248" y="124" fontSize="11" fill="currentColor" opacity="0.65">HEIGHT</text>
          </svg>
        ) : (
          <svg viewBox="0 0 300 230" className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label="Garment measurement guide">
            <path
              d="M103 45 L72 58 L33 105 L58 123 L78 99 L78 197 L222 197 L222 99 L242 123 L267 105 L228 58 L197 45 C184 62 116 62 103 45 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              opacity="0.5"
            />
            <line x1="78" y1="116" x2="222" y2="116" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <line x1="78" y1="109" x2="78" y2="123" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <line x1="222" y1="109" x2="222" y2="123" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <text x="150" y="108" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">CHEST</text>
            <line x1="238" y1="63" x2="238" y2="197" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <line x1="231" y1="63" x2="245" y2="63" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <line x1="231" y1="197" x2="245" y2="197" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
            <text x="253" y="134" fontSize="11" fill="currentColor" opacity="0.7">LENGTH</text>
            {hasShoulder && (
              <>
                <line x1="95" y1="60" x2="205" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <text x="150" y="53" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">SHOULDER</text>
              </>
            )}
            {hasSleeve && (
              <>
                <line x1="226" y1="65" x2="264" y2="108" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <text x="255" y="78" fontSize="10" fill="currentColor" opacity="0.7">SLEEVE</text>
              </>
            )}
          </svg>
        )}
      </div>

      <div className="mt-5 space-y-3 text-sm leading-6 text-[var(--text-primary)]/60">
        <p><span className="font-semibold text-[var(--text-primary)]">Chest:</span> use the chest value exactly as shown for this specific style.</p>
        {hasMeasurement(sizeChart, 'length') && <p><span className="font-semibold text-[var(--text-primary)]">Length:</span> vertical garment length from the upper body to the lower hem.</p>}
        {hasShoulder && <p><span className="font-semibold text-[var(--text-primary)]">Shoulder:</span> shoulder measurement shown in the approved chart.</p>}
        {hasSleeve && <p><span className="font-semibold text-[var(--text-primary)]">Sleeve:</span> sleeve length shown in the approved chart.</p>}
      </div>

      <p className="mt-5 border-t border-[#E5E0D8] pt-4 text-xs leading-5 text-[var(--text-primary)]/45">
        Measurement conventions can vary by style. Compare measurements within the same product rather than comparing chest numbers across different fits.
      </p>
    </div>
  )
}

function SimpleSizeChart({ chart }: { chart: SizeChart }) {
  const showChest = hasMeasurement(chart, 'chest')
  const showLength = hasMeasurement(chart, 'length')
  const allExtraColumns: Array<{ key: keyof SizeRow; label: string }> = [
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeve', label: 'Sleeve' },
    { key: 'handles', label: 'Handles' },
    { key: 'waist', label: 'Waist' },
    { key: 'inseam', label: 'Inseam' },
  ]
  const extraColumns = allExtraColumns.filter(column => hasMeasurement(chart, column.key))

  const renderCell = (row: SizeRow, key: keyof SizeRow) => {
    const value = row[key]
    return typeof value === 'string' ? value : '—'
  }

  return (
    <div>
      {chart.fitNote && (
        <div className="mb-4 inline-flex rounded-[3px] bg-[var(--color-cream-soft)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]/65">
          {chart.fitNote}
        </div>
      )}

      <div className="techpack-panel overflow-hidden rounded-[4px] border">
        <div className="overflow-x-auto" role="region" aria-label="Product size chart" tabIndex={0}>
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="bg-[var(--color-cream-soft)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">Size</th>
                {showChest && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">{chart.chestLabel ?? 'Chest'}</th>}
                {showLength && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">{chart.lengthLabel ?? 'Length'}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8]">
              {chart.sizes.map(row => (
                <tr key={row.size}>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{displaySize(row.size)}</td>
                  {showChest && <td className="px-4 py-3 text-[var(--text-primary)]/65">{row.chest ?? '—'}</td>}
                  {showLength && <td className="px-4 py-3 text-[var(--text-primary)]/65">{row.length ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {extraColumns.length > 0 && (
        <details className="group mt-3 rounded-[4px] border border-[#E5E0D8] bg-white/30">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
            Full measurements
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="overflow-x-auto border-t border-[#E5E0D8]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-[var(--color-cream-soft)]/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">Size</th>
                  {showChest && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">{chart.chestLabel ?? 'Chest'}</th>}
                  {showLength && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">{chart.lengthLabel ?? 'Length'}</th>}
                  {extraColumns.map(column => (
                    <th key={column.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8]">
                {chart.sizes.map(row => (
                  <tr key={row.size}>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{displaySize(row.size)}</td>
                    {showChest && <td className="px-4 py-3 text-[var(--text-primary)]/65">{row.chest ?? '—'}</td>}
                    {showLength && <td className="px-4 py-3 text-[var(--text-primary)]/65">{row.length ?? '—'}</td>}
                    {extraColumns.map(column => (
                      <td key={column.key} className="px-4 py-3 text-[var(--text-primary)]/65">{renderCell(row, column.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {chart.note && <p className="mt-3 text-xs leading-5 text-[var(--text-primary)]/45">{chart.note}</p>}
    </div>
  )
}

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
  const benefits = productBenefits(product)
  const specifications = productSpecifications(product)
  const decorationMethods = productDecorationMethods(product)
  const configuratorHref = `/configurator/build/${encodeURIComponent(product.slug)}`

  const related = allProducts
    .filter(p => p.selectorCategory === product.selectorCategory && p.id !== product.id)
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
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
        <Breadcrumbs crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: product.selectorCategory, href: '/products' },
          { label: product.name },
        ]} />

        {/* Hero */}
        <section className="grid gap-8 sm:gap-12 md:grid-cols-2 md:gap-16">
          <div className="relative">
            {product.image ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-[4px] border border-[#ECE7DF]">
                <Image
                  src={product.image}
                  alt={productImageAlt(product)}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center rounded-[4px] border border-[#ECE7DF] bg-[var(--color-cream-soft)]">
                <span className="text-xs uppercase tracking-wide text-[var(--text-primary)]/20">Product photo</span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center py-1 md:py-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">{product.selectorCategory}</p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">{product.name}</h1>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]/55">
              {productFitLabel(product)} · {productFabricFeel(product)}
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-primary)]/65">{product.description}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-[3px] bg-[#F1EEE8] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]/65">{product.gsm} GSM</span>
              <span className="rounded-[3px] bg-[#F1EEE8] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]/65">{product.selectorMaterial}</span>
              <span className="rounded-[3px] bg-[#F1EEE8] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]/65">{productFitLabel(product)}</span>
            </div>

            <div className="mt-7 border-y border-[#E5E0D8] py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-primary)]/35">Best for</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {product.bestFor.map(item => (
                  <span key={item} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-primary)]/65">
                    <Check size={13} className="text-[var(--color-accent)]" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={configuratorHref}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)]"
              >
                Customise this {product.selectorCategory === 'Tote Bags' ? 'tote' : 'product'} <ArrowRight size={15} />
              </Link>
              <a
                href="#order-sample"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[4px] border border-[#D7D1C7] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--text-primary)]/35"
              >
                Order a sample
              </a>
            </div>
            <p className="mt-3 text-xs text-[var(--text-primary)]/45">Custom orders from {product.minimumOrderQuantity} pieces per product configuration.</p>

            {related.length > 0 && (
              <a href="#compare-similar" className="mt-5 w-fit text-sm font-medium text-[var(--text-primary)]/55 underline underline-offset-4 hover:text-[var(--color-accent)]">
                Not sure? Compare similar products
              </a>
            )}
          </div>
        </section>

        {/* Why choose */}
        <section className="mt-16 border-t border-[#E5E0D8] pt-12 sm:mt-24 sm:pt-16" aria-labelledby="why-choose-title">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Product guidance</p>
            <h2 id="why-choose-title" className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Why choose this {product.selectorCategory === 'Tote Bags' ? 'tote' : 'garment'}?</h2>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {benefits.map((benefit, index) => (
              <article key={benefit.title} className="techpack-panel rounded-[4px] border p-5 sm:p-6">
                <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--color-accent)]">0{index + 1}</span>
                <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]/60">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* At a glance */}
        <section className="mt-12 sm:mt-16" aria-labelledby="at-a-glance-title">
          <h2 id="at-a-glance-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">At a glance</h2>
          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-[4px] border border-[#E5E0D8] md:grid-cols-4">
            {[
              ['Fit', productFitLabel(product)],
              ['Feel', productFabricFeel(product)],
              ['Weight', `${product.gsm} GSM`],
              ['Material', product.selectorMaterial],
            ].map(([label, value], index) => (
              <div key={label} className={`min-h-24 p-4 sm:p-5 ${index % 2 !== 0 ? 'border-l border-[#E5E0D8]' : ''} ${index >= 2 ? 'border-t border-[#E5E0D8] md:border-t-0' : ''} ${index > 0 ? 'md:border-l md:border-[#E5E0D8]' : ''}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/35">{label}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Specs + printing */}
        <section className="mt-16 grid gap-8 border-t border-[#E5E0D8] pt-12 sm:mt-20 sm:pt-16 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Construction</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Product specification</h2>
            <div className="mt-6 overflow-hidden rounded-[4px] border border-[#E5E0D8]">
              {specifications.map((specification, index) => (
                <div key={specification.label} className={`grid grid-cols-[120px_1fr] gap-4 px-4 py-3.5 sm:grid-cols-[150px_1fr] sm:px-5 ${index > 0 ? 'border-t border-[#E5E0D8]' : ''}`}>
                  <span className="text-xs font-medium text-[var(--text-primary)]/40">{specification.label}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{specification.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Customisation</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Branding compatibility</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--text-primary)]/60">
              Garmops currently supports these three print techniques. Final suitability is reviewed against the artwork, print position and garment colour.
            </p>
            <div className="mt-6 space-y-3">
              {decorationMethods.map(method => (
                <article key={method.name} className="techpack-panel rounded-[4px] border p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</h3>
                    {method.recommended && (
                      <span className="rounded-[3px] bg-[var(--color-accent)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-dark)]">Recommended</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]/60">{method.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Size & fit */}
        {sizeChart && (
          <section className="mt-16 border-t border-[#E5E0D8] pt-12 sm:mt-20 sm:pt-16" aria-labelledby="size-fit-title">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Sizing</p>
              <h2 id="size-fit-title" className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Size & fit</h2>
              <p className="mt-4 text-sm leading-6 text-[var(--text-primary)]/60">{productFitDescription(product)}</p>
            </div>
            <div className="mt-7 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <MeasurementGuide product={product} sizeChart={sizeChart} />
              <SimpleSizeChart chart={sizeChart} />
            </div>
          </section>
        )}

        {/* Sample order */}
        <section id="order-sample" className="mt-16 scroll-mt-24 border-t border-[#E5E0D8] pt-12 sm:mt-20 sm:pt-16">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Catalogue sample</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Want to check the garment first?</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-[var(--text-primary)]/60">
                Order a catalogue sample to review the blank garment, fabric, construction and fit before starting a custom production order.
              </p>
              <div className="mt-6">
                <p className="text-2xl font-bold text-[var(--text-primary)]">₹{product.price.toLocaleString('en-IN')}</p>
                <p className="mt-1 text-xs text-[var(--text-primary)]/40">Catalogue sample price per piece</p>
              </div>
            </div>

            <div className="techpack-panel rounded-[4px] border p-5 sm:p-6">
              {product.sizes.length > 1 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/40">Choose sample size</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.sizes.map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => { setSelectedSize(size); setError('') }}
                        className={`min-h-11 min-w-12 rounded-[4px] border px-3 text-sm font-medium transition-colors ${selectedSize === size ? 'techpack-selected' : 'techpack-control text-[var(--text-primary)] hover:!border-[var(--color-accent)] hover:text-[var(--color-accent)]'}`}
                      >
                        {displaySize(size)}
                      </button>
                    ))}
                  </div>
                  {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/40">Size</p>
                  <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{displaySize(product.sizes[0])}</p>
                </div>
              )}

              <div className="mt-6 border-t border-[#E5E0D8] pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/40">Quantity</p>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-lg">−</button>
                  <span className="w-8 text-center text-sm font-semibold text-[var(--text-primary)]">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(value => Math.min(MAX_SAMPLE_ITEM_QUANTITY, value + 1))} disabled={quantity >= MAX_SAMPLE_ITEM_QUANTITY} className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-lg disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={handleAdd} className="min-h-12 rounded-[4px] border border-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white">
                  {added ? 'Added to sample cart' : 'Add sample to cart'}
                </button>
                <button type="button" onClick={handleBuyNow} className="min-h-12 rounded-[4px] bg-[var(--text-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
                  Buy sample now
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Make it yours */}
        <section className="mt-16 overflow-hidden rounded-[4px] border border-[#E5E0D8] bg-[var(--color-cream-soft)] px-5 py-8 sm:mt-20 sm:px-8 sm:py-10 lg:px-10" aria-labelledby="make-it-yours-title">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Custom production</p>
            <h2 id="make-it-yours-title" className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Make it yours</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-primary)]/60">You have already chosen the garment. Continue directly into Studio and build the custom order from here.</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Choose garment colour', 'Select the garment colour available for this product and your project.'],
              ['02', 'Add your artwork', 'Set up Screen Print, DTF or Reflective Print artwork and placement.'],
              ['03', 'Finalise quantities & sizes', 'Review the order quantity and size breakdown before checkout.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="rounded-[4px] border border-[#DED8CF] bg-white/45 p-5">
                <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--color-accent)]">{number}</span>
                <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]/55">{copy}</p>
              </div>
            ))}
          </div>
          <Link href={configuratorHref} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)]">
            Start customising <ArrowRight size={15} />
          </Link>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section id="compare-similar" className="mt-16 scroll-mt-24 border-t border-[#E5E0D8] pt-12 sm:mt-20 sm:pt-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">Product comparison</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Compare similar options</h2>
              </div>
              <p className="text-sm text-[var(--text-primary)]/50">Current: <span className="font-semibold text-[var(--text-primary)]">{productFabricFeel(product)} · {productFitLabel(product)}</span></p>
            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {related.map(relatedProduct => (
                <Link key={relatedProduct.id} href={`/products/${relatedProduct.slug}`} className="techpack-panel group overflow-hidden rounded-[4px] border transition hover:-translate-y-0.5 hover:!border-[var(--color-accent)]/40">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-cream-soft)]">
                    {relatedProduct.image ? (
                      <Image src={relatedProduct.image} alt={productImageAlt(relatedProduct)} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-[var(--text-primary)]/20">Product photo</div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:underline">{relatedProduct.name}</h3>
                    <p className="mt-1.5 text-xs font-medium text-[var(--text-primary)]/45">{productFabricFeel(relatedProduct)} · {productFitLabel(relatedProduct)}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-primary)]/60">{relatedProduct.selectorDescription}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">View product <ArrowRight size={13} /></span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Secondary information */}
        <section className="mt-12 border-t border-[#E5E0D8] pt-8 sm:mt-16">
          <details className="group border-b border-[#E5E0D8]">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-semibold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
              Care instructions
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid gap-2 pb-5 sm:grid-cols-2">
              {product.careInstructions.map(instruction => (
                <li key={instruction} className="text-sm text-[var(--text-primary)]/60">— {instruction}</li>
              ))}
            </ul>
          </details>
        </section>
      </main>
    </div>
  )
}
