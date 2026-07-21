"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import type { ProductId } from "@/lib/configurator/pricing";
import {
  formatInr,
  getBasePrice,
  getConfiguredUnitPrice,
  getUnitPriceAdjustments,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
  VOLUME_DISCOUNT_TIERS,
  GST_PERCENT,
} from "@/lib/configurator/pricing";
import { getDeliveryOptions } from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colours";
import type { Artwork, GarmentColour, NeckLabel } from "@/lib/configurator/types/configurator";
import type { AccordionStepState } from "@/components/configurator/ConfiguratorSidebar/ConfiguratorSidebar";

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
  const undiscounted = getConfiguredUnitPrice(productId, colour, artwork, neckLabel, rushDelivery);
  const discount = getVolumeDiscountAmount(undiscounted, quantity);
  return undiscounted - discount;
}

function computeDeliveryDate(extraLeadTimeDays = 0): string {
  const orderConfirmedDate = new Date();
  const { standard } = getDeliveryOptions(orderConfirmedDate, extraLeadTimeDays);
  return formatDate(standard);
}

// ---------------------------------------------------------------------------
// Pricing breakdown — reconstructs the same sequential adjustment math as
// pricing.ts's applyUnitPriceAdjustments, but keeps each step's rupee impact
// around so it can be listed line-by-line instead of only the final number.
// ---------------------------------------------------------------------------

interface BreakdownRow {
  label: string;
  detail?: string;
  amount: number;
}

function buildPricingBreakdown(
  productId: ProductId,
  colour: GarmentColour | undefined,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined,
  quantity: number,
  rushDelivery = false
) {
  const basePrice = getBasePrice(productId);
  const adjustments = getUnitPriceAdjustments(colour, artwork, neckLabel, rushDelivery);

  const rows: BreakdownRow[] = [{ label: "Base garment", amount: basePrice }];
  let running = basePrice;
  for (const adjustment of adjustments) {
    const before = running;
    running =
      adjustment.percent !== undefined
        ? running * (1 + adjustment.percent / 100)
        : running + (adjustment.amount ?? 0);
    rows.push({
      label: adjustment.label,
      detail: adjustment.percent !== undefined ? `+${adjustment.percent}%` : undefined,
      amount: running - before,
    });
  }

  const unitPrice = running;
  const lineSubtotal = unitPrice * quantity;
  const discountPercent = getVolumeDiscountPercent(quantity);
  const discountAmount = (lineSubtotal * discountPercent) / 100;
  const taxable = lineSubtotal - discountAmount;
  const gst = (taxable * GST_PERCENT) / 100;
  const total = taxable + gst;

  return { rows, unitPrice, lineSubtotal, discountPercent, discountAmount, taxable, gst, total };
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

function PricingBreakdown({
  productId,
  colour,
  artwork,
  neckLabel,
  quantity,
}: {
  productId: ProductId;
  colour?: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  quantity: number;
}) {
  const [open, setOpen] = useState(false);
  const breakdown = buildPricingBreakdown(productId, colour, artwork, neckLabel, quantity);

  return (
    <div className="border-t border-[#E5E5E5] pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-1 text-left text-xs font-semibold text-[#111111]/70 hover:text-[#111111]"
      >
        See pricing breakdown
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-[#F7F7F7] p-3 text-xs">
          <div className="flex flex-col gap-1.5">
            {breakdown.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-[#111111]/60">
                  {row.label}
                  {row.detail && <span className="ml-1 text-[#111111]/40">({row.detail})</span>}
                </span>
                <span className="font-medium text-[#111111]">
                  {row.amount >= 0 ? "+" : "−"}
                  {formatInr(Math.abs(row.amount))}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] pt-1.5 font-semibold text-[#111111]">
            <span>Unit price</span>
            <span>{formatInr(breakdown.unitPrice)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 text-[#111111]/60">
            <span>
              {formatInr(breakdown.unitPrice)} × {quantity} units
            </span>
            <span className="font-medium text-[#111111]">{formatInr(breakdown.lineSubtotal)}</span>
          </div>

          {breakdown.discountPercent > 0 && (
            <div className="flex items-center justify-between gap-3 text-[#2E7D32]">
              <span>Volume discount ({breakdown.discountPercent}%)</span>
              <span className="font-medium">−{formatInr(breakdown.discountAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-[#111111]/60">
            <span>GST ({GST_PERCENT}%)</span>
            <span className="font-medium text-[#111111]">{formatInr(breakdown.gst)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E5E5E5] pt-1.5 text-sm font-semibold text-[#111111]">
            <span>Order total</span>
            <span>{formatInr(breakdown.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VolumeDiscountNudge({ quantity }: { quantity: number }) {
  const nextTier = getNextDiscountTier(quantity);

  if (!nextTier) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2E7D32]">
        <TrendingUp size={12} strokeWidth={2.4} />
        You&rsquo;re at our best volume price — 22% off.
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

  return (
    <div className="grid gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-sm">
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
          <div className="font-semibold leading-tight text-[#111111]">Delivery Date</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayDeliveryDate}</div>
        </div>
      </div>

      <PricingBreakdown
        productId={productId}
        colour={colour}
        artwork={artwork}
        neckLabel={neckLabel}
        quantity={quantity}
      />

      <div className="grid gap-1.5">
        <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <label htmlFor="configurator-quantity" className="whitespace-nowrap text-xs font-semibold text-[#111111]">
            Quantity
          </label>
          <div className="flex h-10 min-w-0 items-center justify-between rounded-md bg-[#F7F7F7] px-3">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= minQuantity}
              onClick={() => onQuantityChange(Math.max(minQuantity, quantity - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-[#111111]/80 hover:bg-white disabled:cursor-not-allowed disabled:text-[#111111]/25"
            >
              −
            </button>
            <input
              id="configurator-quantity"
              type="number"
              min={minQuantity}
              value={quantity}
              onChange={(e) =>
                onQuantityChange(Math.max(minQuantity, Number(e.target.value) || minQuantity))
              }
              className="h-full w-12 bg-transparent text-center text-sm font-medium text-[#111111] outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQuantityChange(quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-[#111111]/80 hover:bg-white"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={onCtaClick}
            className={`min-h-10 w-32 rounded-md px-4 text-sm font-semibold text-white transition-all hover:opacity-90 ${
              flashError
                ? "bg-[#C62828] ring-2 ring-[#C62828]/40 ring-offset-2"
                : "bg-[#111111]"
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
