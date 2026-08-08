"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { products } from "@/lib/configurator/products";
import ProductCard from "./ProductCard";

const CATEGORY_OPTIONS = [
  "All",
  "T-Shirts",
  "Polos",
  "Hoodies",
  "Sweatshirts",
  "Tote Bags",
] as const;

type CategoryFilter = (typeof CATEGORY_OPTIONS)[number];

export default function ProductGrid({ cartId }: { cartId?: string }) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");

  const availableCategories = useMemo(
    () => CATEGORY_OPTIONS.filter(
      (category) => category === "All" || products.some((product) => product.category === category),
    ),
    [],
  );

  const filteredProducts = useMemo(
    () => products.filter(
      (product) => activeCategory === "All" || product.category === activeCategory,
    ),
    [activeCategory],
  );

  const configuratorHref = useCallback((productId: string) => {
    const base = `/configurator/build/${encodeURIComponent(productId)}`;
    return cartId ? `${base}?cartId=${encodeURIComponent(cartId)}` : base;
  }, [cartId]);

  const productDetailHref = useCallback(
    (productId: string) => `/products/${encodeURIComponent(productId)}`,
    [],
  );

  return (
    <div className="space-y-8">
      <nav aria-label="Product categories" className="border-y border-[var(--color-rule)] py-4">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {availableCategories.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={active}
                className={`min-h-10 shrink-0 rounded-[4px] border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-[var(--color-rule)] bg-white text-[var(--text-primary)]/65 hover:border-[var(--color-accent)] hover:text-[var(--color-accent-dark)]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </nav>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              configuratorHref={configuratorHref(product.id)}
              productDetailHref={productDetailHref(product.id)}
            />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-[var(--color-rule)] px-4 py-8 text-center text-sm text-[var(--text-primary)]/60">
          No products available in this category.
        </p>
      )}

      <section className="border-t border-[var(--color-rule)] pt-7" aria-labelledby="product-research-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="product-research-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Not sure which garment is right?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-primary)]/60">
              Compare fit, fabric weight and product details before choosing.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[4px] border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-dark)] transition-colors hover:bg-[var(--color-accent)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Compare products <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
