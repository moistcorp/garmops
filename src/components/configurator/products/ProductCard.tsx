import Link from "next/link";
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

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F7F7F7]">
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
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-[#111111] cursor-not-allowed"
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
        <span className="text-sm font-medium text-[#111111]">{product.name}</span>
        <span className="text-sm text-[#111111]/60">{priceLabel}</span>
      </div>
    </div>
  );
}
