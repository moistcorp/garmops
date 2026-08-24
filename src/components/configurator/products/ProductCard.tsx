"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Info,
  LoaderCircle,
  ShoppingBag,
  X,
} from "lucide-react";
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
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const startingPrice = getBasePrice(product.id);

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
    <>
      <article className="group techpack-panel flex h-full flex-col overflow-hidden rounded-sm border !bg-white transition-colors hover:!border-(--color-accent)/55">
        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-(--color-rule) bg-[#E8E9E7]">
          <span className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-sm border border-(--color-navy)/10 bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--color-navy) backdrop-blur-sm">
            Best for · {product.bestFor[0]}
          </span>
          <Image
            src={product.hoverImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover object-[center_28%]"
          />
        </div>

        <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
          <div>
            <h2 className="min-h-12 text-lg font-semibold leading-6 tracking-[-0.015em] text-(--text-primary)">
              {product.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-sm bg-(--color-cream-soft) px-2 py-1 text-xs font-medium text-(--text-primary)/75">
                {product.fit}
              </span>
              <span className="rounded-sm bg-(--color-cream-soft) px-2 py-1 text-xs font-medium text-(--text-primary)/75">
                {product.fabricFeel}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 border-y border-(--color-rule) text-xs">
              <div className="border-b border-r border-(--color-rule) py-3 pr-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/65">
                  Fabric weight
                </dt>
                <dd className="mt-1 font-semibold text-(--text-primary)">{product.gsm} GSM</dd>
              </div>
              <div className="border-b border-(--color-rule) py-3 pl-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/65">
                  Material
                </dt>
                <dd className="mt-1 font-semibold leading-4 text-(--text-primary)">{product.material}</dd>
              </div>
              <div className="border-r border-(--color-rule) py-3 pr-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/65">
                  Minimum order
                </dt>
                <dd className="mt-1 font-semibold text-(--text-primary)">{product.minimumOrderQuantity} units</dd>
              </div>
              <div className="py-3 pl-3">
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/65">
                  Lead time
                </dt>
                <dd className="mt-1 font-semibold leading-4 text-(--text-primary)">{product.standardLeadTime}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-auto pt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/65">From</p>
                <p className="mt-0.5 text-base font-semibold text-(--text-primary)">
                  {formatInr(startingPrice)} <span className="text-xs font-medium text-(--text-primary)/65">/ unit</span>
                </p>
              </div>
              <p className="text-right text-xs font-medium text-(--text-primary)/65">
                MOQ {product.minimumOrderQuantity}
              </p>
            </div>

            <Link
              href={configuratorHref}
              onClick={handleCustomiseClick}
              aria-disabled={isNavigating}
              aria-busy={isNavigating}
              className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-(--color-accent) px-4 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-(--color-accent-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) aria-disabled:pointer-events-none aria-disabled:opacity-70 motion-reduce:transition-colors"
            >
              {isNavigating ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {isNavigating ? "Opening…" : "Customise"}
            </Link>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                ref={detailsButtonRef}
                type="button"
                onClick={() => setIsDetailsOpen(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-1 text-sm font-medium text-(--text-primary)/75 transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-(--color-accent-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
              >
                <Info size={14} aria-hidden="true" /> Product details
              </button>
              <Link
                href={productDetailHref}
                className="inline-flex min-h-9 items-center gap-1 rounded-sm px-1 text-sm font-medium text-(--color-accent-dark) transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
              >
                Order sample <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </article>

      <Dialog.Root open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[70] bg-(--color-navy)/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
          <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-end sm:items-stretch">
            <Dialog.Popup
              finalFocus={detailsButtonRef}
              className="h-[min(88dvh,760px)] w-full overflow-y-auto rounded-t-md border border-(--color-navy)/15 bg-white outline-none transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none sm:h-full sm:max-w-[480px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:data-[ending-style]:translate-x-full sm:data-[ending-style]:translate-y-0 sm:data-[starting-style]:translate-x-full sm:data-[starting-style]:translate-y-0"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-(--color-rule) bg-white/95 px-5 py-4 backdrop-blur-sm sm:px-6">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-(--color-accent)">
                    Product specifications
                  </p>
                  <Dialog.Title className="mt-1 text-xl font-semibold tracking-[-0.02em] text-(--text-primary)">
                    {product.name}
                  </Dialog.Title>
                </div>
                <Dialog.Close
                  aria-label="Close product details"
                  className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-(--color-rule) text-(--text-primary)/70 transition-[color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-(--color-accent) hover:text-(--color-accent) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
                >
                  <X size={17} aria-hidden="true" />
                </Dialog.Close>
              </div>

              <div className="p-5 sm:p-6">
                <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-(--color-rule) bg-[#E8E9E7]">
                  <Image
                    src={product.hoverImage}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 480px"
                    className="object-cover object-[center_28%]"
                  />
                </div>

                <Dialog.Description className="mt-6 text-sm leading-6 text-(--text-primary)/75">
                  {product.description}
                </Dialog.Description>

                <dl className="mt-6 divide-y divide-(--color-rule) border-y border-(--color-rule)">
                  {[
                    ["Fit", product.fit],
                    ["Fabric", `${product.gsm} GSM · ${product.material}`],
                    ["Minimum order", `${product.minimumOrderQuantity} units`],
                    ["Typical lead time", product.standardLeadTime],
                    ["Climate", product.climate],
                    ["Recommended decoration", product.recommendedTechnique],
                    ["Available sizes", product.sizes.join(", ")],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 py-3 text-sm">
                      <dt className="text-(--text-primary)/65">{label}</dt>
                      <dd className="font-medium leading-5 text-(--text-primary)">{value}</dd>
                    </div>
                  ))}
                </dl>

                <section className="mt-6" aria-labelledby={`best-for-${product.id}`}>
                  <h3 id={`best-for-${product.id}`} className="text-sm font-semibold text-(--text-primary)">
                    Best suited for
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.bestFor.map((useCase) => (
                      <span key={useCase} className="rounded-sm bg-(--color-cream-soft) px-2.5 py-1.5 text-xs font-medium text-(--text-primary)/75">
                        {useCase}
                      </span>
                    ))}
                  </div>
                </section>

                <div className="mt-7 grid gap-2 sm:grid-cols-2">
                  <Link
                    href={configuratorHref}
                    onClick={handleCustomiseClick}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-(--color-accent) px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-(--color-accent-dark) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
                  >
                    Customise <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                  <Link
                    href={productDetailHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-(--color-rule) px-4 text-sm font-semibold text-(--text-primary)/80 transition-[color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-(--color-accent) hover:text-(--color-accent) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) motion-reduce:transition-colors"
                  >
                    <ShoppingBag size={15} aria-hidden="true" /> Order sample
                  </Link>
                </div>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
