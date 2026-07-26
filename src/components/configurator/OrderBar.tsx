"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import type { PricingBreakdown, ProductId } from "@/lib/configurator/pricing";
import {
  formatInr,
  getConfiguredPricingSummary,
  getVolumeDiscountPercent,
  GST_PERCENT,
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
  pricingBreakdown: PricingBreakdown;

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

function DiscountStatus({
  quantity,
  unitDiscount,
  discountPercent,
}: {
  quantity: number;
  unitDiscount: number;
  discountPercent: number;
}) {
  const nextTier = getNextDiscountTier(quantity);
  const bestDiscountPercent = getBestDiscountPercent();

  if (unitDiscount > 0) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2E7D32]">
        <TrendingUp size={12} strokeWidth={2.4} className="shrink-0" />
        {discountPercent}% off applied
      </p>
    );
  }

  if (!nextTier || bestDiscountPercent === 0) return null;

  return (
    <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#111111]/60">
      <TrendingUp size={12} strokeWidth={2.4} className="shrink-0" />
      Add {nextTier.neededQty} more unit{nextTier.neededQty === 1 ? "" : "s"} for{" "}
      {nextTier.nextPercent}% off
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
  colour,
  pricingBreakdown,
  ctaErrorMessage,
  ctaErrorNonce,
}: OrderBarProps) {
  const discountedUnitCost =
    pricingBreakdown.unitPrice * (1 - pricingBreakdown.discountPercent / 100);
  const displayUnitCost = unitCost ?? formatInr(discountedUnitCost);
  const unitDiscount = Math.max(
    0,
    pricingBreakdown.unitPrice - discountedUnitCost
  );
  const discountPercent = pricingBreakdown.discountPercent;
  const extraLeadTimeDays =
    colour?.type === "custom_dye" ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max : 0;
  const displayDeliveryDate = deliveryDate ?? computeDeliveryDate(extraLeadTimeDays);

  // Attention flash for a failed CTA click — mirrors the existing
  // "Draft saved" pattern in ConfigureClient (brief true, then auto-reset).
  const [flashError, setFlashError] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
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
      <div className="grid min-h-11 grid-cols-3 gap-3 text-xs" aria-live="polite">
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Unit Cost</div>
          <div className="mt-1 font-semibold text-[#111111]/80">{displayUnitCost}</div>
          <div className="mt-1">
            <DiscountStatus
              quantity={quantity}
              unitDiscount={unitDiscount}
              discountPercent={discountPercent}
            />
          </div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Target Delivery</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayDeliveryDate}</div>
        </div>
        <div className="min-w-0 text-right">
          <div className="font-semibold leading-tight text-[#111111]">
            Est. total{" "}
            <span
              title="Includes GST"
              aria-label="Includes GST"
              className="cursor-help text-[10px] font-normal text-[#111111]/45"
            >
              (?)
            </span>
          </div>
          <div className="mt-1 font-semibold text-[#111111]/80">{formatInr(pricingBreakdown.total)}</div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between rounded-xl bg-[var(--color-teal)]/5 px-3 py-1.5 text-[10px]">
          <span className="font-normal text-[#111111]/55">Due today to reserve review</span>
          <span className="font-semibold text-[var(--color-teal-dark)]/80">{formatInr(RESERVATION_FEE)}</span>
        </div>

        <button
          type="button"
          onClick={() => setBreakdownOpen((value) => !value)}
          aria-expanded={breakdownOpen}
          aria-controls="order-price-breakdown"
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#ECE7DF] px-3 py-2 text-left text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)]"
        >
          <span>See price breakdown</span>
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            className={`shrink-0 transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {breakdownOpen && (
          <div
            id="order-price-breakdown"
            className="flex flex-col gap-1.5 rounded-xl bg-[#F7F7F7] p-3 text-xs"
          >
            {pricingBreakdown.rows.map((row) => (
              <div key={`${row.label}-${row.detail ?? ""}`} className="flex items-center justify-between gap-3">
                <span className="text-[#111111]/60">
                  {row.label}{row.detail ? ` (${row.detail})` : ""}
                </span>
                <span className="font-medium text-[#111111]">
                  {row.amount >= 0 ? "+" : "-"}{formatInr(Math.abs(row.amount))}
                </span>
              </div>
            ))}
            {pricingBreakdown.discountPercent > 0 && (
              <div className="flex items-center justify-between gap-3 text-[#2E7D32]">
                <span>Volume discount ({pricingBreakdown.discountPercent}%)</span>
                <span className="font-medium">-{formatInr(pricingBreakdown.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-[#111111]/60">
              <span>GST ({GST_PERCENT}%)</span>
              <span className="font-medium text-[#111111]">{formatInr(pricingBreakdown.gst)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] pt-1.5 text-sm font-semibold text-[#111111]">
              <span>Estimated order total</span>
              <span>{formatInr(pricingBreakdown.total)}</span>
            </div>
          </div>
        )}

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

        {ctaErrorMessage && (
          <p role="alert" className="text-right text-[11px] font-medium text-[#C62828]">
            {ctaErrorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
