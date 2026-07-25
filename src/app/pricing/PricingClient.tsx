'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
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
    <>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Pricing</p>
        <h1 className="text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-4 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">
          All prices include fabric, stitching, single-color screen print, neck label, and our margin. Shipping Charges Excluded.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-12">

          {/* Controls */}
          <div className="flex flex-col gap-8">

            {/* Product */}
            <div>
              <label className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest block mb-3">
                Select product
              </label>
              <div className="overflow-hidden rounded-2xl border border-[#ECE7DF] bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
                {/* Selected product — always visible */}
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center gap-4 px-4 py-4 bg-[var(--color-cream-soft)] hover:bg-[var(--color-cream)] transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-white border border-[#ECE7DF] rounded-xl flex items-center justify-center shrink-0">
                    <Image src={selectedProduct.icon} alt={selectedProduct.name} width={36} height={36} className="object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] leading-snug">{selectedProduct.name}</p>
                    <p className="text-xs text-[#111111]/50 mt-0.5 line-clamp-1">{selectedProduct.description}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-[#111111]/40 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown options */}
                {dropdownOpen && (
                  <div className="border-t border-[#ECE7DF]">
                    {productList.filter(p => p.name !== selected).map((p, i, arr) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => { setSelected(p.name); setDropdownOpen(false) }}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--color-cream)] transition-colors text-left ${i < arr.length - 1 ? 'border-b border-[#ECE7DF]' : ''}`}
                      >
                        <div className="w-10 h-10 bg-[var(--color-cream-soft)] border border-[#ECE7DF] rounded-lg flex items-center justify-center shrink-0">
                          <Image src={p.icon} alt={p.name} width={30} height={30} className="object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#111111] leading-snug">{p.name}</p>
                          <p className="text-xs text-[#111111]/40 mt-0.5 line-clamp-1">{p.description}</p>
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
                <label className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest">
                  Quantity
                </label>
                <span className="text-sm font-bold text-[#111111]">{qty} pcs</span>
              </div>
              <input
                type="range" min={50} max={1000} step={50} value={qty}
                onChange={e => setQty(Number(e.target.value))}
                onInput={e => setQty(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-[var(--color-teal)]"
              />
              <div className="flex justify-between text-xs text-[#111111]/30 mt-1">
                <span>50 pcs</span><span>1000 pcs</span>
              </div>
            </div>

            {/* Rush order toggle */}
            <div className="rounded-2xl border border-[#ECE7DF] bg-white p-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">Rush order</p>
                  <p className="text-xs text-[#111111]/50 mt-0.5">
                    Delivery in {RUSH_DELIVERY_DAYS} days instead of {DELIVERY_DAYS}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRush(!rush)}
                  role="switch"
                  aria-checked={rush}
                  aria-label="Rush order"
                  className={`relative w-11 h-6 rounded-full transition-colors ${rush ? 'bg-[var(--color-teal)]' : 'bg-[#E5E5E5]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${rush ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {rush && (
                <p className="text-xs text-[#111111]/50 mt-2 pt-2 border-t border-[#ECE7DF]">
                  Rush premium: +&#8377;{getRushCharge(qty)}/piece (&#8377;{rushChargeTotal.toLocaleString('en-IN')} total)
                </p>
              )}
            </div>

            {/* Volume tiers */}
            <div>
              <p className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest mb-3">
                Volume discounts
              </p>
              <div className="flex flex-col rounded-2xl border border-[#ECE7DF] overflow-hidden shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
                {VOLUME_TIERS.map(t => (
                  <div
                    key={t.min}
                    className={`flex justify-between text-xs px-4 py-3 border-b border-[#ECE7DF] last:border-0 transition-colors ${
                      getDiscount(qty) === t.discount ? 'bg-[var(--color-teal)] text-white' : 'text-[#111111]/40'
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
                <p className="text-xs font-medium text-[#111111]/50 uppercase tracking-widest mb-3">
                  Rush premiums (per piece)
                </p>
                <div className="flex flex-col rounded-2xl border border-[#ECE7DF] overflow-hidden shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
                  {RUSH_TIERS.map(t => (
                    <div
                      key={t.min}
                      className={`flex justify-between text-xs px-4 py-3 border-b border-[#ECE7DF] last:border-0 transition-colors ${
                        getRushCharge(qty) === t.charge && qty >= t.min && qty <= t.max
                          ? 'bg-[var(--color-teal)] text-white'
                          : 'text-[#111111]/40'
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
            <div className="bg-[var(--color-navy)] rounded-3xl p-8 text-white">
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
                <div className="flex justify-between text-xl font-bold border-t border-white/10 pt-4 mt-1">
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

              <p className="text-xs text-white/20 mt-5 leading-relaxed">
                Includes single-color screen print. Multi-color, embroidery, or DTG quoted separately.
              </p>
            </div>

            <Link
              href="/contact"
              className="bg-[var(--color-teal)] text-white text-sm font-medium px-6 py-4 rounded-full text-center hover:bg-[var(--color-teal-dark)] transition"
            >
              Get a firm quote
            </Link>
            <Link
              href="/configurator"
              className="border border-[var(--color-teal)] text-[var(--color-teal)] text-sm font-medium px-6 py-4 rounded-full text-center hover:bg-[var(--color-teal)] hover:text-white transition"
            >
              Start designing instead
            </Link>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="bg-[var(--color-cream)] border-t border-[#ECE7DF] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-2 tracking-tight">What&apos;s included in every order</h2>
          <p className="text-[#111111]/50 text-sm mb-8">All prices already include the following. No surprises at invoice.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Fabric & stitching', desc: 'Premium blanks cut and sewn at our Greater Noida facility' },
              { title: 'Single-color print', desc: 'Screen print setup and execution included in base price' },
              { title: 'Neck label', desc: 'Basic neck label included. Woven/custom labels quoted separately' },
              { title: 'QA & packing', desc: 'Every piece inspected and individually packed before dispatch' },
            ].map(i => (
              <div key={i.title} className="rounded-2xl border border-[#ECE7DF] bg-white p-5 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
                <p className="font-semibold text-sm mb-1">{i.title}</p>
                <p className="text-xs text-[#111111]/50 leading-relaxed">{i.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#ECE7DF] bg-white p-5 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
            <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-3">Not included — quoted separately</p>
            <div className="grid md:grid-cols-3 gap-4 text-xs text-[#111111]/60">
              <p>Multi-color screen print (additional per color)</p>
              <p>DTG printing (quoted per design)</p>
              <p>Embroidery (quoted per stitch count)</p>
              <p>Custom woven / printed neck labels</p>
              <p>Shipping (paid by client, quoted by email)</p>
              <p>GST 5% (added at invoice stage)</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
