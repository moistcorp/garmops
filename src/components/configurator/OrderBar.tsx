"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { ProductId } from "@/lib/configurator/pricing";
import {
  formatInr,
  getConfiguredPricingSummary,
  getVolumeDiscountPercent,
  VOLUME_DISCOUNT_TIERS,
} from "@/lib/configurator/pricing";
import { getDeliveryOptions } from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colours";
import type { Artwork, GarmentColour, NeckLabel } from "@/lib/configurator/types/configurator";
import type { AccordionStepState } from "@/components/configurator/ConfiguratorSidebar/ConfiguratorSidebar";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";

export interface OrderBarProps {
  unitCost?: string;
  deliveryDate?: string;

  quantity: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  ctaLabel: string;
  onCtaClick?: () => void;

  // NEW — live pricing/delivery inputs
  productId?: ProductId;
  steps?: AccordionStepState[];
  colour?: GarmentColour;
  artwork?: Artwork;
  neckLabel?: NeckLabel;

  /** Validation message for the currently expanded step's last failed CTA
   *  click, if any (mirrors the message shown inline on the accordion). */
  ctaErrorMessage?: string | null;
  /** Bumped by the parent on every failed CTA click, even if the message
   *  text is unchanged, so the attention flash can re-trigger. */
  ctaErrorNonce?: number;
}

const MINIMUM_ORDER_QUANTITY = 50;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function computeConfiguredUnitCost(
  productId: ProductId,
  colour: GarmentColour | undefined,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined,
  quantity = 1,
  rushDelivery = false
): number {
  return getConfiguredPricingSummary(
    productId,
    colour,
    artwork,
    neckLabel,
    quantity,
    rushDelivery
  ).discountedUnitPrice;
}

function computeDeliveryDate(extraLeadTimeDays = 0): string {
  const orderConfirmedDate = new Date();
  const { standard } = getDeliveryOptions(orderConfirmedDate, extraLeadTimeDays);
  return formatDate(standard);
}

// Finds the next tier that would actually beat the customer's current
// discount (skips e.g. the 50–99 "base price" tier once already inside it),
// so the nudge always points at a meaningfully better price.
function getNextDiscountTier(quantity: number) {
  const currentPercent = getVolumeDiscountPercent(quantity);
  const next = VOLUME_DISCOUNT_TIERS.find((tier) => tier.discountPercent > currentPercent);
  if (!next) return null;
  return { neededQty: Math.max(0, next.minQty - quantity), nextPercent: next.discountPercent };
}

function getBestDiscountPercent() {
  return VOLUME_DISCOUNT_TIERS.reduce(
    (best, tier) => Math.max(best, tier.discountPercent),
    0
  );
}

function VolumeDiscountNudge({ quantity }: { quantity: number }) {
  const nextTier = getNextDiscountTier(quantity);

  if (!nextTier) {
    const bestDiscountPercent = getBestDiscountPercent();

    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2E7D32]">
        <TrendingUp size={12} strokeWidth={2.4} />
        You&rsquo;re at our best volume price — {bestDiscountPercent}% off.
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#111111]/60">
      <TrendingUp size={12} strokeWidth={2.4} className="shrink-0" />
      Add {nextTier.neededQty} more unit{nextTier.neededQty === 1 ? "" : "s"} to unlock{" "}
      {nextTier.nextPercent}% off.
    </p>
  );
}

