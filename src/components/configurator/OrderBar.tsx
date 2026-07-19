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
  unitCost?: string;
  deliveryDate?: string;

  quantity: number;
  onQuantityChange: (quantity: number) => void;
  rushDelivery: boolean;
  onRushDeliveryChange: (rushDelivery: boolean) => void;
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
  neckLabel: NeckLabel | undefined,
  rushDelivery = false
): number {
  return getConfiguredUnitPrice(productId, colour, artwork, neckLabel, rushDelivery);
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
  rushDelivery,
  onRushDeliveryChange,
  ctaLabel,
  onCtaClick,
  productId = "tshirt-classic",
  colour,
  artwork = {},
  neckLabel,
}: OrderBarProps) {
  const displayUnitCost =
    unitCost ??
    formatInr(computeConfiguredUnitCost(productId, colour, artwork, neckLabel, rushDelivery));
  const displayDeliveryDate = deliveryDate ?? computeDeliveryDate();

  return (
    <div className="grid gap-3 rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-sm">
      <div className="grid min-h-11 grid-cols-2 gap-4 text-xs">
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Unit Cost</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayUnitCost}</div>
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-[#111111]">Delivery Date</div>
          <div className="mt-1 font-semibold text-[#111111]/70">{displayDeliveryDate}</div>
        </div>
      </div>

      <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <label htmlFor="configurator-quantity" className="whitespace-nowrap text-xs font-semibold text-[#111111]">
          Quantity
        </label>
        <div className="flex h-10 min-w-0 items-center justify-between rounded-md bg-[#F3F3F2] px-3">
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
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-[#111111]/80 hover:bg-white"
          >
            −
          </button>
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
          className="min-h-10 w-32 rounded-md bg-[#111111] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {ctaLabel} -&gt;
        </button>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md bg-[#F7F7F7] px-3 text-sm text-[#111111]">
        <span>
          <span className="block font-semibold">Rush Delivery</span>
          <span className="block text-xs text-[#111111]/55">Adds ₹75 per piece</span>
        </span>
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${
            rushDelivery ? "bg-[#111111]" : "bg-[#D8D8D8]"
          }`}
        >
          <input
            type="checkbox"
            checked={rushDelivery}
            onChange={(e) => onRushDeliveryChange(e.target.checked)}
            className="sr-only"
          />
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
              rushDelivery ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
      </label>
    </div>
  );
}
