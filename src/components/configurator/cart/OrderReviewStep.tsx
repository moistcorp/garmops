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
  getRecommendedSizeAllocation,
  MAX_CONFIGURATION_QUANTITY,
  normalizeSizeQuantity,
} from '@/lib/configurator/sizeQuantity';
import type { ConfiguredCartSummary, PricingSnapshot } from '@/lib/medusa/commerce';
import {
  getConfiguredCart,
  removeConfiguredLine,
  updateConfiguredLine,
} from '@/lib/medusa/commerce';

export interface CartItem {
  id: string;
  /** Medusa line identity; `id` remains only the local draft identity. */
  medusaLineId?: string;
  designProjectId?: string;
  designVersionId?: string;
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
  /** Pending quantity from Studio, used only to initialize an unallocated line. */
  plannedQuantity?: number;
  backendPricing?: PricingSnapshot;
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
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
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
        const canonicalCart = await getConfiguredCart(cartId);
        const localByLine = new Map(realDraft.items.filter((item) => item.medusaLineId).map((item) => [item.medusaLineId, item]));
        const localByDesign = new Map(realDraft.items.filter((item) => item.designProjectId).map((item) => [`${item.designProjectId}:${item.designVersionId ?? ""}`, item]));
        const canonicalItems = canonicalCart.lines.map((line) => {
          const local = localByLine.get(line.id) ?? localByDesign.get(`${line.projectId}:${line.versionId}`);
          if (!local) return null;
          return {
            ...local,
            medusaLineId: line.id,
            designProjectId: line.projectId,
            designVersionId: line.versionId,
            sizeQuantities: line.sizeBreakdown as Record<Size, number>,
            unitPrice: line.pricing.unitPricePaise / 100,
            backendPricing: line.pricing,
            plannedQuantity: undefined,
          };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
        const serverDraft: CartDraft = {
          ...realDraft,
          items: canonicalItems,
          serverCartId: canonicalCart.cartId,
          backendCart: canonicalCart,
        };
        writeDraft(cartId, serverDraft);
        let initializedAllocation = false;
        const items = await Promise.all(
          serverDraft.items.map(async (item) => {
            const uploads = await restoreConfigurationUploads(item.artwork, item.neckLabel);
            const hydratedItem = { ...item, artwork: uploads.artwork, neckLabel: uploads.neckLabel };
            const currentTotal = totalUnits(hydratedItem.sizeQuantities);

            // New cart lines carry plannedQuantity until they receive their
            // first size allocation. Once initialized, plannedQuantity is
            // cleared so a saved/manual zero allocation cannot be mistaken
            // for an untouched line on a later visit.
            if (currentTotal > 0 || hydratedItem.plannedQuantity === undefined) {
              return hydratedItem;
            }

            const product = getProduct(hydratedItem.productId);
            const minimumUnits = getProductMinimumOrderQuantity(hydratedItem.productId, {
              colourType: hydratedItem.colour.type,
              customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
            });
            const sizes = product?.sizes ?? Object.keys(hydratedItem.sizeQuantities);
            const targetQuantity = Math.max(minimumUnits, hydratedItem.plannedQuantity);
            const sizeQuantities = getRecommendedSizeAllocation(sizes, targetQuantity);
            initializedAllocation = true;

            return {
              ...hydratedItem,
              sizeQuantities,
              unitPrice: getCartItemUnitPrice({ ...hydratedItem, sizeQuantities }),
              plannedQuantity: undefined,
            };
          })
        );
        if (cancelled) return;
        const restoredDraft = { ...serverDraft, items };
        if (initializedAllocation) draftNeedsPersistenceRef.current = true;
        setDraft(restoredDraft);
        setActiveView(Object.fromEntries(items.map((item) => [item.id, 'front'])));
        const updatedMessage = window.sessionStorage.getItem('garmops:cart-update');
        if (updatedMessage) {
          window.sessionStorage.removeItem('garmops:cart-update');
          if (updatedMessage !== 'Design updated successfully.') {
            setFeedback({ tone: 'success', title: updatedMessage });
          }
        }
      } catch (error) {
        if (!cancelled) setFeedback({ tone: 'error', title: 'Could not restore the Medusa cart', detail: error instanceof Error ? error.message : 'The committed cart could not be loaded. Return to the configurator and try again.' });
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

  function handleQtyChange(itemId: string, size: Size, qty: number) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || !item.medusaLineId) {
      setFeedback({ tone: 'error', title: 'This draft is not synchronized', detail: 'Add the configuration to the Medusa cart before changing its quantity.' });
      return;
    }
    const currentTotal = totalUnits(item.sizeQuantities);
    const currentSizeQty = item.sizeQuantities[size] ?? 0;
    const otherSizesTotal = currentTotal - currentSizeQty;
    const safeQty = normalizeSizeQuantity(qty, MAX_CONFIGURATION_QUANTITY - otherSizesTotal);
    const sizeQuantities = { ...item.sizeQuantities, [size]: safeQty };
    void commitLineUpdate(item, sizeQuantities);
    trackConfiguratorEvent("size_allocation_edited", { cart_id: cartId, item_id: itemId, size, quantity: qty });
  }

