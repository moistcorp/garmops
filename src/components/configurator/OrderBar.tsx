"use client";

import type { ProductId } from "@/lib/configurator/pricing";
import {
  formatInr,
  getConfiguredUnitPrice,
} from "@/lib/configurator/pricing";
import { getDeliveryOptions } from "@/lib/configurator/delivery";
import type { Artwork, GarmentColour, NeckLabel } from "@/lib/configurator/types/configurator";
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
  steps?: AccordionStepState[];
  colour?: GarmentColour;
  artwork?: Artwork;
  neckLabel?: NeckLabel;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function computeConfiguredUnitCost(
  productId: ProductId,
  colour: GarmentColour | undefined,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined
): number {
  return getConfiguredUnitPrice(productId, colour, artwork, neckLabel);
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
  colour,
  artwork = {},
  neckLabel,
}: OrderBarProps) {
  const displayUnitCost =
    unitCost ?? formatInr(computeConfiguredUnitCost(productId, colour, artwork, neckLabel));
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
