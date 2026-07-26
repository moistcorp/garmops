import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/configurator/products/ProductGrid";
import ProductPickerCartLink from "@/components/configurator/products/ProductPickerCartLink";
import { FileCheck2 } from "lucide-react";

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

        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-teal)]/20 bg-[var(--color-teal)]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-white p-2.5 text-[var(--color-teal-dark)] shadow-sm">
              <FileCheck2 size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#111111]">Built for internal approvals</p>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#111111]/65">
                Download an approval-ready PDF with product previews, customization details, size allocation, estimated pricing and the target delivery date—ready to share with your manager, Finance or Procurement team.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--color-teal)]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-teal-dark)]">
            Included with every project
          </span>
        </section>

        <ProductGrid />
      </div>
    </main>
  );
}
