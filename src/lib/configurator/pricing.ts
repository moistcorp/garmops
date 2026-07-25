// src/lib/configurator/pricing.ts

import { products as catalogProducts } from "../products";
import {
  EXPRESS_DELIVERY_FEE_PER_UNIT,
  GST_PERCENT,
  RUSH_DELIVERY_FEE_PER_UNIT,
  VOLUME_DISCOUNT_TIERS,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
  type VolumeDiscountTier,
} from "../pricingRules";
import type { Artwork, ArtworkTechnique, GarmentColour, NeckLabel } from "./types/configurator";

// ============================================================
// PHASE 1 (confirmed) — base price lookup
// ============================================================

export type ProductId = string;

const BASE_PRICES: Record<ProductId, number> = Object.fromEntries(
  catalogProducts.map((product) => [product.slug, product.price])
);

export function getBasePrice(productId: ProductId): number {
  const price = BASE_PRICES[productId];
  if (price === undefined) {
    throw new Error(`No base price found for product ID "${productId}"`);
  }
  return price;
}

export const CUSTOM_DYE_UNIT_INCREASE_PERCENT = 15.33;
export const BACK_ARTWORK_UNIT_INCREASE_PERCENT = 22;
export const NECK_LABEL_UNIT_PRICE = 25;
export {
  EXPRESS_DELIVERY_FEE_PER_UNIT,
  GST_PERCENT,
  RUSH_DELIVERY_FEE_PER_UNIT,
  VOLUME_DISCOUNT_TIERS,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
  type VolumeDiscountTier,
};

export const TECHNIQUE_UNIT_PRICE_DELTAS: Record<ArtworkTechnique, number> = {
  screen_print: 38,
  dtg: 28,
  dtf: 32,
  reflective_heat_transfer: 46,
  puff_print: 52,
  embroidery: 65,
};

export type UnitPriceAdjustment = {
  label: string;
  percent?: number;
  amount?: number;
};

export function getUnitPriceAdjustments(
  colour?: Pick<GarmentColour, "type">,
  artwork: Artwork = {},
  neckLabel?: Partial<NeckLabel>,
  rushDelivery = false
): UnitPriceAdjustment[] {
  const adjustments: UnitPriceAdjustment[] = [];
  if (colour?.type === "custom_dye") {
    adjustments.push({ label: "Custom dye", percent: CUSTOM_DYE_UNIT_INCREASE_PERCENT });
  }

  (["front", "back"] as const).forEach((side) => {
    const artworkSide = artwork[side];
    if (!artworkSide?.confirmed || !artworkSide.technique) return;
    adjustments.push({
      label: `${side === "front" ? "Front" : "Back"} ${artworkSide.technique.replaceAll("_", " ")}`,
      amount: TECHNIQUE_UNIT_PRICE_DELTAS[artworkSide.technique],
    });
  });

  if (artwork.back?.confirmed) {
    adjustments.push({ label: "Back artwork", percent: BACK_ARTWORK_UNIT_INCREASE_PERCENT });
  }

  if (neckLabel?.confirmed) {
    adjustments.push({ label: "Neck label", amount: NECK_LABEL_UNIT_PRICE });
  }

  if (rushDelivery) {
    adjustments.push({ label: "Rush delivery", amount: RUSH_DELIVERY_FEE_PER_UNIT });
  }

  return adjustments;
}

export function applyUnitPriceAdjustments(
  basePrice: number,
  adjustments: UnitPriceAdjustment[]
): number {
  return adjustments.reduce((price, adjustment) => {
    if (adjustment.percent !== undefined) {
      return price * (1 + adjustment.percent / 100);
    }
    return price + (adjustment.amount ?? 0);
  }, basePrice);
}

export function getConfiguredUnitPrice(
  productId: ProductId,
  colour?: Pick<GarmentColour, "type">,
  artwork: Artwork = {},
  neckLabel?: Partial<NeckLabel>,
  rushDelivery = false
): number {
  return applyUnitPriceAdjustments(
    getBasePrice(productId),
    getUnitPriceAdjustments(colour, artwork, neckLabel, rushDelivery)
  );
}

// ============================================================
// PHASE 9A — volume discount
// ============================================================

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}