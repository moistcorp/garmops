"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CircleHelp, Clock3, PackageCheck, Truck } from "lucide-react";
import { products } from "@/lib/products";
import {
  DELIVERY_DAYS,
  RUSH_DELIVERY_DAYS,
  VOLUME_DISCOUNT_TIERS,
} from "@/lib/pricingRules";
import { formatGstRate } from "@/lib/tax";
import { formatInr, getConfiguredPricingSummary } from "@/lib/configurator/pricing";

function quantityLabel(tier: (typeof VOLUME_DISCOUNT_TIERS)[number]) {
  return tier.maxQty === null ? `${tier.minQty}+` : `${tier.minQty}–${tier.maxQty}`;
}

export default function PricingClient() {
  const [productId, setProductId] = useState(products[0]?.slug ?? "");
  const [quantity, setQuantity] = useState(50);
  const [rush, setRush] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const productPickerRef = useRef<HTMLDivElement>(null);
  const productPickerButtonRef = useRef<HTMLButtonElement>(null);
  const product = products.find((item) => item.slug === productId) ?? products[0];
  const minimumQuantity = product?.minimumOrderQuantity ?? 50;
  const safeQuantity = Math.max(minimumQuantity, Number.isFinite(quantity) ? Math.floor(quantity) : minimumQuantity);
  const estimate = useMemo(
    () => getConfiguredPricingSummary(productId, undefined, {}, undefined, safeQuantity, rush),
    [productId, rush, safeQuantity],
  );
  const volumeSavings = estimate.discountAmount;
  const rushFee = rush ? safeQuantity * 75 : 0;
  const designHref = `/configurator/build/${encodeURIComponent(productId)}`;

  useEffect(() => {
    if (!productPickerOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!productPickerRef.current?.contains(event.target as Node)) {
        setProductPickerOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setProductPickerOpen(false);
      productPickerButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [productPickerOpen]);

  function selectProduct(nextProductId: string) {
    const next = products.find((item) => item.slug === nextProductId);
    setProductId(nextProductId);
    setQuantity((current) => Math.max(current, next?.minimumOrderQuantity ?? 50));
    setProductPickerOpen(false);
    productPickerButtonRef.current?.focus();
  }

  return (
    <main className="techpack-canvas">
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Pricing, made practical</p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
              See the order math before you start production.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-primary)]/65 sm:text-lg sm:leading-8">
              Start with the garment and quantity. Your configurator shows the same volume discount, rush fee and GST treatment as checkout, then adds only the choices you make.
            </p>
          </div>
          <div className="techpack-panel rounded-[4px] border p-5 text-sm leading-6 text-[var(--text-primary)]/65">
            <p className="font-semibold text-[var(--text-primary)]">A clear starting estimate</p>
            <p className="mt-2">This calculator covers the blank garment, volume pricing, optional rush production and GST. Custom dye, artwork on either side and a custom label are shown in Studio after you select them.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-10">
          <section className="techpack-surface rounded-[4px] border p-5 sm:p-7" aria-label="Starting estimate controls">
            <div>
              <p id="pricing-product-label" className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/45">1. Choose a product</p>
              <div ref={productPickerRef} className="relative mt-3">
                <button
                  ref={productPickerButtonRef}
                  type="button"
                  aria-labelledby="pricing-product-label pricing-selected-product"
                  aria-haspopup="listbox"
                  aria-expanded={productPickerOpen}
                  aria-controls="pricing-product-options"
                  onClick={() => setProductPickerOpen((open) => !open)}
                  className="techpack-control flex min-h-[68px] w-full items-center gap-3 rounded-[4px] border p-2.5 text-left outline-none transition-colors hover:!border-[var(--color-accent)] focus:!border-[var(--color-accent)]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-white">
                    {product?.icon && <Image src={product.icon} alt="" width={38} height={38} className="h-9 w-9 object-contain" />}
                  </span>
                  <span id="pricing-selected-product" className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{product?.name}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--text-primary)]/50">{product?.gsm} GSM · {product?.selectorMaterial}</span>
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 shrink-0 text-[var(--text-primary)]/45 transition-transform ${productPickerOpen ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                </button>
                {productPickerOpen && (
                  <div id="pricing-product-options" role="listbox" aria-labelledby="pricing-product-label" className="techpack-surface absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-[4px] border p-1.5 shadow-xl">
                    {products.map((item) => {
                      const selected = item.slug === productId;
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectProduct(item.slug)}
                          className={`flex w-full items-center gap-3 rounded-[3px] p-2.5 text-left transition-colors ${selected ? "bg-[var(--color-cream-soft)]" : "hover:bg-[var(--color-cream-soft)]/70"}`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-[var(--color-rule)] bg-white">
                            <Image src={item.icon} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                          </span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</span><span className="mt-0.5 block truncate text-xs text-[var(--text-primary)]/50">{item.gsm} GSM · {item.selectorDescription}</span></span>
                          {selected && <Check size={16} className="shrink-0 text-[var(--color-accent)]" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--text-primary)]/50">Custom production starts from {minimumQuantity} pieces of this configured product.</p>
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor="pricing-quantity" className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]/45">2. Enter quantity</label>
                <div className="flex items-center rounded-[4px] border border-[var(--color-rule)] bg-white px-3 py-2">
                  <input
                    id="pricing-quantity"
                    type="number"
                    min={minimumQuantity}
                    max={1_000_000}
                    value={safeQuantity}
                    onChange={(event) => setQuantity(Number(event.target.value))}
                    className="w-20 appearance-none bg-transparent text-right font-mono text-sm font-semibold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="ml-2 text-xs text-[var(--text-primary)]/45">pcs</span>
                </div>
              </div>
              <input
                type="range"
                min={minimumQuantity}
                max={1000}
                step={50}
                value={Math.min(safeQuantity, 1000)}
                onChange={(event) => setQuantity(Number(event.target.value))}
                aria-label="Quantity"
                className="mt-5 w-full accent-[var(--color-accent)]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-[var(--text-primary)]/40"><span>{minimumQuantity} pcs</span><span>1,000 pcs</span></div>
            </div>

            <div className="mt-8 border-t border-[var(--color-rule)] pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Rush production</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-primary)]/55">Target {RUSH_DELIVERY_DAYS} days instead of {DELIVERY_DAYS} days, subject to the finished specification and destination.</p>
                </div>
                <button type="button" role="switch" aria-checked={rush} onClick={() => setRush((value) => !value)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${rush ? "bg-[var(--color-accent)]" : "bg-[#DAD6D0]"}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${rush ? "left-6" : "left-1"}`} />
                </button>
              </div>
              {rush && <p className="mt-3 rounded-[4px] bg-[var(--color-cream-soft)] px-3 py-2 text-xs text-[var(--text-primary)]/65">+₹75 per piece before GST · {formatInr(rushFee)} for this quantity</p>}
            </div>
          </section>

          <section className="techpack-dark rounded-[4px] border p-5 text-white sm:p-8" aria-live="polite">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Starting estimate</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{product?.name}</h2>
            <p className="mt-1 text-sm text-white/55">{safeQuantity.toLocaleString("en-IN")} pieces · {rush ? `${RUSH_DELIVERY_DAYS}-day rush target` : `${DELIVERY_DAYS}-day standard target`}</p>
            <div className="mt-7 space-y-3 border-y border-white/10 py-5 text-sm">
              <PriceRow label="Starting garment price" value={`${formatInr(estimate.undiscountedUnitPrice)} / piece`} />
              {volumeSavings > 0 && <PriceRow label={`Volume discount (${estimate.discountPercent}%)`} value={`− ${formatInr(volumeSavings)}`} />}
              {rush && <PriceRow label="Rush production" value={`+ ${formatInr(rushFee)}`} />}
              <PriceRow label="Subtotal before GST" value={formatInr(estimate.taxableSubtotal)} />
              <PriceRow label={`GST (${formatGstRate()})`} value={formatInr(estimate.gst)} />
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div><p className="text-sm font-semibold">Estimated total</p><p className="mt-1 text-xs text-white/45">GST included · free shipping</p></div>
              <p className="font-mono text-2xl font-bold">{formatInr(estimate.total)}</p>
            </div>
            <Link href={designHref} className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-navy)] transition hover:bg-[#F4F1EB]">Configure this product <ArrowRight size={16} /></Link>
          </section>
        </div>
      </section>

      <section className="techpack-section">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-3xl"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">What changes your price</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">No hidden production assumptions.</h2><p className="mt-4 text-sm leading-7 text-[var(--text-primary)]/60 sm:text-base">The estimate above intentionally starts simple. Studio makes each production choice visible before checkout.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              [PackageCheck, "Garment", "Fabric weight, fit and product determine the starting unit price."],
              [Check, "Artwork", "Screen Print, DTF or Reflective Print is priced when you choose the technique and placement."],
              [CircleHelp, "Custom details", "Custom dye, back artwork and a custom label update the configured price before checkout."],
              [Truck, "Delivery & shipping", "Rush production is +₹75 per unit before GST. Shipping is free."],
            ].map(([Icon, title, description]) => <article key={String(title)} className="techpack-panel rounded-[4px] border p-5"><Icon size={18} className="text-[var(--color-accent)]" /><h3 className="mt-5 text-base font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-primary)]/60">{String(description)}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Volume pricing</p><h2 className="mt-3 text-3xl font-bold tracking-tight">More units, lower garment cost.</h2><p className="mt-4 text-sm leading-7 text-[var(--text-primary)]/60">Discounts apply independently to each configured product line, so the quantities and specifications stay clear at checkout.</p></div><div className="overflow-hidden rounded-[4px] border border-[var(--color-rule)]">{VOLUME_DISCOUNT_TIERS.map((tier) => <div key={tier.minQty} className={`flex items-center justify-between px-5 py-4 text-sm ${safeQuantity >= tier.minQty && (tier.maxQty === null || safeQuantity <= tier.maxQty) ? "bg-[var(--color-cream-soft)] font-semibold text-[var(--color-accent-dark)]" : "border-t border-[var(--color-rule)] first:border-t-0 text-[var(--text-primary)]/65"}`}><span>{quantityLabel(tier)} pieces</span><span>{tier.discountPercent ? `${tier.discountPercent}% off` : "Starting price"}</span></div>)}</div></div>
      </section>

      <section className="bg-[var(--color-navy)]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 text-white sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-white/55"><Clock3 size={16} /><span className="font-mono text-[10px] uppercase tracking-[0.14em]">Ready when your brief is</span></div><h2 className="mt-3 text-3xl font-bold tracking-tight">Build the exact order next.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Choose the garment, colour, artwork and size split. You will see the exact configuration total before payment.</p></div><Link href="/products" className="rounded-[4px] bg-white px-6 py-3.5 text-center text-sm font-semibold text-[var(--color-navy)] transition hover:bg-[#F4F1EB]">Browse products</Link></div></section>
    </main>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-white/60">{label}</span><span className="font-mono text-right">{value}</span></div>;
}
