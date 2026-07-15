'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductId } from '@/lib/configurator/pricing';
import type { GarmentColour, Artwork, NeckLabel } from '@/lib/configurator/types/configurator';
import type { GarmentView } from '@/lib/configurator/types/garment';
import { SizeQuantityGrid, type Size } from './SizeQuantityGrid';
import { DevelopmentCostsTable } from './DevelopmentCostsTable';
import { CartSummarySidebar } from './CartSummarySidebar';
import { calculateTotals, itemSubtotal, readDraft, totalUnits, writeDraft } from './cartDraft';
import { formatInr } from '@/lib/configurator/pricing';

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
  artworkFees: DevelopmentCostLine[];
  applicationFees: DevelopmentCostLine[];
}

export interface OrderReviewStepProps {
  cartId: string;
}

const GARMENT_VIEWS: GarmentView[] = ['front', 'neck', 'back'];

export function OrderReviewStep({ cartId }: OrderReviewStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => readDraft(cartId));
  const items = draft.items;
  const [activeView, setActiveView] = useState<Record<string, GarmentView>>(
    () => Object.fromEntries(readDraft(cartId).items.map((item) => [item.id, 'front']))
  );

  function handleQtyChange(itemId: string, size: Size, qty: number) {
    setDraft((prev) => {
      const next = {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId
            ? { ...item, sizeQuantities: { ...item.sizeQuantities, [size]: qty } }
            : item
        ),
      };
      writeDraft(cartId, next);
      return next;
    });
  }

  function handleEdit() {
    router.push(`/configurator/build/${encodeURIComponent(cartId)}`);
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
  }

  function handleAddAnotherProduct() {
    router.push('/configurator');
  }

  function handleNext() {
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`);
  }

  const totals = calculateTotals(items);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
              Cart {cartId}
            </p>
            <h1 className="text-2xl font-semibold text-[#111111]">Order Summary</h1>
          </div>
          <button
            type="button"
            onClick={handleAddAnotherProduct}
            className="self-start rounded-md border border-[#111111] px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#111111] hover:text-white sm:self-auto"
          >
            Add another product
          </button>
        </div>

        {items.length === 0 && (
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

        {items.map((item) => {
          const selectedView = activeView[item.id] ?? 'front';
          const itemUnits = totalUnits(item.sizeQuantities);
          const garmentTotal = item.unitPrice * itemUnits;

          return (
            <section key={item.id} className="rounded-lg border border-[#E5E5E5] bg-white p-5">
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="w-full shrink-0 md:w-44">
                  <div className="aspect-[3/4] overflow-hidden rounded-md bg-[#F7F7F7]">
                    <img
                      src={item.previewImage}
                      alt={`${item.productName} preview`}
                      className="h-full w-full object-cover"
                    />
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
                        onClick={handleEdit}
                        className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:text-[#111111]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:text-[#111111]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <SizeQuantityGrid
                    value={item.sizeQuantities}
                    onChange={(size, qty) => handleQtyChange(item.id, size, qty)}
                    unitPrice={item.unitPrice}
                  />

                  <div className="rounded-md bg-[#F7F7F7] px-4 py-3 text-sm text-[#111111]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">Garment total</span>
                      <span className="font-semibold">
                        {formatInr(item.unitPrice)} x {itemUnits} = {formatInr(garmentTotal)}
                      </span>
                    </div>
                  </div>

                  <DevelopmentCostsTable
                    artworkFees={item.artworkFees}
                    applicationFees={item.applicationFees}
                  />

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
        delivery="Calculated at shipping"
        total={totals.total}
        onNext={handleNext}
        nextLabel="Next: Invoice & Shipping"
        nextDisabled={items.length === 0}
      />
    </div>
  );
}
