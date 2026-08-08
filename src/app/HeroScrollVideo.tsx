'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function HeroScrollVideo() {
  return (
    <section className="techpack-canvas grid lg:min-h-[88vh] lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-14 min-[360px]:px-5 sm:px-8 sm:py-20 md:px-16 lg:py-0">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#595959] sm:mb-6 sm:text-xs sm:tracking-widest">
          Custom apparel for businesses
        </p>
        <h1 className="mb-5 max-w-2xl text-[2.45rem] font-bold leading-[1.01] tracking-tight text-[var(--text-primary)] min-[360px]:text-5xl md:text-6xl lg:text-7xl">
          Custom apparel,<br />without the<br /><span className="text-[var(--color-accent)]">back-and-forth.</span>
        </h1>
        <p className="mb-8 max-w-lg text-[15px] leading-relaxed text-[#4a4a4a] sm:mb-10 sm:text-base">
          Choose your garment, add your artwork and build a custom order online. Made in India, with custom production starting from 50 pieces per custom product.
        </p>

        <div className="grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap">
          <Link
            href="/products"
            className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] sm:px-8 sm:py-4"
          >
            Explore products
          </Link>
          <Link
            href="/industries"
            className="rounded-[4px] border border-[var(--text-primary)]/20 px-5 py-3.5 text-center text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] sm:px-8 sm:py-4"
          >
            Find by industry
          </Link>
        </div>
      </div>

      <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden bg-[var(--color-cream-soft)] lg:min-h-full">
        <Image
          src="/products/boxy-fit-tee-260gsm.webp"
          alt="Premium Oversized T-Shirt by Garmops"
          fill
          className="object-cover"
          sizes="(max-width: 1023px) 100vw, 50vw"
          preload
        />
        <Link
          href="/products/boxy-fit-tee-260gsm"
          className="techpack-surface group absolute bottom-4 left-4 right-4 z-10 rounded-[4px] border px-4 py-4 transition-colors hover:!border-[var(--color-accent)]/50 sm:bottom-8 sm:left-8 sm:right-auto sm:min-w-[290px] sm:px-5 sm:py-4"
        >
          <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#595959]">Featured garment</p>
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">Premium Oversized T-Shirt</p>
              <p className="mt-1 text-xs text-[#4a4a4a]">Heavyweight · Oversized fit · 260 GSM</p>
            </div>
            <span className="shrink-0 text-sm text-[var(--color-accent-dark)] transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </Link>
      </div>
    </section>
  )
}

export function HomeProductionShowcase() {
  return (
    <section className="techpack-section">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
        <div className="mb-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-12">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">Made in India</p>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              From your approved order to production.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-[#4a4a4a] lg:justify-self-end">
            Once the garment, artwork, quantities and sizes are confirmed, the order moves into production against that specification. The aim is a clearer handoff from what you approved online to what gets made.
          </p>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] border border-[#E5E5E5] bg-black sm:aspect-video">
          <video
            className="h-full w-full object-cover"
            src="/videos/homepage-reel.mp4"
            poster="/hero.webp"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-label="Garmops apparel production showcase"
          />
        </div>
      </div>
    </section>
  )
}
