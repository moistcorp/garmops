"use client";

import Link from "next/link";
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

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg bg-white">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white">
        {/* Default: flat-lay image */}
        <img
          src={product.defaultImage}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-in-out group-hover:opacity-0"
        />
        {/* Hover: on-model lifestyle image, crossfades in */}
        <img
          src={product.hoverImage}
          alt={`${product.name} on model`}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        />

        {/* Hover overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-[#111111]/0 opacity-0 transition-all duration-300 ease-in-out group-hover:bg-[#111111]/40 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-[#111111] hover:bg-white"
          >
            See product details
          </button>
          <Link
            href={`/configurator/build/${product.id}`}
            className="rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white hover:bg-[#111111]/90"
          >
            Customize
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-[#111111]">{product.name}</span>
            <span className="text-sm text-[#111111]/60">{priceLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-label={`${detailsOpen ? "Hide" : "Show"} details for ${product.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E5E5E5] text-[#111111]/60 hover:border-[#111111] hover:text-[#111111]"
          >
            <ChevronDown
              size={15}
              strokeWidth={2.2}
              className={`transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {detailsOpen && (
          <div className="mt-3 space-y-3 border-t border-[#E5E5E5] pt-3 text-xs text-[#111111]/65">
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
