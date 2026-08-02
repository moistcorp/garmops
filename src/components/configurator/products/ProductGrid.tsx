"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PRODUCT_USE_CASES, products, type ProductUseCase } from "@/lib/configurator/products";
import { formatInr, getBasePrice, getVolumeDiscountPercent } from "@/lib/configurator/pricing";
import { readPreferredQuantity, writePreferredQuantity } from "@/lib/configurator/clientPreferences";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import GarmopsLoadingScreen from "@/components/common/GarmopsLoadingScreen";
import ProductCard from "./ProductCard";

const PRODUCT_TRANSITION_MS = 2000;

export default function ProductGrid() {
  const router = useRouter();
  const [useCase, setUseCase] = useState<ProductUseCase | "">("");
  const [quantity, setQuantity] = useState(100);
  const [quantityDraft, setQuantityDraft] = useState("100");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectionTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preferredQuantity = readPreferredQuantity() ?? 100;
      setQuantity(preferredQuantity);
      setQuantityDraft(String(preferredQuantity));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (selectionTimer.current) window.clearTimeout(selectionTimer.current);
  }, []);

  const sortedProducts = useMemo(() => {
    if (!useCase) return products;
    return [...products].sort((a, b) => Number(b.bestFor.includes(useCase)) - Number(a.bestFor.includes(useCase)));
  }, [useCase]);

  const comparedProducts = products.filter((product) => compareIds.includes(product.id));
  const discount = getVolumeDiscountPercent(quantity);

  function updateQuantityDraft(raw: string) {
    if (!/^[0-9]*$/.test(raw)) return;
    setQuantityDraft(raw);
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(50, Math.floor(parsed));
    setQuantity(next);
    writePreferredQuantity(next);
  }

  function commitQuantityDraft() {
    const parsed = Number(quantityDraft);
    const next = quantityDraft && Number.isFinite(parsed) ? Math.max(50, Math.floor(parsed)) : quantity;
    setQuantity(next);
    setQuantityDraft(String(next));
    writePreferredQuantity(next);
  }

  function toggleCompare(productId: string, selected: boolean) {
    setCompareIds((current) => selected ? [...current, productId].slice(0, 3) : current.filter((id) => id !== productId));
    if (selected) trackConfiguratorEvent("product_compared", { product_id: productId });
  }

  const selectProduct = useCallback((event: MouseEvent<HTMLAnchorElement>, product: (typeof products)[number]) => {
    trackConfiguratorEvent("product_selected", {
      product_id: product.id,
      quantity,
      use_case: useCase || null,
    });

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      selectedProductId
    ) return;

    event.preventDefault();
    const href = `/configurator/build/${product.id}`;
    setSelectedProductId(product.id);
    router.prefetch(href);
    // Dynamic-route prefetching stops at the loading boundary, so warm the
    // configurator client bundle during the intentional transition as well.
    void import("../ConfigureClient");
    selectionTimer.current = window.setTimeout(() => router.push(href), PRODUCT_TRANSITION_MS);
  }, [quantity, router, selectedProductId, useCase]);

  return (
    <div className="space-y-6">
      <section className="techpack-surface rounded-[4px] border p-4 sm:p-5" aria-labelledby="product-guidance-title">
        <div className="flex flex-col gap-1">
          <h2 id="product-guidance-title" className="text-base font-semibold text-[var(--text-primary)]">Help us recommend the right product</h2>
          <p className="text-sm text-[var(--text-primary)]/60">These details only improve recommendations. You can still browse every product.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <label htmlFor="product-use-case" className="mb-1 block text-xs font-medium text-[var(--text-primary)]/65">Primary use case</label>
            <select
              id="product-use-case"
              value={useCase}
              onChange={(event) => setUseCase(event.target.value as ProductUseCase | "")}
              className="techpack-control min-h-11 w-full rounded-[4px] border px-3 text-sm text-[var(--text-primary)]"
            >
              <option value="">Show all products</option>
              {PRODUCT_USE_CASES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="project-quantity" className="mb-1 block text-xs font-medium text-[var(--text-primary)]/65">Approx. quantity</label>
            <input
              id="project-quantity"
              type="number"
              min={50}
              inputMode="numeric"
              value={quantityDraft}
              onChange={(event) => updateQuantityDraft(event.target.value)}
              onBlur={commitQuantityDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitQuantityDraft();
                  event.currentTarget.blur();
                }
              }}
              className="techpack-control min-h-11 w-full rounded-[4px] border px-3 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--text-primary)]/55">Current volume tier: {discount}% off blank product pricing. Customisation is calculated in Studio.</p>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={quantity}
            selectedUseCase={useCase}
            compared={compareIds.includes(product.id)}
            compareDisabled={compareIds.length >= 3}
            onCompareChange={(selected) => toggleCompare(product.id, selected)}
            onProductSelect={selectProduct}
            recommended={Boolean(useCase && product.bestFor.includes(useCase) && index < 3)}
          />
        ))}
      </div>

      {comparedProducts.length > 0 && (
        <section className="techpack-surface sticky bottom-4 z-30 overflow-hidden rounded-[4px] border !border-[var(--color-accent)]/30" aria-labelledby="comparison-title">
          <div className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/15 px-4 py-3">
            <div><h2 id="comparison-title" className="text-sm font-semibold text-[var(--text-primary)]">Product comparison</h2><p className="text-xs text-[var(--text-primary)]/55">Compare up to three options before customising.</p></div>
            <button type="button" onClick={() => setCompareIds([])} className="techpack-control rounded-[4px] border px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]/65">Clear comparison</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="bg-white/20">
                  <th className="w-40 px-4 py-3 font-semibold text-[var(--text-primary)]/55">Attribute</th>
                  {comparedProducts.map((product) => (
                    <th key={product.id} className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center justify-between gap-2"><span>{product.name}</span><button type="button" aria-label={`Remove ${product.name} from comparison`} onClick={() => toggleCompare(product.id, false)} className="rounded-[4px] p-1 hover:bg-white"><X size={14} /></button></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DF]">
                <CompareRow label="Best for" values={comparedProducts.map((p) => p.bestFor.slice(0, 3).join(", "))} />
                <CompareRow label="Feel & fit" values={comparedProducts.map((p) => `${p.fabricFeel}; ${p.fit}`)} />
                <CompareRow label="Climate" values={comparedProducts.map((p) => p.climate)} />
                <CompareRow label="Blank estimate" values={comparedProducts.map((p) => {
                  try { return `${formatInr(Math.round(getBasePrice(p.id) * (1 - discount / 100)))}/unit at ${quantity}`; } catch { return "Unavailable"; }
                })} />
                <CompareRow label="Lead time" values={comparedProducts.map((p) => p.standardLeadTime)} />
                <CompareRow label="Recommended branding" values={comparedProducts.map((p) => p.recommendedTechnique)} />
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedProductId && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-cream)]">
          <GarmopsLoadingScreen />
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return <tr><th className="px-4 py-3 font-semibold text-[var(--text-primary)]/55">{label}</th>{values.map((value, index) => <td key={`${label}-${index}`} className="px-4 py-3 leading-relaxed text-[var(--text-primary)]/70">{value}</td>)}</tr>;
}
