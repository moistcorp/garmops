"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { ArrowRight, ChevronDown, LoaderCircle } from "lucide-react";
import type { Product } from "@/lib/configurator/products";
import { formatInr, getBasePrice } from "@/lib/configurator/pricing";

interface ProductCardProps {
  product: Product;
  configuratorHref: string;
  productDetailHref: string;
}

export default function ProductCard({
  product,
  configuratorHref,
  productDetailHref,
}: ProductCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const startingPrice = getBasePrice(product.id);
  const detailsId = `product-details-${product.id}`;
  const detailsTriggerId = `${detailsId}-trigger`;

  function handleCustomiseClick(event: MouseEvent<HTMLAnchorElement>) {
    const modifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modifiedClick || event.button !== 0) return;
    if (isNavigating) {
      event.preventDefault();
      return;
    }
    setIsNavigating(true);
  }

  return (
    <article
      className="techpack-panel flex h-full flex-col overflow-hidden rounded-sm border !bg-white transition-colors hover:!border-(--color-accent)/50"
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-white p-3 sm:p-4">
        <Image
          src={product.defaultImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="scale-[1.2] object-contain"
        />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <h2 className="text-base font-semibold leading-6 text-(--text-primary)">
            {product.name}
          </h2>
          <p className="mt-1 text-sm text-(--text-primary)/65">
            {product.fabricFeel} · {product.fit}
          </p>
          <dl className="mt-4 border-t border-(--color-rule) pt-3 text-xs">
            <div>
              <dt className="text-(--text-primary)/45">From</dt>
              <dd className="mt-0.5 font-semibold text-(--text-primary)">
                {formatInr(startingPrice)} / unit
              </dd>
            </div>
          </dl>

          <div className="mt-4 overflow-hidden rounded-sm border border-(--color-rule) bg-(--color-cream-soft)/45">
            <button
              id={detailsTriggerId}
              type="button"
              onClick={() => setIsDetailsOpen((open) => !open)}
              aria-expanded={isDetailsOpen}
              aria-controls={detailsId}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-semibold text-(--text-primary) transition-colors hover:bg-(--color-cream-soft) focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--color-accent)"
            >
              Product details
              <ChevronDown
                size={16}
                className={`shrink-0 text-(--text-primary)/55 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${isDetailsOpen ? "rotate-180" : "rotate-0"}`}
                aria-hidden="true"
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${isDetailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id={detailsId}
                  role="region"
                  aria-labelledby={detailsTriggerId}
                  aria-hidden={!isDetailsOpen}
                  className="border-t border-(--color-rule) px-3.5 py-3.5"
                >
                  <p className="text-sm leading-5 text-(--text-primary)/65">
                    {product.description}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                    <div>
                      <dt className="text-(--text-primary)/45">Fabric</dt>
                      <dd className="mt-0.5 font-medium text-(--text-primary)/80">
                        {product.gsm} GSM · {product.material}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-(--text-primary)/45">Minimum order</dt>
                      <dd className="mt-0.5 font-medium text-(--text-primary)/80">
                        {product.minimumOrderQuantity} units
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-(--text-primary)/45">Typical lead time</dt>
                      <dd className="mt-0.5 font-medium text-(--text-primary)/80">
                        {product.standardLeadTime}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Link
            href={configuratorHref}
            onClick={handleCustomiseClick}
            aria-disabled={isNavigating}
            aria-busy={isNavigating}
            className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-(--color-accent) px-4 text-sm font-semibold text-white transition-colors hover:bg-(--color-accent-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) aria-disabled:pointer-events-none aria-disabled:opacity-70"
          >
            {isNavigating ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
            {isNavigating ? "Opening…" : "Customise"}
          </Link>
          <Link
            href={productDetailHref}
            className="mt-3 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-(--color-accent-dark) hover:text-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            Order sample <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
