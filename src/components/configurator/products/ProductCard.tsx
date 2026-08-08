"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { Product } from "@/lib/configurator/products";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

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
  const cardRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);

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
      { threshold: 0.45 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [product.id, product.name]);

  function handleCustomiseClick(event: MouseEvent<HTMLAnchorElement>) {
    trackConfiguratorEvent("product_selected", { product_id: product.id });

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
      ref={cardRef}
      className="techpack-panel group flex h-full flex-col overflow-hidden rounded-[4px] border transition-colors hover:!border-[var(--color-accent)]/50"
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#EFEFEF] p-3 sm:p-4">
        <Image
          src={product.defaultImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-contain transition-opacity duration-200 ease-out group-hover:opacity-0"
        />
        <Image
          src={product.hoverImage}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-contain opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <h2 className="text-base font-semibold leading-6 text-[var(--text-primary)]">
            {product.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-primary)]/65">
            {product.fabricFeel} · {product.fit}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-primary)]/55">
            {product.gsm} GSM · {product.material}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-5 text-[var(--text-primary)]/65">
            {product.description}
          </p>
        </div>

        <div className="mt-auto pt-5">
          <Link
            href={configuratorHref}
            onClick={handleCustomiseClick}
            aria-disabled={isNavigating}
            aria-busy={isNavigating}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] aria-disabled:pointer-events-none aria-disabled:opacity-70"
          >
            {isNavigating ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
            {isNavigating ? "Opening…" : "Customise"}
          </Link>
          <Link
            href={productDetailHref}
            className="mt-3 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-[var(--color-accent-dark)] hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Order sample <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
