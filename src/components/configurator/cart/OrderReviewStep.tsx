'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import type { ProductId } from '@/lib/configurator/pricing';
import type { GarmentColour, Artwork, NeckLabel } from '@/lib/configurator/types/configurator';
import type { GarmentView } from '@/lib/configurator/types/garment';
import { SizeQuantityGrid, SIZES, type Size } from './SizeQuantityGrid';
import { CartSummarySidebar } from './CartSummarySidebar';
import { CheckoutSteps } from './CheckoutSteps';
import { calculateTotals, createDraft, itemSubtotal, readDraft, totalUnits, writeDraft } from './cartDraft';
import { formatInr } from '@/lib/configurator/pricing';
import { CUSTOM_DYE_MOQ_UNITS } from '@/lib/configurator/colours';
import { getSizeChart } from '@/lib/sizecharts';
import CanvasRenderer from '../GarmentPreview/CanvasRenderer';
import { ArtworkPositionProvider } from '@/lib/configurator/ArtworkPositionContext';

export interface DevelopmentCostLine {
  label: string;
  unitPrice: number;
  count: number;
}

export interface CartItem {
  id: string;
  productId: ProductId;
  productName: string;
  previewImage: string;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  sizeQuantities: Record<Size, number>;
  unitPrice: number;
  rushDelivery?: boolean;
  artworkFees: DevelopmentCostLine[];
  applicationFees: DevelopmentCostLine[];
}

export interface OrderReviewStepProps {
  cartId: string;
}

const GARMENT_VIEWS: GarmentView[] = ['front', 'neck', 'back'];

