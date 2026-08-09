"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductGrid from "@/components/configurator/products/ProductGrid";
import { ConfiguratorTopBar } from "@/components/configurator/ConfiguratorTopBar";

export default function ConfiguratorLandingClient() {
  const cartId = useSearchParams().get("cartId") ?? undefined;
  return <main className="techpack-studio-bg min-h-screen px-4 pb-10 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col gap-8"><ConfiguratorTopBar currentStep="product" backHref={cartId ? `/configurator/cart/${encodeURIComponent(cartId)}/review` : "/"} showCart/><div className="max-w-2xl"><h1 className="text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">Choose your garment</h1><p className="mt-2 text-base leading-7 text-[var(--text-primary)]/65">Select a product to start customising. You can add more products to the same order later.</p></div>{cartId ? <section className="flex flex-col gap-4 border border-[var(--color-accent)]/25 bg-[var(--color-cream-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-labelledby="add-product-title"><div><h2 id="add-product-title" className="text-base font-semibold text-[var(--text-primary)]">Add another product to your order</h2><p className="mt-1 text-sm text-[var(--text-primary)]/60">Choose another garment. Your existing configurations will stay in the cart.</p></div><Link href={`/configurator/cart/${encodeURIComponent(cartId)}/review`} className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-[4px] border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-dark)]">View cart <ArrowRight size={15} aria-hidden="true"/></Link></section> : null}<ProductGrid cartId={cartId}/></div></main>;
}
