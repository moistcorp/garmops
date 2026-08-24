"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ConfiguratorTopBar } from "@/components/configurator/ConfiguratorTopBar";
import ProductGrid from "@/components/configurator/products/ProductGrid";

export default function ConfiguratorLandingClient() {
  const cartId = useSearchParams().get("cartId") ?? undefined;

  return (
    <main className="techpack-studio-bg min-h-screen px-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-7">
        <ConfiguratorTopBar
          currentStep="product"
          backHref={cartId
            ? `/configurator/cart/${encodeURIComponent(cartId)}/review`
            : "/"}
          showCart
          condensedJourney
        />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-(--color-accent)">
              Product selection
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-(--text-primary) sm:text-4xl">
              Choose your product
            </h1>
            <p className="mt-2 max-w-xl text-base leading-7 text-(--text-primary)/70">
              Compare fit, fabric weight and minimum order before opening the
              customisation workspace.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-sm border border-(--color-accent) bg-white px-4 py-2.5 text-sm font-semibold text-(--color-accent-dark) transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-(--color-accent) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
          >
            Compare garments <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {cartId ? (
          <section
            className="flex flex-col gap-4 border border-(--color-accent)/25 bg-(--color-cream-soft) px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            aria-labelledby="add-product-title"
          >
            <div>
              <h2 id="add-product-title" className="text-base font-semibold text-(--text-primary)">
                Add another product to your order
              </h2>
              <p className="mt-1 text-sm text-(--text-primary)/70">
                Choose another product. Your existing configurations will stay
                in the cart.
              </p>
            </div>
            <Link
              href={`/configurator/cart/${encodeURIComponent(cartId)}/review`}
              className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-sm border border-(--color-accent) px-4 py-2 text-sm font-semibold text-(--color-accent-dark)"
            >
              View cart <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        ) : null}

        <ProductGrid cartId={cartId} />
      </div>
    </main>
  );
}
