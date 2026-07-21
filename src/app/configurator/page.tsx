import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/configurator/products/ProductGrid";
import ProductPickerCartLink from "@/components/configurator/products/ProductPickerCartLink";

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

          <ProductPickerCartLink />
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
