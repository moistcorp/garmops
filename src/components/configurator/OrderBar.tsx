"use client";

import type { ProductId } from "@/lib/configurator/pricing";
import {
  formatInr,
  getBasePrice,
  getVolumeDiscountAmount,
  getArtworkPrepFee,
  getArtworkApplicationFee,
  getNeckLabelFee,
} from "@/lib/configurator/pricing";
import { getDeliveryOptions } from "@/lib/configurator/delivery";
import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import type { AccordionStepState } from "@/components/configurator/ConfiguratorSidebar/ConfiguratorSidebar";

export interface OrderBarProps {
  // Deprecated overrides — when provided, displayed as-is instead of computed.
  // Kept only so ConfigureClient.tsx (not edited this phase) keeps compiling
  // with its existing static `unitCost="₹499" deliveryDate="Jul 20"` call.
  unitCost?: string;
  deliveryDate?: string;

  quantity: number;
  onQuantityChange: (quantity: number) => void;
  ctaLabel: string;
  onCtaClick?: () => void;

  // NEW — live pricing/delivery inputs
  productId?: ProductId;
  // Accepted for interface parity per phase spec; not read internally this
  // phase (garment-colour is implicitly always confirmed by the time OrderBar
  // renders, per clarification #4, so base price never needs gating on it).
  steps?: AccordionStepState[];
  artwork?: Artwork;
  neckLabel?: NeckLabel;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function computeConfiguredUnitCost(
  productId: ProductId,
  quantity: number,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined
): number {
  const basePrice = getBasePrice(productId);
  const volumeDiscountAmount = getVolumeDiscountAmount(basePrice, quantity);
  const perUnitPrice = basePrice - volumeDiscountAmount;

  const confirmedSides = [artwork.front, artwork.back].filter(
    (side) => side?.confirmed
  ).length;
  const prepFee = getArtworkPrepFee(confirmedSides);
  const applicationFee = getArtworkApplicationFee(confirmedSides);
  const neckLabelFee = getNeckLabelFee(neckLabel?.confirmed ? 1 : 0);

  // Prep/application/neck-label fees are flat, one-time order-level charges
  // (Appendix §8), not per-unit. UNCONFIRMED: there's no line-item breakdown
  // slot in OrderBar's UI — only a single "Unit Cost" string. Assumption for
  // this phase: spread the one-time total across quantity so Unit Cost
  // reflects true per-garment cost. Flag if these should instead render as
  // separate line items (would need an OrderBar layout change, out of scope
  // here since only computation was requested).
  const oneTimeFees = prepFee + applicationFee + neckLabelFee;
  const totalCost = perUnitPrice * quantity + oneTimeFees;
  return totalCost / quantity;
}

function computeDeliveryDate(): string {
  const orderConfirmedDate = new Date();
  const { standard } = getDeliveryOptions(orderConfirmedDate);
  return formatDate(standard);
}

export function OrderBar({
  unitCost,
  deliveryDate,
  quantity,
  onQuantityChange,
  ctaLabel,
  onCtaClick,
  productId = "tshirt-classic",
  artwork = {},
  neckLabel,
}: OrderBarProps) {
  const displayUnitCost =
    unitCost ?? formatInr(computeConfiguredUnitCost(productId, quantity, artwork, neckLabel));
  const displayDeliveryDate = deliveryDate ?? computeDeliveryDate();

  return (
    <div className="grid gap-2 rounded-[18px] bg-white p-3 shadow-[0_1px_0_rgba(17,17,17,0.03)]">
      <div className="grid min-h-11 grid-cols-2 gap-4 rounded-[14px] bg-white text-xs">
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Unit Cost</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayUnitCost}</div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Delivery Date</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayDeliveryDate}</div>
        </div>
      </div>

      <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[14px] bg-white">
        <label htmlFor="configurator-quantity" className="whitespace-nowrap text-xs font-semibold text-[#111111]">
          Quantity
        </label>
        <div className="flex h-10 min-w-0 items-center justify-between rounded-lg bg-[#F3F3F2] px-3">
          <input
            id="configurator-quantity"
            type="number"
            value={quantity}
            onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
            className="h-full w-10 bg-transparent text-center text-sm font-medium text-[#111111] outline-none"
          />
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#111111]/80 hover:bg-white"
          >
            −
          </button>
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
          className="min-h-10 w-32 rounded-full bg-[#111111] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {ctaLabel} -&gt;
        </button>
      </div>
    </div>
  );
}
