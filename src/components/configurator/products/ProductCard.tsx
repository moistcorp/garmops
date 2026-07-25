"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Product } from "@/lib/configurator/products";
import { formatInr, getBasePrice } from "@/lib/configurator/pricing";

function getDisplayPrice(productId: Product["id"]): string {
  try {
    const price = getBasePrice(productId);
    return `from ${formatInr(price)}`;
  } catch {
    // Placeholder id not yet recognized by pricing.ts's real catalogue.
    return "Price unavailable";
  }
}

export default function ProductCard({ product }: { product: Product }) {
  const priceLabel = getDisplayPrice(product.id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const configuratorHref = `/configurator/build/${product.id}`;

  return (
    <div
      className="group relative flex cursor-pointer self-start flex-col overflow-hidden rounded-2xl border border-[#ECE7DF] bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)] transition-all duration-300 hover:border-[var(--color-teal)] hover:shadow-[0_12px_30px_rgba(22,33,43,0.08)]"
    >
      <Link
        href={configuratorHref}
        aria-label={`Customize ${product.name}`}
        className="absolute inset-0 z-10 rounded-2xl"
      >
        <span className="sr-only">Customize {product.name}</span>
      </Link>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
        {/* Default: flat-lay image */}
        <Image
          src={product.defaultImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-opacity duration-300 ease-in-out group-hover:opacity-0"
        />
        {/* Hover: on-model lifestyle image, crossfades in */}
        <Image
          src={product.hoverImage}
          alt={`${product.name} on model`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        />

      </div>

      <div className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-[#111111]">{product.name}</span>
            <span className="text-sm text-[#111111]/60">{priceLabel}</span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDetailsOpen((open) => !open);
            }}
            aria-expanded={detailsOpen}
            aria-label={`${detailsOpen ? "Hide" : "Show"} details for ${product.name}`}
            className="relative z-20 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#111111]/60 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
          >
            <ChevronDown
              size={15}
              strokeWidth={2.2}
              className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {detailsOpen && (
          <div className="mt-3 space-y-3 border-t border-[#ECE7DF] pt-3 text-xs text-[#111111]/65">
            <p className="leading-relaxed">{product.description}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-[#111111]">GSM</span>
                <p>{product.gsm}</p>
              </div>
              <div>
                <span className="font-semibold text-[#111111]">Sizes</span>
                <p>{product.sizes.join(", ")}</p>
              </div>
            </div>
            <div>
              <span className="font-semibold text-[#111111]">Details</span>
              <ul className="mt-1 space-y-1">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-semibold text-[#111111]">Care</span>
              <p>{product.careInstructions.join(", ")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
