// src/lib/configurator/pricing.ts

// ============================================================
// PHASE 1 (confirmed) — base price lookup
// ============================================================

export type ProductId = string;

// TODO: placeholder catalogue — replace with real Moist Corp product IDs/base prices.
const BASE_PRICES: Record<ProductId, number> = {
  'tshirt-classic': 499,
  'hoodie-classic': 1299,
  'polo-classic': 799,
  'sweatshirt-classic': 999,
};

/**
 * Base Unit Cost lookup — Signature vs Custom Dye upcharge handling deferred
 * to a future phase (see Appendix §8, flagged "confirm"; 21% upcharge confirmed
 * by Rahul but NOT implemented here — requires a signature change to this
 * function, out of scope for Phase 9A).
 */
export function getBasePrice(productId: ProductId): number {
  const price = BASE_PRICES[productId];
  if (price === undefined) {
    throw new Error(`No base price found for product ID "${productId}"`);
  }
  return price;
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
