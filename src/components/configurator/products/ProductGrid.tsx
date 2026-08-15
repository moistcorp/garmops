"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { products } from "@/lib/configurator/products";
import ProductCard from "./ProductCard";
import { getCatalog } from "@/lib/medusa/commerce";

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
  const [activeSlugs, setActiveSlugs] = useState<Set<string> | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCatalogError(false);
    void getCatalog().then((catalog) => {
      if (!cancelled) setActiveSlugs(new Set(catalog.products.map((product) => product.slug)));
    }).catch(() => {
      if (!cancelled) {
        setActiveSlugs(new Set());
        setCatalogError(true);
      }
    });
    return () => { cancelled = true; };
  }, [catalogAttempt]);

  const availableCategories = useMemo(
    () => CATEGORY_OPTIONS.filter(
      (category) => category === "All" || products.some((product) => product.category === category),
    ),
    [],
  );

  const filteredProducts = useMemo(
      () => products.filter(
      (product) => (activeSlugs === null || activeSlugs.has(product.id)) && (activeCategory === "All" || product.category === activeCategory),
    ),
    [activeCategory, activeSlugs],
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
      <nav aria-label="Product categories" className="border-y border-(--color-rule) py-4">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {availableCategories.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={active}
                className={`min-h-10 shrink-0 rounded-sm border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) ${
                  active
                    ? "border-(--color-accent) bg-(--color-accent) text-white"
                    : "border-(--color-rule) bg-white text-(--text-primary)/65 hover:border-(--color-accent) hover:text-(--color-accent-dark)"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </nav>

      {activeSlugs === null ? (
        <p className="border border-dashed border-(--color-rule) px-4 py-8 text-center text-sm text-(--text-primary)/60" role="status">Loading the current catalogue…</p>
      ) : catalogError ? (
        <div className="border border-(--color-accent)/30 bg-(--color-cream-soft) px-5 py-7 text-center" role="alert">
          <p className="font-semibold text-(--text-primary)">The product catalogue could not be reached.</p>
          <p className="mt-2 text-sm text-(--text-primary)/60">Check that the Garmops backend is running, then try again.</p>
          <button
            type="button"
            onClick={() => {
              setActiveSlugs(null);
              setCatalogAttempt((attempt) => attempt + 1);
            }}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm border border-(--color-accent) px-4 py-2 text-sm font-semibold text-(--color-accent-dark)"
          >
            <RefreshCw size={15} aria-hidden="true" /> Retry catalogue
          </button>
        </div>
      ) : filteredProducts.length > 0 ? (
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
        <p className="border border-dashed border-(--color-rule) px-4 py-8 text-center text-sm text-(--text-primary)/60">
          No products available in this category.
        </p>
      )}

      <section className="border-t border-(--color-rule) pt-7" aria-labelledby="product-research-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="product-research-title" className="text-lg font-semibold text-(--text-primary)">
              Not sure which garment is right?
            </h2>
            <p className="mt-1 text-sm text-(--text-primary)/60">
              Compare fit, fabric weight and product details before choosing.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-sm border border-(--color-accent) px-4 py-2 text-sm font-semibold text-(--color-accent-dark) transition-colors hover:bg-(--color-accent) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            Compare products <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
