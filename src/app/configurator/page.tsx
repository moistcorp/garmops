import ProductGrid from "@/components/configurator/products/ProductGrid";
import { ConfiguratorTopBar } from "@/components/configurator/ConfiguratorTopBar";
import type { Metadata } from "next";
import { generateMeta } from "@/lib/seo";

export const metadata: Metadata = generateMeta({
  title: "Online Custom Apparel Designer",
  description: "Design a bulk custom T-shirt, hoodie, polo, sweatshirt or tote online. Choose colours, upload artwork, select decoration and order from 50 pieces.",
  path: "/configurator",
  keywords: [
    "online custom T-shirt designer India",
    "custom apparel configurator",
    "design branded merchandise online",
    "bulk T-shirt design tool",
  ],
});

export default function ConfiguratorPage() {
  return (
    <main className="techpack-canvas min-h-screen px-4 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <ConfiguratorTopBar
          currentStep="product"
          backHref="/"
          showCart
        />

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium uppercase tracking-wide text-[var(--text-primary)]/60">
              Online custom apparel designer
            </span>
            <h1 className="text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
              Choose a product to customise
            </h1>
          </div>
        </div>
        <ProductGrid />
      </div>
    </main>
  );
}
