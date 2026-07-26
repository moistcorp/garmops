'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, LoaderCircle, Plus } from 'lucide-react';
import type { ProductId } from '@/lib/configurator/pricing';
import type { GarmentColour, Artwork, NeckLabel } from '@/lib/configurator/types/configurator';
import type { GarmentView } from '@/lib/configurator/types/garment';
import { SizeQuantityGrid, SIZES, type Size } from './SizeQuantityGrid';
import { CartSummarySidebar } from './CartSummarySidebar';
import { CheckoutSteps } from './CheckoutSteps';
import {
  calculateTotals,
  createDraft,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
  writeDraft,
} from './cartDraft';
import { formatInr } from '@/lib/configurator/pricing';
import { CUSTOM_DYE_MOQ_UNITS } from '@/lib/configurator/colours';
import { getSizeChart } from '@/lib/sizecharts';
import { getProduct } from '@/lib/configurator/products';
import CanvasRenderer from '../GarmentPreview/CanvasRenderer';
import { ArtworkPositionProvider } from '@/lib/configurator/ArtworkPositionContext';
import { restoreConfigurationUploads } from '@/lib/configurator/objectUrls';
import { generateApprovalPdf } from '@/lib/configurator/approvalPdf';
import { RESERVATION_FEE } from '@/lib/configurator/reservation';

export interface CartItem {
  id: string;
  productId: ProductId;
  productName: string;
  previewImage: string;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  sizeQuantities: Record<Size, number>;
  baseUnitPrice?: number;
  unitPrice: number;
  rushDelivery?: boolean;
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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const realDraft = readDraft(cartId);
      const items = await Promise.all(
        realDraft.items.map(async (item) => {
          const uploads = await restoreConfigurationUploads(
            item.artwork,
            item.neckLabel
          );
          return {
            ...item,
            artwork: uploads.artwork,
            neckLabel: uploads.neckLabel,
          };
        })
      );
      if (cancelled) return;
      const restoredDraft = { ...realDraft, items };
      setDraft(restoredDraft);
      setActiveView(Object.fromEntries(items.map((item) => [item.id, 'front'])));
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

