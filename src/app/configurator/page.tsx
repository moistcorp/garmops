import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/configurator/products/ProductGrid";

export default function ConfiguratorPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="Moist Foundry homepage">
            <Image
              src="/logo3.png"
              alt="Moist Foundry"
              width={180}
              height={48}
              className="h-6 w-auto object-contain"
              priority
            />
          </Link>

          {/* Cart icon — stubbed static badge, no cart lib wired up yet */}
          <div className="relative shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-7 w-7 text-[#111111]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.94-4.752 2.435-7.313a1.5 1.5 0 00-1.478-1.762H4.5m3 12.75a3 3 0 106 0m-6 0a3 3 0 016 0m3.75-3H21.75"
              />
            </svg>
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#111111] text-[11px] font-medium text-white">
              0
            </span>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium uppercase tracking-wide text-[#111111]/60">
              Start your project
            </span>
            <h1 className="text-3xl font-semibold text-[#111111] sm:text-4xl">
              Choose from our products
            </h1>
          </div>
        </div>

        <ProductGrid />
      </div>
    </main>
  );
}