  async function commitLineUpdate(item: CartItem, sizeQuantities: Record<Size, number>) {
    if (!item.medusaLineId) return;
    setPendingLineId(item.id);
    try {
      const result = await updateConfiguredLine({
        lineId: item.medusaLineId,
        quantity: totalUnits(sizeQuantities),
        sizes: sizeQuantities,
        deliveryType: item.rushDelivery ? "rush" : "standard",
      });
      replaceCanonicalCart(result.cart);
    } catch (error) {
      setFeedback({ tone: 'error', title: 'Quantity was not updated', detail: error instanceof Error ? error.message : 'Medusa rejected this cart-line update.' });
    } finally {
      setPendingLineId(null);
    }
  }

  function replaceCanonicalCart(canonicalCart: ConfiguredCartSummary) {
    setDraft((previous) => {
      const items = previous.items.map((item) => {
        const line = canonicalCart.lines.find((candidate) => candidate.id === item.medusaLineId);
        if (!line) return item;
        return { ...item, sizeQuantities: line.sizeBreakdown as Record<Size, number>, unitPrice: line.pricing.unitPricePaise / 100, backendPricing: line.pricing, plannedQuantity: undefined };
      });
      const next = { ...previous, items, serverCartId: canonicalCart.cartId, backendCart: canonicalCart };
      writeDraft(canonicalCart.cartId, next);
      return next;
    });
  }

  function handleResetRecommendedSplit(item: CartItem) {
    const product = getProduct(item.productId);
    const minimumUnits = getProductMinimumOrderQuantity(item.productId, { colourType: item.colour.type, customDyeMinimum: CUSTOM_DYE_MOQ_UNITS });
    const sizes = product?.sizes ?? Object.keys(item.sizeQuantities);
    const targetQuantity = Math.max(minimumUnits, totalUnits(item.sizeQuantities) || item.plannedQuantity || 0);
    void commitLineUpdate(item, getRecommendedSizeAllocation(sizes, targetQuantity));
  }

  function handleEdit(item: CartItem) {
    const query = new URLSearchParams({ cartId, itemId: item.id });
    router.push(
      `/configurator/build/${encodeURIComponent(item.productId)}?${query.toString()}`
    );
  }

