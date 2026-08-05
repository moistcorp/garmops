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
