import { GST_PERCENT, GST_RATE_BASIS_POINTS } from "@/lib/tax";

export { GST_PERCENT, GST_RATE_BASIS_POINTS };

export type VolumeDiscountTier = {
  minQty: number;
  maxQty: number | null;
  discountPercent: number;
};

export type RushDeliveryTier = {
  minQty: number;
  maxQty: number | null;
  charge: number;
};

export const GST_RATE = GST_PERCENT / 100;

export const DELIVERY_DAYS = 35;
export const RUSH_DELIVERY_DAYS = 18;

export const RUSH_DELIVERY_FEE_PER_UNIT = 75;
export const EXPRESS_DELIVERY_FEE_PER_UNIT = RUSH_DELIVERY_FEE_PER_UNIT;

/**
 * Canonical pre-GST starting prices for a blank catalogue garment.
 *
 * Product-facing copy may use a simplified name, but calculations always use
 * this immutable product slug. Configuration additions and all line totals
 * are calculated from these values in `configurator/pricing.ts`.
 */
export const CATALOGUE_BASE_PRICE_RUPEES = {
  "regular-fit-tee-200gsm": 535,
  "boxy-fit-tee-200gsm": 535,
  "regular-fit-tee-260gsm": 565,
  "boxy-fit-tee-260gsm": 565,
  "longsleeve-tee-260gsm": 565,
  "polo-280gsm": 595,
  "regular-fit-sweatshirt-320gsm": 565,
  "regular-fit-hoodie-320gsm": 575,
  "boxy-fit-hoodie-320gsm": 615,
  "canvas-tote-bag": 350,
} as const;

export type CatalogueProductId = keyof typeof CATALOGUE_BASE_PRICE_RUPEES;

export function getCatalogueBasePriceRupees(productId: string): number {
  const price = CATALOGUE_BASE_PRICE_RUPEES[productId as CatalogueProductId];
  if (price === undefined) throw new Error(`No base price found for product ID "${productId}"`);
  return price;
}

/** Customer-selectable decoration methods. */
export const CUSTOMER_PRINT_TECHNIQUES = [
  "screen_print",
  "dtf",
  "reflective_print",
] as const;

export type CustomerPrintTechnique = (typeof CUSTOMER_PRINT_TECHNIQUES)[number];

export const CUSTOMER_PRINT_TECHNIQUE_LABELS: Record<CustomerPrintTechnique, string> = {
  screen_print: "Screen Print",
  dtf: "DTF",
  reflective_print: "Reflective Print",
};

export const CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS: Record<CustomerPrintTechnique, number> = {
  screen_print: 38,
  dtf: 32,
  reflective_print: 46,
};

export const CUSTOM_DYE_UNIT_INCREASE_PERCENT = 15.33;
export const BACK_ARTWORK_UNIT_INCREASE_PERCENT = 22;
export const NECK_LABEL_UNIT_PRICE = 25;

export const VOLUME_DISCOUNT_TIERS: VolumeDiscountTier[] = [
  { minQty: 50, maxQty: 99, discountPercent: 0 },
  { minQty: 100, maxQty: 249, discountPercent: 7 },
  { minQty: 250, maxQty: 499, discountPercent: 12 },
  { minQty: 500, maxQty: 999, discountPercent: 17 },
  { minQty: 1000, maxQty: null, discountPercent: 22 },
];

export const RUSH_DELIVERY_TIERS: RushDeliveryTier[] = [
  { minQty: 50, maxQty: null, charge: RUSH_DELIVERY_FEE_PER_UNIT },
];

export function getVolumeDiscountPercent(totalQty: number): number {
  if (totalQty < 50) return 0;
  const tier = VOLUME_DISCOUNT_TIERS.find(
    (t) => totalQty >= t.minQty && (t.maxQty === null || totalQty <= t.maxQty)
  );
  return tier ? tier.discountPercent : 0;
}

export function getVolumeDiscountRate(totalQty: number): number {
  return getVolumeDiscountPercent(totalQty) / 100;
}

export function getVolumeDiscountAmount(unitPrice: number, totalQty: number): number {
  return unitPrice * getVolumeDiscountRate(totalQty);
}

export function getRushDeliveryUnitFee(totalQty: number): number {
  const tier = RUSH_DELIVERY_TIERS.find(
    (t) => totalQty >= t.minQty && (t.maxQty === null || totalQty <= t.maxQty)
  );
  return tier?.charge ?? RUSH_DELIVERY_FEE_PER_UNIT;
}

export function applyVolumeDiscount(unitPrice: number, totalQty: number): number {
  return unitPrice - getVolumeDiscountAmount(unitPrice, totalQty);
}