export function OrderBar({
  unitCost,
  deliveryDate,
  quantity,
  onQuantityChange,
  minQuantity = MINIMUM_ORDER_QUANTITY,
  ctaLabel,
  onCtaClick,
  productId = "tshirt-classic",
  colour,
  artwork = {},
  neckLabel,
  ctaErrorMessage,
  ctaErrorNonce,
}: OrderBarProps) {
  const displayUnitCost =
    unitCost ??
    formatInr(computeConfiguredUnitCost(productId, colour, artwork, neckLabel, quantity));
  const extraLeadTimeDays =
    colour?.type === "custom_dye" ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max : 0;
  const displayDeliveryDate = deliveryDate ?? computeDeliveryDate(extraLeadTimeDays);
  const undiscountedUnitCost = computeConfiguredUnitCost(
    productId,
    colour,
    artwork,
    neckLabel,
    1
  );
  const discountedUnitCost = computeConfiguredUnitCost(
    productId,
    colour,
    artwork,
    neckLabel,
    quantity
  );
  const unitDiscount = Math.max(0, undiscountedUnitCost - discountedUnitCost);
  const discountPercent = getVolumeDiscountPercent(quantity);

  // Attention flash for a failed CTA click — mirrors the existing
  // "Draft saved" pattern in ConfigureClient (brief true, then auto-reset).
  const [flashError, setFlashError] = useState(false);
  useEffect(() => {
    if (!ctaErrorNonce) return;
    const showTimer = setTimeout(() => setFlashError(true), 0);
    const hideTimer = setTimeout(() => setFlashError(false), 1600);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [ctaErrorNonce]);

  // Free-typing draft for the quantity field — kept as text so the customer
  // can clear it and type a new number without every keystroke snapping
  // back to minQuantity. Re-synced from the committed `quantity` whenever it
  // changes from elsewhere (the +/- buttons, or a parent-level reset) using
  // React's render-time "adjust state when a prop changes" pattern; the
  // draft is only clamped back to minQuantity on blur/Enter, not per-keystroke.
  const [quantityDraft, setQuantityDraft] = useState(String(quantity));
  const [lastSyncedQuantity, setLastSyncedQuantity] = useState(quantity);
  if (quantity !== lastSyncedQuantity) {
    setLastSyncedQuantity(quantity);
    setQuantityDraft(String(quantity));
  }

  function commitQuantityDraft(raw: string) {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    const next =
      trimmed !== "" && Number.isFinite(parsed) ? Math.floor(parsed) : minQuantity;
    onQuantityChange(Math.max(minQuantity, next));
  }

  return (
    <div className="grid gap-3 rounded-[28px] border border-[#ECE7DF] bg-white p-3 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
      <div className="grid min-h-11 grid-cols-2 gap-4 text-xs">
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Unit Cost</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[#111111]/80">{displayUnitCost}</span>
            {unitDiscount > 0 && (
              <span className="rounded-full bg-[#EAF7EA] px-2 py-0.5 text-[10px] font-semibold text-[#1B7F36]">
                {discountPercent}% off
              </span>
            )}
          </div>
          {unitDiscount > 0 && (
            <p className="mt-1 text-[11px] font-medium text-[#1B7F36]">
              Saves {formatInr(unitDiscount)}/unit at {quantity} units
            </p>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Target Delivery</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayDeliveryDate}</div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-teal)]/5 px-3 py-2 text-xs">
          <span className="font-medium text-[#111111]/65">Due today to reserve review</span>
          <span className="font-bold text-[var(--color-teal-dark)]">{formatInr(RESERVATION_FEE)}</span>
        </div>
        <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <label htmlFor="configurator-quantity" className="whitespace-nowrap text-xs font-semibold text-[#111111]">
            Quantity
          </label>
          <div className="flex h-10 min-w-0 items-center justify-between rounded-full bg-[var(--color-cream-soft)] px-3">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= minQuantity}
              onClick={() => onQuantityChange(Math.max(minQuantity, quantity - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#111111]/80 hover:bg-white disabled:cursor-not-allowed disabled:text-[#111111]/25"
            >
              −
            </button>
            <input
              id="configurator-quantity"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantityDraft}
              onChange={(e) => {
                const raw = e.target.value;
                if (/^[0-9]*$/.test(raw)) setQuantityDraft(raw);
              }}
              onBlur={() => commitQuantityDraft(quantityDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitQuantityDraft(quantityDraft);
                  e.currentTarget.blur();
                }
              }}
              className="h-full w-12 bg-transparent text-center text-sm font-medium text-[#111111] outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQuantityChange(quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#111111]/80 hover:bg-white"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={onCtaClick}
            className={`min-h-10 w-32 rounded-full px-4 text-sm font-semibold text-white transition-all hover:opacity-90 ${
              flashError
                ? "bg-[#C62828] ring-2 ring-[#C62828]/40 ring-offset-2"
                : "bg-[var(--color-teal)] hover:bg-[var(--color-teal-dark)]"
            }`}
          >
            {ctaLabel}
          </button>
        </div>

        <VolumeDiscountNudge quantity={quantity} />
        {minQuantity > MINIMUM_ORDER_QUANTITY && (
          <p className="text-[11px] font-medium text-[#8A6212]">
            Custom dye minimum: {minQuantity} units per colour.
          </p>
        )}

        {ctaErrorMessage && (
          <p role="alert" className="text-right text-[11px] font-medium text-[#C62828]">
            {ctaErrorMessage}
          </p>
        )}
      </div>
    </div>
  );
}