export function OrderReviewStep({ cartId }: OrderReviewStepProps) {
  const router = useRouter();
  // Deterministic empty draft for the first render (server AND client) —
  // reading localStorage inside the useState initializer returned the real,
  // already-saved items on the client's first render but not on the
  // server's, so the two renders didn't match and React threw a hydration
  // error. The real draft is loaded right after mount instead.
  const [draft, setDraft] = useState(() => createDraft(cartId));
  const items = draft.items;
  const [activeView, setActiveView] = useState<Record<string, GarmentView>>({});
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      const realDraft = readDraft(cartId);
      setDraft(realDraft);
      setActiveView(Object.fromEntries(realDraft.items.map((item) => [item.id, 'front'])));
      setDraftLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [cartId]);

  function handleQtyChange(itemId: string, size: Size, qty: number) {
    setDraft((prev) => {
      const next = {
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== itemId) return item;

          const currentSizeQty = item.sizeQuantities[size] ?? 0;
          const currentTotal = totalUnits(item.sizeQuantities);
          const minimumUnits = item.colour.type === 'custom_dye' ? CUSTOM_DYE_MOQ_UNITS : 50;
          const minimumAllowedQty = Math.max(
            0,
            currentSizeQty - Math.max(0, currentTotal - minimumUnits)
          );
          const safeQty = Math.max(minimumAllowedQty, qty);

          return { ...item, sizeQuantities: { ...item.sizeQuantities, [size]: safeQty } };
        }),
      };
      writeDraft(cartId, next);
      return next;
    });
  }

  function handleEdit(item: CartItem) {
    router.push(`/configurator/build/${encodeURIComponent(item.productId)}`);
  }

  function handleDelete(itemId: string) {
    setDraft((prev) => {
      const next = { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
      writeDraft(cartId, next);
      return next;
    });
    setActiveView((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setPendingDeleteItemId(null);
  }

  function handleAddAnotherProduct() {
    router.push('/configurator');
  }

  function handleNext() {
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`);
  }

  const totals = calculateTotals(items);
  const cartUnitCount = items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <CheckoutSteps currentStep="summary" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
              Cart {cartId}
            </p>
            <h1 className="text-2xl font-semibold text-[#111111]">Order Summary</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/configurator')}
              className="inline-flex items-center gap-2 rounded-md border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[#111111] hover:text-[#111111]"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              Back to configurator
            </button>
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              className="inline-flex items-center gap-2 rounded-md border border-[#111111] px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#111111] hover:text-white"
            >
              <Plus size={16} strokeWidth={2.2} />
              Add another product
            </button>
          </div>
        </div>

        {!draftLoaded && <OrderItemSkeleton />}

        {draftLoaded && items.length === 0 && (
          <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
            <h2 className="text-lg font-medium text-[#111111]">Your cart is empty</h2>
            <p className="mt-1 text-sm text-[#111111]/60">
              Add a product to continue your order.
            </p>
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              className="mt-5 rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add product
            </button>
          </section>
        )}

        {draftLoaded && items.map((item) => {
          const selectedView = activeView[item.id] ?? 'front';
          const itemUnits = totalUnits(item.sizeQuantities);
          const itemMinimumUnits = item.colour.type === 'custom_dye' ? CUSTOM_DYE_MOQ_UNITS : 50;
          const sizeChart = getSizeChart(item.productId);
          const garmentTotal = item.unitPrice * itemUnits;
          return (
            <section key={item.id} className="rounded-lg border border-[#E5E5E5] bg-white p-5">
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="w-full shrink-0 md:w-44">
                  <div className="aspect-[3/4] overflow-hidden rounded-md bg-[#F7F7F7]">
                    <ArtworkPositionProvider activeView={selectedView}>
                      <CanvasRenderer
                        view={selectedView}
                        colourHex={item.colour.hex}
                        productId={item.productId}
                        artwork={item.artwork}
                        neckLabel={item.neckLabel}
                        interactive={false}
                        className="h-full w-full bg-[#F7F7F7]"
                      />
                    </ArtworkPositionProvider>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {GARMENT_VIEWS.map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() =>
                          setActiveView((prev) => ({ ...prev, [item.id]: view }))
                        }
                        className={`rounded border px-2 py-1 text-xs capitalize ${
                          selectedView === view
                            ? 'border-[#111111] bg-[#111111] text-white'
                            : 'border-[#E5E5E5] text-[#111111]/70 hover:text-[#111111]'
                        }`}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-[#111111]">
                        {item.productName}
                      </h2>
                      <p className="text-sm text-[#111111]/60">
                        {item.colour.name} · {itemUnits} units
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:text-[#111111]"
                      >
                        Edit
                      </button>
                      {pendingDeleteItemId === item.id ? (
                        <div className="flex items-center gap-2 rounded-md border border-[#E5E5E5] px-2 py-1.5 text-xs text-[#111111]/70">
                          <span>Remove this item?</span>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteItemId(null)}
                            className="font-medium hover:text-[#111111]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="font-semibold text-[#111111] hover:opacity-70"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteItemId(item.id)}
                          className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:text-[#111111]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <SizeQuantityGrid
                    value={item.sizeQuantities}
                    onChange={(size, qty) => handleQtyChange(item.id, size, qty)}
                    unitPrice={item.unitPrice}
                    minimumUnits={itemMinimumUnits}
                  />

                  {sizeChart && (
                    <details className="rounded-md border border-[#E5E5E5] bg-white p-3 text-xs text-[#111111]">
                      <summary className="cursor-pointer font-semibold">Fit / measurement chart</summary>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left">
                          <thead className="text-[#111111]/50">
                            <tr>
                              <th className="py-1 pr-3">Size</th>
                              <th className="py-1 pr-3">Chest</th>
                              <th className="py-1 pr-3">Length</th>
                              <th className="py-1 pr-3">Shoulder</th>
                              <th className="py-1 pr-3">Sleeve</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizeChart.sizes.map((row) => (
                              <tr key={row.size} className="border-t border-[#E5E5E5]">
                                <td className="py-1.5 pr-3 font-medium">{row.size}</td>
                                <td className="py-1.5 pr-3">{row.chest}</td>
                                <td className="py-1.5 pr-3">{row.length}</td>
                                <td className="py-1.5 pr-3">{row.shoulder ?? "-"}</td>
                                <td className="py-1.5 pr-3">{row.sleeve ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sizeChart.note && <p className="mt-2 text-[#111111]/55">{sizeChart.note}</p>}
                    </details>
                  )}

                  <div className="rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm text-[#111111]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">Item total</span>
                      <span className="font-semibold">
                        {formatInr(item.unitPrice)} x {itemUnits} = {formatInr(garmentTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between border-t border-[#E5E5E5] pt-3 text-sm font-medium text-[#111111]">
                    <span>Item subtotal</span>
                    <span>{formatInr(itemSubtotal(item))}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <CartSummarySidebar
        subtotal={totals.subtotal}
        volumeDiscount={totals.volumeDiscount}
        shippingFee={totals.shippingFee}
        gst={totals.gst}
        delivery="Calculated at shipping"
        total={totals.total}
        onNext={handleNext}
        nextLabel="Next: Invoice & Shipping"
        nextDisabled={cartUnitCount < 50}
      />
    </div>
  );
}

function OrderItemSkeleton() {
  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-5" aria-label="Loading order items">
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="h-56 w-full shrink-0 rounded-md bg-[#F7F7F7] md:w-44" />
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded bg-[#F7F7F7]" />
            <div className="h-4 w-28 rounded bg-[#F7F7F7]" />
          </div>
          <div className="grid grid-cols-6 gap-px overflow-hidden rounded-md border border-[#E5E5E5] bg-[#E5E5E5]">
            {SIZES.map((size) => (
              <div key={size} className="h-16 bg-[#F7F7F7]" />
            ))}
          </div>
          <div className="h-12 rounded-md bg-[#F7F7F7]" />
        </div>
      </div>
    </section>
  );
}