          const sizeQuantities = { ...item.sizeQuantities, [size]: safeQty };
          return {
            ...item,
            sizeQuantities,
            unitPrice: getCartItemUnitPrice({ ...item, sizeQuantities }),
          };
        }),
      };
      writeDraft(cartId, next);
      return next;
    });
  }

  function handleEdit(item: CartItem) {
    const query = new URLSearchParams({ cartId, itemId: item.id });
    router.push(
      `/configurator/build/${encodeURIComponent(item.productId)}?${query.toString()}`
    );
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

  async function handleDownloadApprovalPdf() {
    if (!items.length) return;
    setIsDownloadingPdf(true);
    try {
      const previewDataUrls: Record<string, string | undefined> = {};
      items.forEach((item) => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          `[data-approval-preview=\"${CSS.escape(item.id)}\"] canvas`
        );
        try {
          previewDataUrls[item.id] = canvas?.toDataURL('image/jpeg', 0.86);
        } catch {
          previewDataUrls[item.id] = undefined;
        }
      });
      await generateApprovalPdf({
        projectReference: cartId,
        documentTitle: 'Merch Approval Proposal',
        items: items.map((item) => ({
          id: item.id,
          productName: item.productName,
          previewImage: item.previewImage,
          colour: item.colour,
          artwork: item.artwork,
          neckLabel: item.neckLabel,
          sizeQuantities: item.sizeQuantities,
          unitPrice: getCartItemUnitPrice(item),
        })),
        totals: {
          subtotal: totals.subtotal,
          volumeDiscount: totals.volumeDiscount,
          gst: totals.gst,
          total: totals.total,
          reservationFee: RESERVATION_FEE,
          balanceDue: totals.balanceDue,
        },
        companyName: draft.shippingAddress.company || undefined,
        contactName: `${draft.shippingAddress.firstName} ${draft.shippingAddress.lastName}`.trim() || undefined,
        deliveryLabel: draft.selectedDeliveryDateIso
          ? new Date(draft.selectedDeliveryDateIso).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'To be selected',
        previewDataUrls,
        filename: `Garmops-Approval-${cartId}.pdf`,
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  const totals = calculateTotals(items);
  const cartUnitCount = items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0);
  const cartIsValid =
    items.length > 0 &&
    items.every((item) => {
      const minimumUnits =
        item.colour.type === 'custom_dye' ? CUSTOM_DYE_MOQ_UNITS : 50;
      return totalUnits(item.sizeQuantities) >= minimumUnits;
    });

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
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111]"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              Back to configurator
            </button>
            <button
              type="button"
              onClick={handleDownloadApprovalPdf}
              disabled={!draftLoaded || items.length === 0 || isDownloadingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-teal)] px-4 py-2 text-sm font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-[#111111]/35"
            >
              {isDownloadingPdf ? (
                <LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" />
              ) : (
                <Download size={16} strokeWidth={2.2} />
              )}
              {isDownloadingPdf ? 'Creating PDF' : 'Download Approval PDF'}
            </button>
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111]"
            >
              <Plus size={16} strokeWidth={2.2} />
              Add another product
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-[var(--color-teal)]/25 bg-[var(--color-teal)]/5 p-4">
          <p className="text-sm font-semibold text-[#111111]">Built for internal approvals</p>
          <p className="mt-1 text-sm leading-relaxed text-[#111111]/60">
            Download a dated proposal with customised product details, artwork placement, size allocation, pricing and the reservation workflow. Forward it to your manager, Finance or Procurement team.
          </p>
        </section>

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
              className="mt-5 rounded-full bg-[var(--color-teal)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add product
            </button>
          </section>
        )}

        {draftLoaded && items.map((item) => {
          const selectedView = activeView[item.id] ?? 'front';
          const itemUnits = totalUnits(item.sizeQuantities);
          const itemMinimumUnits = item.colour.type === 'custom_dye' ? CUSTOM_DYE_MOQ_UNITS : 50;
          const itemSizes = getProduct(item.productId)?.sizes ?? SIZES;
          const sizeChart = getSizeChart(item.productId);
          const itemUnitPrice = getCartItemUnitPrice(item);
          const itemDiscountPercent = getCartItemDiscountPercent(item);
          const garmentTotal = itemUnitPrice * itemUnits;
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
                  <div
                    data-approval-preview={item.id}
                    aria-hidden="true"
                    className="pointer-events-none fixed -left-[10000px] top-0 h-[480px] w-[360px] opacity-0"
                  >
                    <ArtworkPositionProvider activeView="front">
                      <CanvasRenderer
                        view="front"
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
                            ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-white'
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
                        className="rounded-full border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[#111111]"
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
                          className="rounded-full border border-[#E5E5E5] px-3 py-1.5 text-xs text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[#111111]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-xs leading-relaxed text-[#111111]/60">
                    We applied a recommended company-order size mix to the quantity selected in Studio. Adjust any size below before continuing; the total and volume price update automatically.
                  </div>

                  <SizeQuantityGrid
                    value={item.sizeQuantities}
                    onChange={(size, qty) => handleQtyChange(item.id, size, qty)}
                    unitPrice={itemUnitPrice}
                    minimumUnits={itemMinimumUnits}
                    sizes={itemSizes}
                    idPrefix={item.id}
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
                      <span className="flex items-center gap-2 text-right font-semibold">
                        {itemDiscountPercent > 0 && (
                          <span className="rounded-full bg-[#EAF7EA] px-2 py-0.5 text-[10px] font-medium text-[#1B7F36]">
                            {itemDiscountPercent}% off
                          </span>
                        )}
                        <span>
                          {formatInr(itemUnitPrice)} x {itemUnits} = {formatInr(garmentTotal)}
                        </span>
                      </span>
                    </div>
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
        nextDisabled={!cartIsValid || cartUnitCount < 50}
        disabledMessage={
          !cartIsValid || cartUnitCount < 50
            ? "Complete the size allocation and ensure every product meets its minimum order quantity."
            : undefined
        }
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
