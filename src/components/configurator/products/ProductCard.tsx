"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  onProductSelect: (event: MouseEvent<HTMLAnchorElement>, product: Product) => void;
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
  onProductSelect,
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
    <article ref={cardRef} className={`techpack-panel group relative flex h-full self-stretch flex-col overflow-hidden rounded-[4px] border transition-all duration-300 hover:-translate-y-0.5 hover:!border-[var(--color-accent)]/45 ${recommended ? "!border-[var(--color-accent)]/60" : ""}`}>
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-white">
        <Link
          href={configuratorHref}
          onClick={(event) => onProductSelect(event, product)}
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
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        />

        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          {recommended ? (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--color-accent)] px-2.5 py-1 text-[10px] font-semibold text-white ">
              <Sparkles size={12} aria-hidden="true" /> Recommended
            </span>
          ) : <span />}
          <span className={`rounded-[4px] px-2.5 py-1 text-[10px] font-semibold  ${feasibilityClass}`}>
            {targetDate ? feasibility.label : product.standardLeadTime}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex min-h-[78px] items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={configuratorHref}
              onClick={(event) => onProductSelect(event, product)}
              className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#111111] hover:text-[var(--color-accent-dark)]"
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
            className="techpack-control flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border text-[#111111]/60 hover:!border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            <ChevronDown size={15} strokeWidth={2.2} className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="grid min-h-[92px] grid-cols-2 gap-2 text-[11px]">
          <div className="h-full rounded-[4px] bg-[#F7F7F7] p-2.5">
            <p className="font-semibold text-[#111111]">Best for</p>
            <p className="mt-0.5 leading-snug text-[#111111]/60">{product.bestFor.slice(0, 2).join(", ")}</p>
          </div>
          <div className="h-full rounded-[4px] bg-[#F7F7F7] p-2.5">
            <p className="font-semibold text-[#111111]">Feel & fit</p>
            <p className="mt-0.5 leading-snug text-[#111111]/60">{product.fabricFeel} · {product.fit}</p>
          </div>
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

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            href={configuratorHref}
            onClick={(event) => onProductSelect(event, product)}
            className="flex min-h-10 flex-1 items-center justify-center rounded-[4px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-dark)]"
          >
            Customise
          </Link>
          <button
            type="button"
            aria-pressed={compared}
            disabled={!compared && compareDisabled}
            onClick={() => onCompareChange(!compared)}
            className={`flex min-h-10 w-28 shrink-0 items-center justify-center gap-1.5 rounded-[4px] border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${compared ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-dark)]" : "border-[#E5E5E5] text-[#111111]/65 hover:border-[var(--color-accent)]"}`}
          >
            {compared ? <Check size={14} /> : <GitCompareArrows size={14} />}
            {compared ? "Added" : "Compare"}
          </button>
        </div>

      </div>
    </article>
  );
}
