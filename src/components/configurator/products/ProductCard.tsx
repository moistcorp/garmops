"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, GitCompareArrows, Sparkles } from "lucide-react";
import type { Product, ProductUseCase } from "@/lib/configurator/products";
import { formatInr, getBasePrice, getVolumeDiscountPercent } from "@/lib/configurator/pricing";
import { getDeliveryFeasibility } from "@/lib/configurator/deliveryFeasibility";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

function getDisplayPrice(productId: Product["id"], quantity: number): string {
  try {
    const price = getBasePrice(productId);
    const discount = getVolumeDiscountPercent(quantity);
    return `${formatInr(Math.round(price * (1 - discount / 100)))}/unit`;
  } catch {
    return "Price unavailable";
  }
}

interface ProductCardProps {
  product: Product;
  quantity: number;
  selectedUseCase: ProductUseCase | "";
  targetDate: string;
  compared: boolean;
  compareDisabled: boolean;
  onCompareChange: (selected: boolean) => void;
  recommended: boolean;
}

export default function ProductCard({
  product,
  quantity,
  selectedUseCase,
  targetDate,
  compared,
  compareDisabled,
  onCompareChange,
  recommended,
}: ProductCardProps) {
  const priceLabel = getDisplayPrice(product.id, quantity);
  const cardRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const configuratorHref = `/configurator/build/${product.id}`;
  const feasibility = useMemo(() => getDeliveryFeasibility(targetDate), [targetDate]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || hasTrackedView.current) return;
    if (!("IntersectionObserver" in window)) {
      hasTrackedView.current = true;
      trackConfiguratorEvent("product_viewed", {
        product_id: product.id,
        product_name: product.name,
      });
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || hasTrackedView.current) return;
        hasTrackedView.current = true;
        trackConfiguratorEvent("product_viewed", {
          product_id: product.id,
          product_name: product.name,
        });
        observer.disconnect();
      },
      { threshold: 0.45 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [product.id, product.name]);

  const feasibilityClass =
    feasibility.status === "comfortable"
      ? "bg-[#EAF7EA] text-[#1B6A2E]"
      : feasibility.status === "tight" || feasibility.status === "rush"
        ? "bg-[#FFF3D6] text-[#7A5400]"
        : feasibility.status === "review"
          ? "bg-[#FFF0F0] text-[#8A2E2E]"
          : "bg-[#F2F0EA] text-[#111111]/55";

  return (
    <article ref={cardRef} className={`group relative flex self-start flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)] transition-all duration-300 hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)] ${recommended ? "border-[var(--color-teal)]" : "border-[#ECE7DF] hover:border-[var(--color-teal)]"}`}>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
        <Link
          href={configuratorHref}
          onClick={() => trackConfiguratorEvent("product_selected", { product_id: product.id, quantity, use_case: selectedUseCase || null })}
          className="absolute inset-0 z-10"
          aria-label={`Customise ${product.name}`}
        >
          <span className="sr-only">Customise {product.name}</span>
        </Link>
        <Image
          src={product.defaultImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-opacity duration-300 ease-in-out group-hover:opacity-0"
        />
        <Image
          src={product.hoverImage}
          alt={`${product.name} on model`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          {recommended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-teal)] px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              <Sparkles size={12} aria-hidden="true" /> Recommended
            </span>
          ) : <span />}
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${feasibilityClass}`}>
            {targetDate ? feasibility.label : product.standardLeadTime}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={configuratorHref}
              onClick={() => trackConfiguratorEvent("product_selected", { product_id: product.id, quantity, use_case: selectedUseCase || null })}
              className="block text-sm font-semibold text-[#111111] hover:text-[var(--color-teal-dark)]"
            >
              {product.name}
            </Link>
            <p className="mt-1 text-xs text-[#111111]/55">Estimated at {quantity} units</p>
            <p className="text-sm font-semibold text-[#111111]">{priceLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls={`product-details-${product.id}`}
            aria-label={`${detailsOpen ? "Hide" : "Show"} details for ${product.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#111111]/60 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
          >
            <ChevronDown size={15} strokeWidth={2.2} className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-[#F7F7F7] p-2.5">
            <p className="font-semibold text-[#111111]">Best for</p>
            <p className="mt-0.5 leading-snug text-[#111111]/60">{product.bestFor.slice(0, 2).join(", ")}</p>
          </div>
          <div className="rounded-xl bg-[#F7F7F7] p-2.5">
            <p className="font-semibold text-[#111111]">Feel & fit</p>
            <p className="mt-0.5 leading-snug text-[#111111]/60">{product.fabricFeel} · {product.fit}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={configuratorHref}
            onClick={() => trackConfiguratorEvent("product_selected", { product_id: product.id, quantity, use_case: selectedUseCase || null })}
            className="flex min-h-10 flex-1 items-center justify-center rounded-full bg-[var(--color-teal)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)]"
          >
            Customise
          </Link>
          <button
            type="button"
            aria-pressed={compared}
            disabled={!compared && compareDisabled}
            onClick={() => onCompareChange(!compared)}
            className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${compared ? "border-[var(--color-teal)] bg-[var(--color-teal)]/10 text-[var(--color-teal-dark)]" : "border-[#E5E5E5] text-[#111111]/65 hover:border-[var(--color-teal)]"}`}
          >
            {compared ? <Check size={14} /> : <GitCompareArrows size={14} />}
            {compared ? "Added" : "Compare"}
          </button>
        </div>

        {detailsOpen && (
          <div id={`product-details-${product.id}`} className="space-y-3 border-t border-[#ECE7DF] pt-3 text-xs text-[#111111]/65">
            <p className="leading-relaxed">{product.description}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="font-semibold text-[#111111]">Fabric weight</dt><dd>{product.gsm} GSM</dd></div>
              <div><dt className="font-semibold text-[#111111]">Climate</dt><dd>{product.climate}</dd></div>
              <div><dt className="font-semibold text-[#111111]">Typical lead time</dt><dd>{product.standardLeadTime}</dd></div>
              <div><dt className="font-semibold text-[#111111]">Recommended branding</dt><dd>{product.recommendedTechnique}</dd></div>
            </dl>
            <div><span className="font-semibold text-[#111111]">Sizes</span><p>{product.sizes.join(", ")}</p></div>
          </div>
        )}
      </div>
    </article>
  );
}
