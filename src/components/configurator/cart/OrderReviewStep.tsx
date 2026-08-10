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
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
  writeDraft,
  type CartDraft,
} from './cartDraft';
import {
  formatInr,
  getConfiguredLinePricingPaise,
  VOLUME_DISCOUNT_TIERS,
} from '@/lib/configurator/pricing';
import { CUSTOM_DYE_MOQ_UNITS } from '@/lib/configurator/colourRules';
import { getSizeChart } from '@/lib/sizecharts';
import type { SizeChart, SizeRow } from '@/lib/sizecharts';
import { getProduct, getProductMinimumOrderQuantity } from '@/lib/configurator/products';
import CanvasRenderer from '../GarmentPreview/CanvasRenderer';
import { NECK_PREVIEW_CANVAS_CLASS } from '../GarmentPreview/GarmentPreview';
import ViewTabs from '../GarmentPreview/ViewTabs';
import { ArtworkPositionProvider } from '@/lib/configurator/ArtworkPositionContext';
import { restoreConfigurationUploads } from '@/lib/configurator/objectUrls';
import { ActionFeedback, type ActionFeedbackTone } from '../ActionFeedback';
import { trackConfiguratorEvent } from '@/lib/configurator/analytics';
import { getArtworkSizeConflict } from '@/lib/configurator/artworkSizing';
import {
  MAX_CONFIGURATION_QUANTITY,
  normalizeSizeQuantity,
} from '@/lib/configurator/sizeQuantity';

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
  /** Earlier Studio quantity, shown only as context until sizes are allocated. */
  plannedQuantity?: number;
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

        const currentTotal = totalUnits(item.sizeQuantities);
        const currentSizeQty = item.sizeQuantities[size] ?? 0;
        const otherSizesTotal = currentTotal - currentSizeQty;
        const safeQty = normalizeSizeQuantity(
          qty,
          MAX_CONFIGURATION_QUANTITY - otherSizesTotal,
        );

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
      const quantity = totalUnits(item.sizeQuantities);
      return quantity >= minimumUnits &&
        quantity <= MAX_CONFIGURATION_QUANTITY &&
        !getArtworkSizeConflict(item.artwork, item.sizeQuantities);
    });

  const cartValidationMessage = (() => {
    if (!items.length) return "Add a product before continuing.";
    for (const item of items) {
      const quantity = totalUnits(item.sizeQuantities);
      const minimum = getProductMinimumOrderQuantity(item.productId, {
        colourType: item.colour.type,
        customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
      });
      if (quantity === 0) return `Enter a quantity for ${item.productName}.`;
      if (quantity < minimum) {
        return `Add ${(minimum - quantity).toLocaleString("en-IN")} more pieces to ${item.productName} to meet its ${minimum.toLocaleString("en-IN")}-piece minimum.`;
      }
      if (quantity > MAX_CONFIGURATION_QUANTITY) {
        return `${item.productName} exceeds the supported quantity limit.`;
      }
      if (getArtworkSizeConflict(item.artwork, item.sizeQuantities)) {
        return `Adjust the artwork or remove the conflicting size for ${item.productName}.`;
      }
    }
    return undefined;
  })();

  return (
    <>
      <ConfiguratorTopBar
        currentStep="quantity"
        backHref="/configurator"
        onDownloadPdf={handleDownloadApprovalPdf}
        isDownloadingPdf={isDownloadingPdf}
        isDownloadDisabled={!draftLoaded || !cartIsValid}
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
            <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-accent)]">
              Sizes &amp; quantity
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Choose sizes &amp; quantity</h1>
            <p className="mt-1 text-sm text-[var(--text-primary)]/55">
              Add the number of pieces you need in each size.
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
          const linePricing = getConfiguredLinePricingPaise({
            productId: item.productId,
            colour: item.colour,
            artwork: item.artwork,
            neckLabel: item.neckLabel,
            quantity: itemUnits,
          });
          const itemUnitPrice = linePricing.discountedUnitPaise / 100;
          const garmentTotal = linePricing.discountedSubtotalPaise / 100;
          const nextTier = VOLUME_DISCOUNT_TIERS.find((tier) => tier.minQty > itemUnits);
          const nextTierPricing = nextTier
            ? getConfiguredLinePricingPaise({
                productId: item.productId,
                colour: item.colour,
                artwork: item.artwork,
                neckLabel: item.neckLabel,
                quantity: nextTier.minQty,
              })
            : null;
          const artworkSizeConflict = getArtworkSizeConflict(item.artwork, item.sizeQuantities);
          const quantityShortfall = Math.max(0, itemMinimumUnits - itemUnits);
          const nonZeroSizes = itemSizes.filter((size) => (item.sizeQuantities[size] ?? 0) > 0);
          const isOneSize = itemSizes.length === 1 && itemSizes[0] === "One Size";
          return (
            <section key={item.id} className="techpack-panel rounded-[4px] border p-5">
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="w-full shrink-0 md:w-44">
                  <div className="relative isolate aspect-[3/4] overflow-hidden rounded-[4px] bg-[#F7F7F7]">
                    <div className={`absolute flex items-center justify-center ${
                      selectedView === "neck" ? "inset-0" : "inset-[9%]"
                    }`}>
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
                              : "h-full w-full bg-[#F7F7F7]"
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
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                        Line {itemIndex + 1}
                      </p>
                      <h2 className="text-lg font-medium text-[var(--text-primary)]">
                        {item.productName}
                      </h2>
                      <p className="text-sm text-[var(--text-primary)]/60">
                        {item.colour.name} · <span className="font-mono">{itemUnits ? `${itemUnits.toLocaleString("en-IN")} pieces allocated` : "Ready for size allocation"}</span>
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

                  <div className="grid gap-px overflow-hidden border border-[var(--color-rule)] bg-[var(--color-rule)] sm:grid-cols-2">
                    <div className="bg-white px-4 py-3">
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]/45">Minimum order</p>
                      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                        {itemMinimumUnits.toLocaleString("en-IN")} pieces
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-primary)]/55">Minimum applies to this product configuration.</p>
                    </div>
                    <div className="bg-white px-4 py-3">
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">Total quantity</p>
                      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                        {itemUnits.toLocaleString("en-IN")} pieces
                      </p>
                      <p className={`mt-1 text-xs ${quantityShortfall ? "text-amber-800" : "text-[var(--color-accent-dark)]"}`} aria-live="polite">
                        {itemUnits === 0
                          ? "No quantities entered."
                          : quantityShortfall
                            ? `${quantityShortfall.toLocaleString("en-IN")} more pieces needed to meet the ${itemMinimumUnits.toLocaleString("en-IN")}-piece minimum.`
                            : itemUnits === itemMinimumUnits
                              ? "Minimum order reached ✓"
                              : "Minimum order met."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {isOneSize ? "Choose quantity" : "Allocate by size"}
                    </h3>
                    {!isOneSize && (
                      <p className="mt-1 text-xs text-[var(--text-primary)]/55">
                        Not sure about your size split? View the size chart to plan quantities.
                      </p>
                    )}
                  </div>

                  <SizeQuantityGrid
                    value={item.sizeQuantities}
                    onChange={(size, qty) => handleQtyChange(item.id, size, qty)}
                    minimumUnits={itemMinimumUnits}
                    maximumUnits={MAX_CONFIGURATION_QUANTITY}
                    sizes={itemSizes}
                    idPrefix={item.id}
                  />

                  {!isOneSize && item.plannedQuantity && item.plannedQuantity !== itemUnits && (
                    <p className="text-xs leading-relaxed text-[var(--text-primary)]/55">
                      Earlier quantity: {item.plannedQuantity.toLocaleString("en-IN")} pieces. Allocate the pieces you actually need above; this size allocation becomes final.
                    </p>
                  )}

                  {artworkSizeConflict && (
                    <div className="flex flex-col gap-3 rounded-[4px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
                      <div>
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Artwork adjustment needed</p>
                        <p className="mt-1 text-xs leading-relaxed">
                          Your artwork was positioned for {artworkSizeConflict.configuredFor} and above. You&apos;ve added size {artworkSizeConflict.actualSmallestSize}, which has a smaller printable area.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/configurator/build/${encodeURIComponent(item.productId)}?cartId=${encodeURIComponent(cartId)}&itemId=${encodeURIComponent(item.id)}&step=artwork&returnTo=size-quantity`)}
                          className="rounded-[4px] border border-amber-900/25 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                        >
                          Adjust artwork →
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, artworkSizeConflict.actualSmallestSize, 0)}
                          className="rounded-[4px] border border-amber-900/25 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                        >
                          Remove {artworkSizeConflict.actualSmallestSize}
                        </button>
                      </div>
                    </div>
                  )}

                  {sizeChart && (
                    <details className="techpack-control rounded-[4px] border p-3 text-xs text-[var(--text-primary)]">
                      <summary className="cursor-pointer font-semibold text-[var(--color-accent-dark)]">View size chart →</summary>
                      <div className="mt-3 overflow-x-auto">
                        <SizeChartTable chart={sizeChart} />
                      </div>
                      {sizeChart.note && <p className="mt-2 text-[var(--text-primary)]/55">{sizeChart.note}</p>}
                    </details>
                  )}

                  <div className="grid gap-4 border-y border-[var(--color-rule)] py-4 sm:grid-cols-2">
                    <div>
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]/45">Quantity pricing</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {formatInr(itemUnitPrice)} / piece
                      </p>
                    </div>
                    {nextTier && nextTierPricing ? (
                      <div>
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]/45">Next price break</p>
                        <p className="mt-1 text-xs text-[var(--text-primary)]/70">
                          Add {(nextTier.minQty - itemUnits).toLocaleString("en-IN")} more pieces to reach {nextTier.minQty.toLocaleString("en-IN")} pieces · {formatInr(nextTierPricing.discountedUnitPaise / 100)} / piece
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]/45">Price tier</p>
                        <p className="mt-1 text-xs text-[var(--text-primary)]/70">Highest quantity tier reached.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[4px] border border-[var(--color-rule)] bg-[#F7F7F7] px-4 py-4 text-sm text-[var(--text-primary)]">
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">Size &amp; quantity</p>
                    <div className="mt-3 space-y-1.5">
                      {nonZeroSizes.length ? nonZeroSizes.map((size) => (
                        <div key={size} className="flex items-center justify-between gap-4 text-xs">
                          <span className="font-medium">{isOneSize ? "Quantity" : size}</span>
                          <span className="font-mono tabular-nums">{(item.sizeQuantities[size] ?? 0).toLocaleString("en-IN")}</span>
                        </div>
                      )) : (
                        <p className="text-xs text-[var(--text-primary)]/55">No quantities entered.</p>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-[var(--color-rule)] pt-3">
                      <div className="flex items-center justify-between gap-4 font-semibold">
                        <span>Total</span>
                        <span className="font-mono tabular-nums">{itemUnits.toLocaleString("en-IN")} pieces</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-primary)]/65">
                        <span>{formatInr(itemUnitPrice)} / piece</span>
                        <span className="font-mono font-semibold text-[var(--text-primary)]">{formatInr(garmentTotal)} subtotal</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          );
        })}
        </div>

        <div className="lg:sticky lg:top-40 lg:self-start">
          <CartSummarySidebar
            subtotal={totals.subtotal}
            volumeDiscount={totals.volumeDiscount}
            shippingFee={totals.shippingFee}
            gst={totals.gst}
            total={totals.total}
            onNext={handleNext}
            nextLabel="Continue to delivery"
            nextDisabled={!cartIsValid}
            disabledMessage={
              !cartIsValid ? cartValidationMessage : undefined
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

const SIZE_CHART_COLUMNS: Array<{
  key: Exclude<keyof SizeRow, "size">;
  label: string;
}> = [
  { key: "chest", label: "Chest" },
  { key: "length", label: "Length" },
  { key: "shoulder", label: "Shoulder" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "inseam", label: "Inseam" },
  { key: "handles", label: "Handles" },
];

function SizeChartTable({ chart }: { chart: SizeChart }) {
  const columns = SIZE_CHART_COLUMNS.filter(({ key }) =>
    chart.sizes.some((row) => Boolean(row[key])),
  ).map((column) => ({
    ...column,
    label: column.key === "chest"
      ? chart.chestLabel ?? column.label
      : column.key === "length"
        ? chart.lengthLabel ?? column.label
        : column.label,
  }));

  return (
    <table className="w-full min-w-[360px] text-left">
      <thead className="text-[var(--text-primary)]/50">
        <tr>
          <th className="py-1 pr-3">Size</th>
          {columns.map((column) => (
            <th key={column.key} className="py-1 pr-3">{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.sizes.map((row) => (
          <tr key={row.size} className="border-t border-[#E5E5E5]">
            <td className="py-1.5 pr-3 font-medium">{row.size}</td>
            {columns.map((column) => (
              <td key={column.key} className="py-1.5 pr-3">{row[column.key] ?? "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
