'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  PRODUCT_PRICES,
  VOLUME_TIERS,
  RUSH_TIERS,
  getDiscount,
  getRushCharge,
  calcOrder,
  DELIVERY_DAYS,
  RUSH_DELIVERY_DAYS,
} from '@/lib/pricing'
import { products } from '@/lib/products'

const productList = products.map(p => ({ name: p.pricingKey, base: p.price, icon: p.icon, description: p.description }))

export default function PricingClient() {
  const [qty, setQty] = useState<number>(50)
  const [selected, setSelected] = useState<string>(productList[0].name)
  const [rush, setRush] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setDropdownOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDropdownOpen(false)
      dropdownButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dropdownOpen])

  const selectedProduct = productList.find(p => p.name === selected) ?? productList[0]
  const {
    discount,
    discountAmountPerPiece,
    rushCharge,
    pricePerPiece,
    subtotal,
    gst,
    total,
  } = calcOrder(selected, qty, rush)
  const deliveryDays = rush ? RUSH_DELIVERY_DAYS : DELIVERY_DAYS
  const rushChargeTotal = rushCharge * qty

  return (
    <div className="techpack-canvas">
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-20">
        <p className="text-xs text-[var(--text-primary)]/40 font-medium mb-4 tracking-widest uppercase">Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] max-w-xl leading-tight mb-4 tracking-tight">
          Bulk custom apparel pricing
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-[var(--text-primary)]/50 sm:text-lg">
          Base prices include fabric, stitching, single-color screen print, neck label, and our margin. The estimate shows GST separately and includes it in the final total. Shipping is excluded.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">

          {/* Controls */}
          <div className="flex flex-col gap-8">

            {/* Product */}
            <div>
              <label className="text-xs font-medium text-[var(--text-primary)]/50 uppercase tracking-widest block mb-3">
                Select product
              </label>
              <div ref={dropdownRef} className="techpack-surface overflow-hidden rounded-[4px] border">
                {/* Selected product — always visible */}
                <button
                  ref={dropdownButtonRef}
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                  aria-controls="pricing-product-options"
                  aria-haspopup="listbox"
                  className="flex w-full items-center gap-4 bg-white/20 px-4 py-4 text-left transition-colors hover:bg-white/35"
                >
                  <div className="techpack-control flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] border">
                    <Image src={selectedProduct.icon} alt={selectedProduct.name} width={36} height={36} className="object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{selectedProduct.name}</p>
                    <p className="text-xs text-[var(--text-primary)]/50 mt-0.5 line-clamp-1">{selectedProduct.description}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-[var(--text-primary)]/40 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown options */}
                {dropdownOpen && (
                  <div id="pricing-product-options" role="listbox" aria-label="Products" className="border-t border-white/60 bg-white/10">
                    {productList.filter(p => p.name !== selected).map((p, i, arr) => (
                      <button
                        key={p.name}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => { setSelected(p.name); setDropdownOpen(false); dropdownButtonRef.current?.focus() }}
                        className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/35 ${i < arr.length - 1 ? 'border-b border-white/55' : ''}`}
                      >
                        <div className="techpack-control flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border">
                          <Image src={p.icon} alt={p.name} width={30} height={30} className="object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{p.name}</p>
                          <p className="text-xs text-[var(--text-primary)]/40 mt-0.5 line-clamp-1">{p.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-medium text-[var(--text-primary)]/50 uppercase tracking-widest">
                  Quantity
                </label>
                <span className="text-sm font-bold text-[var(--text-primary)]">{qty} pcs</span>
              </div>
              <input
                type="range" min={50} max={1000} step={50} value={qty}
                onChange={e => setQty(Number(e.target.value))}
                onInput={e => setQty(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-[var(--color-accent)]"
              />
              <div className="flex justify-between text-xs text-[var(--text-primary)]/30 mt-1">
                <span>50 pcs</span><span>1000 pcs</span>
              </div>
            </div>

            {/* Rush order toggle */}
            <div className="techpack-panel rounded-[4px] border p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Rush order</p>
                  <p className="text-xs text-[var(--text-primary)]/50 mt-0.5">
                    Delivery in {RUSH_DELIVERY_DAYS} days instead of {DELIVERY_DAYS}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRush(!rush)}
                  role="switch"
                  aria-checked={rush}
                  aria-label="Rush order"
                  className={`relative h-6 w-11 shrink-0 rounded-[4px] transition-colors ${rush ? 'bg-[var(--color-accent)]' : 'bg-[#E5E5E5]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-[4px] transition-all ${rush ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {rush && (
                <p className="text-xs text-[var(--text-primary)]/50 mt-2 pt-2 border-t border-[#ECE7DF]">
                  Rush premium: +&#8377;{getRushCharge(qty)}/piece (&#8377;{rushChargeTotal.toLocaleString('en-IN')} total)
                </p>
              )}
            </div>

            {/* Volume tiers */}
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]/50 uppercase tracking-widest mb-3">
                Volume discounts
              </p>
              <div className="techpack-panel flex flex-col overflow-hidden rounded-[4px] border">
                {VOLUME_TIERS.map(t => (
                  <div
                    key={t.min}
                    className={`flex justify-between border-b border-white/55 px-4 py-3 text-xs transition-colors last:border-0 ${
                      getDiscount(qty) === t.discount ? 'techpack-selected text-white' : 'text-[var(--text-primary)]/50'
                    }`}
                  >
                    <span>{t.min}{t.max === Infinity ? '+' : `–${t.max}`} pcs</span>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rush tiers — shown when rush is on */}
            {rush && (
              <div>
                <p className="text-xs font-medium text-[var(--text-primary)]/50 uppercase tracking-widest mb-3">
                  Rush premiums (per piece)
                </p>
                <div className="techpack-panel flex flex-col overflow-hidden rounded-[4px] border">
                  {RUSH_TIERS.map(t => (
                    <div
                      key={t.min}
                      className={`flex justify-between border-b border-white/55 px-4 py-3 text-xs transition-colors last:border-0 ${
                        getRushCharge(qty) === t.charge && qty >= t.min && qty <= t.max
                          ? 'techpack-selected text-white'
                          : 'text-[var(--text-primary)]/50'
                      }`}
                    >
                      <span>{t.min}{t.max === Infinity ? '+' : `–${t.max}`} pcs</span>
                      <span>+&#8377;{t.charge}/pc</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Output */}
          <div className="flex flex-col gap-4">
            <div className="techpack-dark rounded-[4px] border p-5 text-white sm:rounded-[4px] sm:p-8">
              <p className="text-xs text-white/50 mb-1 uppercase tracking-widest">Estimate for</p>
              <p className="text-base font-semibold mb-1">{selected}</p>
              <p className="text-xs text-white/40 mb-6">{qty} pieces &middot; {deliveryDays}-day delivery</p>

              <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Base price/piece</span>
                  <span>&#8377;{(PRODUCT_PRICES[selected] ?? 0).toLocaleString('en-IN')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Volume discount ({(discount * 100).toFixed(0)}%)</span>
                    <span className="text-white">
                      -&#8377;{Math.round(discountAmountPerPiece).toLocaleString('en-IN')}/pc
                    </span>
                  </div>
                )}
                {rush && rushCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Rush premium</span>
                    <span>+&#8377;{rushCharge}/pc</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium border-t border-white/10 pt-3 mt-1">
                  <span className="text-white/80">Price per piece</span>
                  <span>&#8377;{pricePerPiece.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Subtotal ({qty} pcs)</span>
                  <span>&#8377;{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">GST (5%)</span>
                  <span>&#8377;{gst.toLocaleString('en-IN')}</span>
                </div>
                <div className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-4 text-xl font-bold min-[360px]:flex-row min-[360px]:justify-between">
                  <span>Total (incl. GST)</span>
                  <span>&#8377;{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-white/10 flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Delivery timeline</span>
                  <span className="text-white/70">{deliveryDays} days from order confirmation</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Shipping</span>
                  <span className="text-white/70">Quoted separately by email</span>
                </div>
              </div>

            </div>

            <Link
              href="/contact"
              className="bg-[var(--color-accent)] text-white text-sm font-medium px-6 py-4 rounded-[4px] text-center hover:bg-[var(--color-accent-dark)] transition"
            >
              Get a firm quote
            </Link>
            <Link
              href="/configurator"
              className="border border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-medium px-6 py-4 rounded-[4px] text-center hover:bg-[var(--color-accent)] hover:text-white transition"
            >
              Start designing instead
            </Link>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="techpack-section py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-2 tracking-tight">What&apos;s included in every order</h2>
          <p className="text-[var(--text-primary)]/50 text-sm mb-8">Base prices include the following. GST is shown separately and included in the final estimated total.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Fabric & stitching', desc: 'Premium blanks cut and sewn at our Greater Noida facility' },
              { title: 'Single-color print', desc: 'Screen print setup and execution included in base price' },
              { title: 'Neck label', desc: 'Basic neck label included. Woven/custom labels quoted separately' },
              { title: 'QA & packing', desc: 'Every piece inspected and individually packed before dispatch' },
            ].map(i => (
              <div key={i.title} className="techpack-panel rounded-[4px] border p-5">
                <p className="font-semibold text-sm mb-1">{i.title}</p>
                <p className="text-xs text-[var(--text-primary)]/50 leading-relaxed">{i.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>
    </div>
  )
}
