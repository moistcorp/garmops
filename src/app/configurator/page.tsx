import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/configurator/products/ProductGrid";
import ProductPickerCartLink from "@/components/configurator/products/ProductPickerCartLink";
import { ConfiguratorJourney } from "@/components/configurator/ConfiguratorJourney";

export default function ConfiguratorPage() {
  return (
    <main className="min-h-screen bg-white px-4 pt-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-full border border-[#ECE7DF] bg-white/90 shadow-[0_2px_10px_rgba(22,33,43,0.04)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-6 px-6 py-3">
            <Link href="/" className="flex shrink-0 items-center" aria-label="Garmops homepage">
              <Image
                src="/logo3.png"
                alt="Garmops"
                width={180}
                height={48}
                className="h-5 w-auto object-contain"
                priority
              />
            </Link>

            <div className="hidden flex-1 md:block" />

            <ProductPickerCartLink />
          </div>
        </header>

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

        <ConfiguratorJourney currentStep="product" />

        <ProductGrid />
      </div>
    </main>
  );
}
