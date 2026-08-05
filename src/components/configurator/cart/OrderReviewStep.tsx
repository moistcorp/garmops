'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductId } from '@/lib/configurator/pricing';
import type { GarmentColour, Artwork, NeckLabel } from '@/lib/configurator/types/configurator';
import type { GarmentView } from '@/lib/configurator/types/garment';
import { SizeQuantityGrid, SIZES, type Size } from './SizeQuantityGrid';
import { CartSummarySidebar } from './CartSummarySidebar';
import {
  ConfiguratorTopBar,
  getCartProductLabel,
  getCartJourneyLinks,
} from '../ConfiguratorTopBar';
import {
  calculateTotals,
  createDraft,
  MAX_CONFIGURED_CART_ITEMS,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
  writeDraft,
  type CartDraft,
} from './cartDraft';
import { formatInr } from '@/lib/configurator/pricing';
import { CUSTOM_DYE_MOQ_UNITS } from '@/lib/configurator/colourRules';
import { getSizeChart } from '@/lib/sizecharts';
import { getProduct, getProductMinimumOrderQuantity } from '@/lib/configurator/products';
import CanvasRenderer from '../GarmentPreview/CanvasRenderer';
import { NECK_PREVIEW_CANVAS_CLASS } from '../GarmentPreview/GarmentPreview';
import ViewTabs from '../GarmentPreview/ViewTabs';
import { ArtworkPositionProvider } from '@/lib/configurator/ArtworkPositionContext';
import { restoreConfigurationUploads } from '@/lib/configurator/objectUrls';
import { ActionFeedback, type ActionFeedbackTone } from '../ActionFeedback';
import { trackConfiguratorEvent } from '@/lib/configurator/analytics';
import { formatSpecCode } from '@/lib/orders/format';

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
  const [feedback, setFeedback] = useState<{ tone: ActionFeedbackTone; title: string; detail?: string } | null>(null);
  const draftNeedsPersistenceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        const realDraft = readDraft(cartId);
        const items = await Promise.all(
          realDraft.items.map(async (item) => {
            const uploads = await restoreConfigurationUploads(item.artwork, item.neckLabel);
            return { ...item, artwork: uploads.artwork, neckLabel: uploads.neckLabel };
          })
        );
        if (cancelled) return;
        const restoredDraft = { ...realDraft, items };
        setDraft(restoredDraft);
        setActiveView(Object.fromEntries(items.map((item) => [item.id, 'front'])));
        const updatedMessage = window.sessionStorage.getItem('garmops:cart-update');
        if (updatedMessage) {
          window.sessionStorage.removeItem('garmops:cart-update');
          if (updatedMessage !== 'Design updated successfully.') {
            setFeedback({ tone: 'success', title: updatedMessage });
          }
        }
      } catch {
        if (!cancelled) setFeedback({ tone: 'error', title: 'Could not restore the cart', detail: 'Your browser draft may be unavailable. Reload once or return to the configurator.' });
      } finally {
        if (!cancelled) setDraftLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cartId]);

  useEffect(() => {
    if (!draftLoaded || !draftNeedsPersistenceRef.current) return;
    draftNeedsPersistenceRef.current = false;
    const saved = writeDraft(cartId, draft);
    if (!saved) {
      window.queueMicrotask(() => {
        setFeedback({
          tone: 'error',
          title: 'Cart autosave is unavailable',
          detail: 'Your latest edits are still visible in this tab. Keep it open and try again before continuing.',
        });
      });
    }
  }, [cartId, draft, draftLoaded]);

  function updateDraft(updater: (previous: CartDraft) => CartDraft) {
    draftNeedsPersistenceRef.current = true;
    setDraft(updater);
  }

  function handleQtyChange(itemId: string, size: Size, qty: number) {
    updateDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;

        const currentSizeQty = item.sizeQuantities[size] ?? 0;
        const currentTotal = totalUnits(item.sizeQuantities);
        const minimumUnits = getProductMinimumOrderQuantity(item.productId, { colourType: item.colour.type, customDyeMinimum: CUSTOM_DYE_MOQ_UNITS });
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
    }));
    trackConfiguratorEvent("size_allocation_edited", { cart_id: cartId, item_id: itemId, size, quantity: qty });
  }

  function handleEdit(item: CartItem) {
    const query = new URLSearchParams({ cartId, itemId: item.id });
    router.push(
      `/configurator/build/${encodeURIComponent(item.productId)}?${query.toString()}`
    );
  }

  function handleDelete(itemId: string) {
    updateDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
    setActiveView((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setPendingDeleteItemId(null);
  }

  function handleRemoveArtworkSide(itemId: string, side: "front" | "back") {
    updateDraft((previous) => {
      const nextItems = previous.items.map((item) => {
        if (item.id !== itemId) return item;
        const artwork = { ...item.artwork, [side]: undefined };
        const updated = { ...item, artwork, baseUnitPrice: undefined };
        return { ...updated, unitPrice: getCartItemUnitPrice(updated) };
      });
      return { ...previous, items: nextItems };
    });
    setFeedback({
      tone: "success",
      title: `${side === "front" ? "Front" : "Back"} artwork removed`,
      detail: "The estimate has been recalculated. You can add it again from Edit design.",
    });
    trackConfiguratorEvent("cart_item_updated", {
      cart_id: cartId,
      item_id: itemId,
      change: `${side}_artwork_removed`,
    });
  }

  function handleAddAnotherProduct() {
    router.push(`/configurator?cartId=${encodeURIComponent(cartId)}`);
  }

  function handleNext() {
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`);
  }

  async function handleDownloadApprovalPdf() {
    if (!items.length) return;
    setIsDownloadingPdf(true);
    setFeedback({ tone: 'loading', title: 'Preparing approval PDF…', detail: 'Adding previews, sizes, pricing and payment details.' });
    trackConfiguratorEvent('approval_pdf_started', { source: 'cart', cart_id: cartId });
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
      const { generateApprovalPdf } = await import('@/lib/configurator/approvalPdf');
      await generateApprovalPdf({
        projectReference: cartId,
        documentTitle: draft.projectName.trim() || 'Merch Approval Proposal',
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
        },
        contactName: `${draft.projectContact.firstName} ${draft.projectContact.lastName}`.trim() || undefined,
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
      setFeedback({ tone: 'success', title: 'Approval PDF downloaded', detail: 'This dated version can be forwarded for internal approval.' });
      trackConfiguratorEvent('approval_pdf_downloaded', { source: 'cart', cart_id: cartId });
    } catch {
      setFeedback({ tone: 'error', title: 'Could not create the PDF', detail: 'Your cart is safe. Check the connection and try again.', });
      trackConfiguratorEvent('approval_pdf_failed', { source: 'cart', cart_id: cartId });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  const totals = calculateTotals(items);
  const cartIsValid =
    items.length > 0 &&
    items.every((item) => {
      const minimumUnits = getProductMinimumOrderQuantity(item.productId, { colourType: item.colour.type, customDyeMinimum: CUSTOM_DYE_MOQ_UNITS });
      return totalUnits(item.sizeQuantities) >= minimumUnits;
    });

  return (
    <>
      <ConfiguratorTopBar
        currentStep="quantity"
        backHref="/configurator"
        onDownloadPdf={handleDownloadApprovalPdf}
        isDownloadingPdf={isDownloadingPdf}
        isDownloadDisabled={!draftLoaded || items.length === 0}
        showCart
        productName={getCartProductLabel(items)}
        specReference={`CART-${cartId}`}
        links={getCartJourneyLinks(cartId, items[0]?.productId, items[0]?.id)}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
        {feedback && <ActionFeedback {...feedback} onDismiss={feedback.tone === 'loading' ? undefined : () => setFeedback(null)} actionLabel={feedback.tone === 'error' ? 'Retry PDF' : undefined} onAction={feedback.tone === 'error' ? handleDownloadApprovalPdf : undefined} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-primary)]/50">
              {formatSpecCode(`CART-${cartId}`)}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Sizes &amp; quantity</h1>
            <p className="mt-1 text-sm text-[var(--text-primary)]/55">
              Confirm the final size allocation for every configured product.
            </p>
          </div>
          {draftLoaded && items.length > 0 && (
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              disabled={items.length >= MAX_CONFIGURED_CART_ITEMS}
              className="rounded-[4px] border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-dark)] hover:bg-[var(--color-accent)]/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {items.length >= MAX_CONFIGURED_CART_ITEMS ? "Cart limit reached" : "Add another product"}
            </button>
          )}
        </div>

        {!draftLoaded && <OrderItemSkeleton />}

        {draftLoaded && items.length === 0 && (
          <section className="techpack-surface rounded-[4px] border p-8 text-center">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">Your cart is empty</h2>
            <p className="mt-1 text-sm text-[var(--text-primary)]/60">
              Add a product to continue your order.
            </p>
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              className="mt-5 rounded-[4px] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add product
            </button>
          </section>
        )}

        {draftLoaded && items.map((item, itemIndex) => {
          const selectedView = activeView[item.id] ?? 'front';
          const itemUnits = totalUnits(item.sizeQuantities);
          const itemMinimumUnits = getProductMinimumOrderQuantity(item.productId, { colourType: item.colour.type, customDyeMinimum: CUSTOM_DYE_MOQ_UNITS });
          const itemSizes = getProduct(item.productId)?.sizes ?? SIZES;
          const sizeChart = getSizeChart(item.productId);
          const itemUnitPrice = getCartItemUnitPrice(item);
          const itemDiscountPercent = getCartItemDiscountPercent(item);
          const garmentTotal = itemUnitPrice * itemUnits;
          return (
            <section key={item.id} className="techpack-panel rounded-[4px] border p-5">
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="w-full shrink-0 md:w-44">
                  <div className="relative isolate aspect-[3/4] overflow-hidden rounded-[4px] bg-[#F7F7F7]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ArtworkPositionProvider activeView={selectedView}>
                        <CanvasRenderer
                          view={selectedView}
                          colourHex={item.colour.hex}
                          productId={item.productId}
                          artwork={item.artwork}
                          neckLabel={item.neckLabel}
                          interactive={false}
                          className={
                            selectedView === "neck"
                              ? NECK_PREVIEW_CANVAS_CLASS
                              : "h-full w-full scale-[0.82] bg-[#F7F7F7]"
                          }
                        />
                      </ArtworkPositionProvider>
                    </div>
                    <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
                      <ViewTabs
                        activeView={selectedView}
                        onChange={(view) =>
                          setActiveView((previous) => ({
                            ...previous,
                            [item.id]: view,
                          }))
                        }
                        productId={item.productId}
                      />
                    </div>
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
                        className="h-full w-full scale-[0.82] bg-[#F7F7F7]"
                      />
                    </ArtworkPositionProvider>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                        Line {itemIndex + 1}
                      </p>
                      <h2 className="text-lg font-medium text-[var(--text-primary)]">
                        {item.productName}
                      </h2>
                      <p className="text-sm text-[var(--text-primary)]/60">
                        {item.colour.name} · <span className="font-mono">{itemUnits} units</span>
                      </p>
                    </div>
                    <div className="flex max-w-[420px] shrink-0 flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-[4px] border border-[#E5E5E5] px-3 py-1.5 text-xs text-[var(--text-primary)]/70 hover:border-[var(--color-accent)] hover:text-[var(--text-primary)]"
                      >
                        Edit design
                      </button>
                      {item.artwork.front && <button type="button" onClick={() => handleRemoveArtworkSide(item.id, "front")} className="rounded-[4px] border border-[#E5E5E5] px-3 py-1.5 text-xs text-[var(--text-primary)]/70 hover:border-[var(--color-accent)]">Remove front print</button>}
                      {item.artwork.back && <button type="button" onClick={() => handleRemoveArtworkSide(item.id, "back")} className="rounded-[4px] border border-[#E5E5E5] px-3 py-1.5 text-xs text-[var(--text-primary)]/70 hover:border-[var(--color-accent)]">Remove back print</button>}
                      {pendingDeleteItemId === item.id ? (
                        <div className="flex items-center gap-2 rounded-[4px] border border-[#E5E5E5] px-2 py-1.5 text-xs text-[var(--text-primary)]/70">
                          <span>Remove this item?</span>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteItemId(null)}
                            className="font-medium hover:text-[var(--text-primary)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="font-semibold text-[var(--text-primary)] hover:opacity-70"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteItemId(item.id)}
                          className="rounded-[4px] border border-[#E5E5E5] px-3 py-1.5 text-xs text-[var(--text-primary)]/70 hover:border-[var(--color-accent)] hover:text-[var(--text-primary)]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[4px] border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)]/60">
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
                    <details className="techpack-control rounded-[4px] border p-3 text-xs text-[var(--text-primary)]">
                      <summary className="cursor-pointer font-semibold">Fit / measurement chart</summary>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left">
                          <thead className="text-[var(--text-primary)]/50">
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
                      {sizeChart.note && <p className="mt-2 text-[var(--text-primary)]/55">{sizeChart.note}</p>}
                    </details>
                  )}

                  <div className="rounded-[4px] border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3 text-sm text-[var(--text-primary)]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">Item total</span>
                      <span className="flex items-center gap-2 text-right font-semibold">
                        {itemDiscountPercent > 0 && (
                          <span className="rounded-[4px] bg-[#EAF7EA] px-2 py-0.5 text-[10px] font-medium text-[#1B7F36]">
                            {itemDiscountPercent}% off
                          </span>
                        )}
                        <span className="font-mono">
                          {formatInr(itemUnitPrice)} × {itemUnits} = {formatInr(garmentTotal)}
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

        <div className="lg:sticky lg:top-36 lg:self-start">
          <CartSummarySidebar
            subtotal={totals.subtotal}
            volumeDiscount={totals.volumeDiscount}
            shippingFee={totals.shippingFee}
            gst={totals.gst}
            delivery="Calculated at shipping"
            total={totals.total}
            onNext={handleNext}
            nextLabel="Confirm spec · delivery"
            nextDisabled={!cartIsValid}
            disabledMessage={
              !cartIsValid
                ? "Every cart line must independently meet that product’s minimum quantity."
                : undefined
            }
            sticky={false}
          />
        </div>
      </div>
    </>
  );
}

function OrderItemSkeleton() {
  return (
    <section className="techpack-panel rounded-[4px] border p-5" aria-label="Loading order items">
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="h-56 w-full shrink-0 rounded-[4px] bg-[#F7F7F7] md:w-44" />
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded bg-[#F7F7F7]" />
            <div className="h-4 w-28 rounded bg-[#F7F7F7]" />
          </div>
          <div className="grid grid-cols-6 gap-px overflow-hidden rounded-[4px] border border-[#E5E5E5] bg-[#E5E5E5]">
            {SIZES.map((size) => (
              <div key={size} className="h-16 bg-[#F7F7F7]" />
            ))}
          </div>
          <div className="h-12 rounded-[4px] bg-[#F7F7F7]" />
        </div>
      </div>
    </section>
  );
}