  async function handleDelete(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item?.medusaLineId) return;
    setPendingLineId(item.id);
    try {
      await removeConfiguredLine(item.medusaLineId);
      const canonicalCart = await getConfiguredCart(cartId);
      replaceCanonicalCart(canonicalCart);
      setDraft((previous) => {
        const next = { ...previous, items: previous.items.filter((candidate) => candidate.id !== itemId) };
        writeDraft(cartId, next);
        return next;
      });
    } catch (error) {
      setFeedback({ tone: 'error', title: 'The cart line was not removed', detail: error instanceof Error ? error.message : 'Medusa rejected the removal.' });
    } finally {
      setPendingLineId(null);
    }
    setActiveView((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setPendingDeleteItemId(null);
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

  const totals = draft.backendCart
    ? {
        subtotal: draft.backendCart.subtotalPaise / 100,
        subtotalPaise: draft.backendCart.subtotalPaise,
        volumeDiscount: draft.backendCart.discountPaise / 100,
        volumeDiscountPaise: draft.backendCart.discountPaise,
        rushFee: draft.backendCart.rushFeePaise / 100,
        rushFeePaise: draft.backendCart.rushFeePaise,
        shippingFee: draft.backendCart.shippingPaise / 100,
        hasRushDelivery: draft.backendCart.rushFeePaise > 0,
        gst: draft.backendCart.gstPaise / 100,
        gstPaise: draft.backendCart.gstPaise,
        taxableSubtotal: (draft.backendCart.grandTotalPaise - draft.backendCart.gstPaise - draft.backendCart.shippingPaise) / 100,
        taxableSubtotalPaise: draft.backendCart.grandTotalPaise - draft.backendCart.gstPaise - draft.backendCart.shippingPaise,
        total: draft.backendCart.grandTotalPaise / 100,
        totalPaise: draft.backendCart.grandTotalPaise,
      }
    : calculateTotals(items);
  const cartIsValid =
    draft.serverCartId === cartId &&
    Boolean(draft.backendCart) &&
    (draft.backendCart?.validationProblems.length ?? 0) === 0 &&
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
    if (draft.serverCartId !== cartId || !draft.backendCart) return "Synchronize this configuration with the Medusa cart before continuing.";
    if (draft.backendCart.validationProblems[0]) return draft.backendCart.validationProblems[0];
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
            <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-(--color-accent)">
              Sizes &amp; quantity
            </p>
            <h1 className="text-2xl font-semibold text-(--text-primary)">Choose sizes &amp; quantity</h1>
            <p className="mt-1 text-sm text-(--text-primary)/55">
              Confirm your size split.
            </p>
          </div>
          {draftLoaded && items.length > 0 && (
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              disabled={items.length >= MAX_CONFIGURED_CART_ITEMS}
              className="rounded-sm border border-(--color-accent) px-4 py-2 text-sm font-semibold text-(--color-accent-dark) hover:bg-(--color-accent)/5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {items.length >= MAX_CONFIGURED_CART_ITEMS ? "Cart limit reached" : "Add another product"}
            </button>
          )}
        </div>

        {!draftLoaded && <OrderItemSkeleton />}

        {draftLoaded && items.length === 0 && (
          <section className="techpack-surface rounded-sm border p-8 text-center">
            <h2 className="text-lg font-medium text-(--text-primary)">Your cart is empty</h2>
            <p className="mt-1 text-sm text-(--text-primary)/60">
              Add a product to continue your order.
            </p>
            <button
              type="button"
              onClick={handleAddAnotherProduct}
              className="mt-5 rounded-sm bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:opacity-90"
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
          const itemUnitPrice = item.backendPricing?.unitPricePaise !== undefined
            ? item.backendPricing.unitPricePaise / 100
            : linePricing.discountedUnitPaise / 100;
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
          const currentTierMinimum = [...VOLUME_DISCOUNT_TIERS]
            .reverse()
            .find((tier) => tier.minQty <= itemUnits)?.minQty ?? 0;
          const priceBreakProgress = nextTier
            ? Math.min(
                100,
                Math.max(
                  0,
                  ((itemUnits - currentTierMinimum) /
                    Math.max(1, nextTier.minQty - currentTierMinimum)) *
                    100,
                ),
              )
            : 100;
          const artworkSizeConflict = getArtworkSizeConflict(item.artwork, item.sizeQuantities);
          const quantityShortfall = Math.max(0, itemMinimumUnits - itemUnits);
          const isOneSize = itemSizes.length === 1 && itemSizes[0] === "One Size";
          return (
            <section key={item.id} className="techpack-panel rounded-sm border p-5">
              <div className="flex flex-col gap-5 md:flex-row">
                <div className="w-full shrink-0 md:w-44">
                  <div className="relative isolate aspect-[3/4] overflow-hidden rounded-sm bg-[#F7F7F7]">
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
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-(--color-accent)">
                        Line {itemIndex + 1}
                      </p>
                      <h2 className="text-lg font-medium text-(--text-primary)">
                        {item.productName}
                      </h2>
                      <p className="text-sm text-(--text-primary)/60">
                        {item.colour.name} · <span className="font-mono">{itemUnits ? `${itemUnits.toLocaleString("en-IN")} pieces allocated` : "Ready for size allocation"}</span>
                      </p>
                    </div>
                    <div className="flex max-w-[420px] shrink-0 flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-sm border border-[#E5E5E5] px-3 py-1.5 text-xs text-(--text-primary)/70 hover:border-(--color-accent) hover:text-(--text-primary)"
                      >
                        Edit design
                      </button>
                      {pendingDeleteItemId === item.id ? (
                        <div className="flex items-center gap-2 rounded-sm border border-[#E5E5E5] px-2 py-1.5 text-xs text-(--text-primary)/70">
                          <span>Remove this item?</span>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteItemId(null)}
                            className="font-medium hover:text-(--text-primary)"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="font-semibold text-(--text-primary) hover:opacity-70"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteItemId(item.id)}
                          className="rounded-sm border border-[#E5E5E5] px-3 py-1.5 text-xs text-(--text-primary)/70 hover:border-(--color-accent) hover:text-(--text-primary)"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-3 border-y border-(--color-rule) py-2.5">
                    <div>
                      <h3 className="text-sm font-semibold text-(--text-primary)">
                        {isOneSize ? "Choose quantity" : "Allocate by size"}
                      </h3>
                      {!isOneSize && (
                        <p className="mt-0.5 text-xs text-(--text-primary)/55">
                          Use the prepared split or adjust it below.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <p
                        className={quantityShortfall ? "text-right text-xs font-medium text-amber-800" : "text-right text-xs font-medium text-(--color-accent-dark)"}
                        aria-live="polite"
                      >
                        {quantityShortfall
                          ? itemUnits.toLocaleString("en-IN") + " / " + itemMinimumUnits.toLocaleString("en-IN") + " pieces · Add " + quantityShortfall.toLocaleString("en-IN") + " more to continue"
                          : itemUnits.toLocaleString("en-IN") + " pieces allocated ✓ · Minimum " + itemMinimumUnits.toLocaleString("en-IN")}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleResetRecommendedSplit(item)}
                        className="text-xs font-medium text-(--text-primary)/60 underline decoration-(--color-rule) underline-offset-4 hover:text-(--text-primary)"
                      >
                        Reset recommended split
                      </button>
                    </div>
                  </div>

                  <SizeQuantityGrid
                    value={item.sizeQuantities}
                    onChange={(size, qty) => handleQtyChange(item.id, size, qty)}
                    minimumUnits={itemMinimumUnits}
                    maximumUnits={MAX_CONFIGURATION_QUANTITY}
                    sizes={itemSizes}
                    idPrefix={item.id}
                  />
                  {pendingLineId === item.id ? <p className="mt-2 text-xs text-(--color-accent)" role="status">Updating the Medusa cart…</p> : null}

                  {artworkSizeConflict && (
                    <div className="flex flex-col gap-3 rounded-sm border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
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
                          className="rounded-sm border border-amber-900/25 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                        >
                          Adjust artwork →
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, artworkSizeConflict.actualSmallestSize, 0)}
                          className="rounded-sm border border-amber-900/25 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
                        >
                          Remove {artworkSizeConflict.actualSmallestSize}
                        </button>
                      </div>
                    </div>
                  )}

                  {sizeChart && (
                    <details className="mt-1 text-xs text-(--text-primary)">
                      <summary className="cursor-pointer font-semibold text-(--color-accent-dark)">View size chart →</summary>
                      <div className="mt-3 overflow-x-auto rounded-sm border border-(--color-rule) p-3">
                        <SizeChartTable chart={sizeChart} />
                      </div>
                      {sizeChart.note && <p className="mt-2 text-(--text-primary)/55">{sizeChart.note}</p>}
                    </details>
                  )}

                  <div className="border-y border-(--color-rule) py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-sm font-semibold text-(--text-primary)">
                        {formatInr(itemUnitPrice)} / piece
                      </p>
                    {nextTier && nextTierPricing ? (
                      <p className="text-right text-xs text-(--text-primary)/70">
                        ↗ Add {(nextTier.minQty - itemUnits).toLocaleString("en-IN")} more pieces to unlock {nextTier.discountPercent}% off
                      </p>
                    ) : (
                      <p className="text-xs text-(--text-primary)/70">Highest quantity tier reached.</p>
                    )}
                    </div>
                    {nextTier && nextTierPricing && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--color-rule)" aria-hidden="true">
                        <div
                          className="h-full bg-(--color-accent) transition-[width]"
                          style={{ width: `${priceBreakProgress}%` }}
                        />
                      </div>
                    )}
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
            totalPieces={items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0)}
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
    <section className="techpack-panel rounded-sm border p-5" aria-label="Loading order items">
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="h-56 w-full shrink-0 rounded-sm bg-[#F7F7F7] md:w-44" />
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded bg-[#F7F7F7]" />
            <div className="h-4 w-28 rounded bg-[#F7F7F7]" />
          </div>
          <div className="grid grid-cols-6 gap-px overflow-hidden rounded-sm border border-[#E5E5E5] bg-[#E5E5E5]">
            {SIZES.map((size) => (
              <div key={size} className="h-16 bg-[#F7F7F7]" />
            ))}
          </div>
          <div className="h-12 rounded-sm bg-[#F7F7F7]" />
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
      <thead className="text-(--text-primary)/50">
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
