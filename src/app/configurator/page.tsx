import ProductGrid from "@/components/configurator/products/ProductGrid";
import { ConfiguratorTopBar } from "@/components/configurator/ConfiguratorTopBar";

export default function ConfiguratorPage() {
  return (
    <main className="app-liquid-bg min-h-screen px-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <ConfiguratorTopBar
          currentStep="product"
          backHref="/"
          showCart
        />

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
