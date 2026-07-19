// src/lib/configurator/pricing.ts

import { products as catalogProducts } from "../products";
import type { Artwork, GarmentColour, NeckLabel } from "./types/configurator";

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
export const PRINT_UNIT_INCREASE_PERCENT = 42;
export const BACK_ARTWORK_UNIT_INCREASE_PERCENT = 22;
export const NECK_LABEL_UNIT_INCREASE_PERCENT = 10;
export const RUSH_DELIVERY_FEE_PER_UNIT = 75;
export const EXPRESS_DELIVERY_FEE_PER_UNIT = RUSH_DELIVERY_FEE_PER_UNIT;
export const GST_PERCENT = 18;

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
  const hasAnyPrint = Boolean(artwork.front?.confirmed || artwork.back?.confirmed);

  if (colour?.type === "custom_dye") {
    adjustments.push({ label: "Custom dye", percent: CUSTOM_DYE_UNIT_INCREASE_PERCENT });
  }

  if (hasAnyPrint) {
    adjustments.push({ label: "Print application", percent: PRINT_UNIT_INCREASE_PERCENT });
  }

  if (artwork.back?.confirmed) {
    adjustments.push({ label: "Back artwork", percent: BACK_ARTWORK_UNIT_INCREASE_PERCENT });
  }

  if (neckLabel?.confirmed) {
    adjustments.push({ label: "Neck label", percent: NECK_LABEL_UNIT_INCREASE_PERCENT });
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
// PHASE 9A (new) — artwork fees + volume discount + neck label fee
// ============================================================

// --- Volume Discount ---
export type VolumeDiscountTier = {
  minQty: number;
  maxQty: number | null; // null = no upper bound
  discountPercent: number;
};

export const VOLUME_DISCOUNT_TIERS: VolumeDiscountTier[] = [
  { minQty: 50, maxQty: 99, discountPercent: 0 },
  { minQty: 100, maxQty: 249, discountPercent: 7 },
  { minQty: 250, maxQty: 499, discountPercent: 12 },
  { minQty: 500, maxQty: 999, discountPercent: 17 },
  { minQty: 1000, maxQty: null, discountPercent: 22 },
];

export function getVolumeDiscountPercent(totalQty: number): number {
  if (totalQty < 50) return 0;
  const tier = VOLUME_DISCOUNT_TIERS.find(
    (t) => totalQty >= t.minQty && (t.maxQty === null || totalQty <= t.maxQty)
  );
  return tier ? tier.discountPercent : 0;
}

export function getVolumeDiscountAmount(unitPrice: number, totalQty: number): number {
  const percent = getVolumeDiscountPercent(totalQty);
  return (unitPrice * percent) / 100;
}

// --- Artwork Fees ---
export const ARTWORK_PREP_FEE = 499; // flat, per artwork/side, one-time regardless of qty
export const ARTWORK_APPLICATION_FEE = 299; // flat, per technique per side

export function getArtworkPrepFee(artworkSideCount: number): number {
  return ARTWORK_PREP_FEE * artworkSideCount;
}

export function getArtworkApplicationFee(techniqueSideCount: number): number {
  return ARTWORK_APPLICATION_FEE * techniqueSideCount;
}

// --- Neck Label Fee ---
export const NECK_LABEL_FEE = 199; // flat, per confirmed label

export function getNeckLabelFee(labelCount: number): number {
  return NECK_LABEL_FEE * labelCount;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
