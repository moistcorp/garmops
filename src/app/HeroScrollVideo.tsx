import Image from 'next/image'
import Link from 'next/link'

export default function HeroScrollVideo() {
  return (
    <section id="homepage-hero" className="techpack-canvas grid lg:min-h-[88vh] lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-14 min-[360px]:px-5 sm:px-8 sm:py-20 md:px-16 lg:py-0">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[#595959] sm:mb-6 sm:text-sm sm:tracking-widest">
          Custom apparel for businesses
        </p>
        <h1 className="mb-5 max-w-2xl text-[2.45rem] font-bold leading-[1.01] tracking-tight text-(--text-primary) min-[360px]:text-5xl md:text-6xl lg:text-7xl">
          Custom apparel,<br />without the<br /><span className="text-(--color-accent)">back-and-forth.</span>
        </h1>
        <p className="mb-8 max-w-lg text-[15px] leading-relaxed text-[#4a4a4a] sm:mb-10 sm:text-base">
          Choose your garment, add your artwork and build a custom order online. Made in India, with custom production starting from 50 pieces per custom product.
        </p>

        <div className="grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap">
          <Link
            href="/configurator"
            className="rounded-sm bg-(--color-accent) px-5 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark) sm:px-8 sm:py-4"
          >
            Start designing
          </Link>
          <Link
            href="/products"
            className="rounded-sm border border-(--text-primary)/20 px-5 py-3.5 text-center text-sm font-medium text-(--text-primary) transition-colors hover:border-(--text-primary) sm:px-8 sm:py-4"
          >
            Explore products
          </Link>
        </div>
        <Link
          href="/industries"
          className="mt-4 w-fit text-sm font-medium text-(--color-accent-dark) hover:underline"
        >
          Find by industry →
        </Link>
      </div>

      <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-(--color-cream-soft) sm:min-h-[430px] lg:min-h-full">
        <Image
          src="/images/manufacturing-facility.webp"
          alt="Printed apparel panels in Garmops production"
          fill
          className="object-cover"
          sizes="(max-width: 1023px) 100vw, 50vw"
          preload
        />
        <Link
          href="/configurator"
          className="techpack-surface group absolute bottom-4 left-4 right-4 z-10 rounded-sm border px-4 py-4 transition-colors hover:!border-(--color-accent)/50 sm:bottom-8 sm:left-8 sm:right-auto sm:min-w-[290px] sm:px-5 sm:py-4"
        >
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#595959]">Custom production</p>
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-base font-semibold text-(--text-primary)">From approved artwork to apparel</p>
              <p className="mt-1 text-xs text-[#4a4a4a]">Screen Print · DTF · Reflective</p>
            </div>
            <span className="shrink-0 text-sm text-(--color-accent-dark) transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </Link>
      </div>
    </section>
  )
}
