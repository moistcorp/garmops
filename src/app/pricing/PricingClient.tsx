'use client'

import NumberFlow from '@number-flow/react'
import { Select } from '@base-ui/react/select'
import { Switch } from '@base-ui/react/switch'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { products } from '@/lib/products'
import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS, VOLUME_DISCOUNT_TIERS } from '@/lib/pricingRules'
import { formatInr, getConfiguredPricingSummary } from '@/lib/configurator/pricing'

const MAX_ESTIMATE_QUANTITY = 5_000

const productItems = products.map(product => ({ label: product.name, value: product.slug }))

function quantityLabel(tier: (typeof VOLUME_DISCOUNT_TIERS)[number]) {
  return tier.maxQty === null ? `${tier.minQty}+` : `${tier.minQty}–${tier.maxQty}`
}

export default function PricingClient() {
  const [productId, setProductId] = useState(products[0]?.slug ?? '')
  const [quantity, setQuantity] = useState(50)
  const [rush, setRush] = useState(false)
  const product = products.find(item => item.slug === productId) ?? products[0]
  const minimumQuantity = product?.minimumOrderQuantity ?? 50
  const safeQuantity = Math.min(MAX_ESTIMATE_QUANTITY, Math.max(minimumQuantity, Number.isFinite(quantity) ? Math.floor(quantity) : minimumQuantity))
  const estimate = useMemo(
    () => getConfiguredPricingSummary(productId, undefined, {}, undefined, safeQuantity, rush),
    [productId, rush, safeQuantity],
  )
  const rushFee = rush ? safeQuantity * 75 : 0
  const effectiveUnitPrice = estimate.total / safeQuantity
  const designHref = `/configurator/build/${encodeURIComponent(productId)}?quantity=${safeQuantity}&rush=${rush ? '1' : '0'}`

  function selectProduct(nextProductId: string) {
    const next = products.find(item => item.slug === nextProductId)
    setProductId(nextProductId)
    setQuantity(current => Math.max(current, next?.minimumOrderQuantity ?? 50))
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24" aria-labelledby="pricing-calculator-title">
      <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-10">
        <section className="techpack-surface rounded-sm border p-5 sm:p-7" aria-label="Blank garment estimate controls">
          <h2 id="pricing-calculator-title" className="text-2xl font-bold tracking-tight text-(--text-primary)">Build a starting estimate</h2>
          <p className="mt-2 text-sm leading-6 text-(--text-muted)">Choose a blank garment, quantity and production pace. Decoration is added later in Studio.</p>

          <div className="mt-7">
            <p id="pricing-product-label" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">1. Choose a product</p>
            <Select.Root items={productItems} value={productId} onValueChange={value => value && selectProduct(value)}>
              <Select.Trigger aria-labelledby="pricing-product-label" className="techpack-control mt-3 flex min-h-[68px] w-full items-center gap-3 rounded-sm border p-2.5 text-left outline-none transition-colors hover:!border-(--color-accent) focus-visible:!border-(--color-accent)">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-(--color-rule) bg-white">
                  {product?.icon ? <Image src={product.icon} alt="" width={38} height={38} className="h-9 w-9 object-contain" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <Select.Value className="block truncate text-sm font-semibold text-(--text-primary)" />
                  <span className="mt-1 block truncate text-xs text-(--text-muted)">{product?.gsm} GSM · {product?.selectorMaterial}</span>
                </span>
                <Select.Icon><ChevronDown size={16} className="text-(--text-muted) transition-transform data-popup-open:rotate-180" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50 outline-none" sideOffset={6} alignItemWithTrigger={false}>
                  <Select.Popup className="techpack-surface max-h-[min(420px,var(--available-height))] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-sm border p-1.5 shadow-xl outline-none transition-[transform,opacity] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
                    <Select.List className="max-h-[min(400px,var(--available-height))] overflow-y-auto">
                      {products.map(item => (
                        <Select.Item key={item.slug} value={item.slug} className="grid cursor-default grid-cols-[2.5rem_1fr_1rem] items-center gap-3 rounded-[3px] p-2.5 text-left outline-none data-highlighted:bg-(--color-cream-soft) data-selected:bg-(--color-cream-soft)">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-(--color-rule) bg-white"><Image src={item.icon} alt="" width={32} height={32} className="h-8 w-8 object-contain" /></span>
                          <span className="min-w-0"><Select.ItemText className="block truncate text-sm font-semibold text-(--text-primary)">{item.name}</Select.ItemText><span className="mt-0.5 block truncate text-xs text-(--text-muted)">{item.gsm} GSM · {item.selectorDescription}</span></span>
                          <Select.ItemIndicator><Check size={16} className="text-(--color-accent)" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <p className="mt-2 text-xs text-(--text-muted)">Custom production starts from {minimumQuantity} pieces of this product.</p>
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="pricing-quantity" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">2. Enter quantity</label>
              <div className="flex items-center rounded-sm border border-(--color-rule) bg-white px-3 py-2">
                <input id="pricing-quantity" type="number" min={minimumQuantity} max={MAX_ESTIMATE_QUANTITY} value={safeQuantity} onChange={event => setQuantity(Number(event.target.value))} className="w-20 appearance-none bg-transparent text-right font-mono text-sm font-semibold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                <span className="ml-2 text-xs text-(--text-muted)">pcs</span>
              </div>
            </div>
            <input type="range" min={minimumQuantity} max={MAX_ESTIMATE_QUANTITY} step={50} value={safeQuantity} onChange={event => setQuantity(Number(event.target.value))} aria-label="Quantity" className="mt-5 w-full accent-(--color-accent)" />
            <div className="mt-1 flex justify-between text-xs text-(--text-muted)"><span>{minimumQuantity} pcs</span><span>{MAX_ESTIMATE_QUANTITY.toLocaleString('en-IN')} pcs</span></div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Popular quantities">
              {VOLUME_DISCOUNT_TIERS.map(tier => (
                <button key={tier.minQty} type="button" onClick={() => setQuantity(tier.minQty)} aria-pressed={safeQuantity === tier.minQty} className="rounded-sm border border-(--color-rule) bg-white px-3 py-2 text-xs font-medium text-(--text-primary)/70 transition hover:border-(--color-accent) aria-pressed:border-(--color-accent) aria-pressed:text-(--color-accent-dark)">
                  {tier.minQty.toLocaleString('en-IN')}{tier.discountPercent ? ` · ${tier.discountPercent}% off` : ''}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-(--text-muted)">Need more than 5,000 pieces? <Link href="/contact" className="underline underline-offset-2">Ask for a production quote.</Link></p>
          </div>

          <div className="mt-8 border-t border-(--color-rule) pt-6">
            <div className="flex items-start justify-between gap-4">
              <label htmlFor="pricing-rush" className="cursor-pointer">
                <span className="block font-semibold text-(--text-primary)">Rush production</span>
                <span className="mt-1 block text-xs leading-5 text-(--text-muted)">Target {RUSH_DELIVERY_DAYS} days instead of {DELIVERY_DAYS} days, subject to the finished specification and destination.</span>
              </label>
              <Switch.Root id="pricing-rush" checked={rush} onCheckedChange={setRush} className="relative h-7 w-12 shrink-0 rounded-full bg-[#DAD6D0] transition-colors data-checked:bg-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)">
                <Switch.Thumb className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-checked:translate-x-5" />
              </Switch.Root>
            </div>
            {rush ? <p className="mt-3 rounded-sm bg-(--color-cream-soft) px-3 py-2 text-xs text-(--text-primary)/65">+₹75 per piece before GST · {formatInr(rushFee)} for this quantity</p> : null}
          </div>
        </section>

        <div>
          <section className="techpack-dark rounded-sm border p-5 text-white sm:p-8 lg:sticky lg:top-24">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Blank garment estimate</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{product?.name}</h2>
            <p className="mt-1 text-sm text-white/65">{safeQuantity.toLocaleString('en-IN')} pieces · {rush ? `${RUSH_DELIVERY_DAYS}-day rush target` : `${DELIVERY_DAYS}-day standard target`}</p>
            <div className="mt-7 space-y-3 border-y border-white/10 py-5 text-sm">
              <PriceRow label="Catalogue garment price" value={`${formatInr(estimate.undiscountedUnitPrice)} / piece`} />
              {estimate.discountAmount > 0 ? <PriceRow label={`Volume discount (${estimate.discountPercent}%)`} value={`− ${formatInr(estimate.discountAmount)}`} /> : null}
              {rush ? <PriceRow label="Rush production" value={`+ ${formatInr(rushFee)}`} /> : null}
              <PriceRow label="Subtotal before GST" value={formatInr(estimate.taxableSubtotal)} />
              <PriceRow label="GST (5% / 12% as applicable)" value={formatInr(estimate.gst)} />
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div><p className="text-sm font-semibold">Estimated garment total</p><p className="mt-1 text-xs text-white/65">GST included · free shipping</p></div>
              <p className="font-mono text-2xl font-bold" aria-live="polite"><NumberFlow value={estimate.total} format={{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }} /></p>
            </div>
            <p className="mt-3 text-xs text-white/65">Effective total: {formatInr(effectiveUnitPrice)} per piece. Artwork, print placement, custom dye and labels are added in Studio.</p>
            <Link href={designHref} className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-sm bg-white px-5 py-3 text-sm font-semibold text-(--color-navy) transition hover:bg-[#F4F1EB]">Continue in Studio <ArrowRight size={16} /></Link>
          </section>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-(--color-accent)">Volume pricing</p><h2 className="mt-3 text-3xl font-bold tracking-tight">More units, lower garment cost.</h2><p className="mt-4 text-sm leading-7 text-(--text-primary)/60">Discounts apply to each configured product line. Select a tier to compare it in the calculator.</p></div>
        <div className="overflow-hidden rounded-sm border border-(--color-rule)">{VOLUME_DISCOUNT_TIERS.map(tier => {
          const active = safeQuantity >= tier.minQty && (tier.maxQty === null || safeQuantity <= tier.maxQty)
          return <button key={tier.minQty} type="button" onClick={() => setQuantity(tier.minQty)} aria-pressed={active} className={`flex w-full items-center justify-between px-5 py-4 text-left text-sm ${active ? 'bg-(--color-cream-soft) font-semibold text-(--color-accent-dark)' : 'border-t border-(--color-rule) first:border-t-0 text-(--text-primary)/65 hover:bg-(--color-cream-soft)/60'}`}><span>{quantityLabel(tier)} pieces</span><span>{tier.discountPercent ? `${tier.discountPercent}% off` : 'Catalogue price'}</span></button>
        })}</div>
      </div>
    </section>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-white/60">{label}</span><span className="font-mono text-right">{value}</span></div>
}
