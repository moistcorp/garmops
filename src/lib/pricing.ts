import {
  DELIVERY_DAYS,
  GST_RATE,
  RUSH_DELIVERY_DAYS,
  RUSH_DELIVERY_TIERS,
  VOLUME_DISCOUNT_TIERS,
  getRushDeliveryUnitFee,
  getVolumeDiscountRate,
} from './pricingRules'

export { DELIVERY_DAYS, GST_RATE, RUSH_DELIVERY_DAYS }

export const VOLUME_TIERS = VOLUME_DISCOUNT_TIERS.map((tier) => ({
  min: tier.minQty,
  max: tier.maxQty ?? Infinity,
  discount: tier.discountPercent / 100,
  label: tier.discountPercent > 0 ? `${tier.discountPercent}% off` : 'Base price',
}))

export const RUSH_TIERS = RUSH_DELIVERY_TIERS.map((tier) => ({
  min: tier.minQty,
  max: tier.maxQty ?? Infinity,
  charge: tier.charge,
}))

export function getDiscount(qty: number): number {
  return getVolumeDiscountRate(qty)
}

export function getRushCharge(qty: number): number {
  return getRushDeliveryUnitFee(qty)
}
