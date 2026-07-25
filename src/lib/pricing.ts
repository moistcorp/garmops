import {
  DELIVERY_DAYS,
  GST_RATE,
  RUSH_DELIVERY_DAYS,
  RUSH_DELIVERY_TIERS,
  VOLUME_DISCOUNT_TIERS,
  applyVolumeDiscount,
  getRushDeliveryUnitFee,
  getVolumeDiscountRate,
} from './pricingRules'

export const PRODUCT_PRICES: Record<string, number> = {
  'Regular Fit Tee (200 GSM)': 535,
  'Boxy Fit Tee (200 GSM)': 535,
  'Regular Fit Tee (260 GSM)': 565,
  'Boxy Fit Tee (260 GSM)': 565,
  'Longsleeve Tee (260 GSM)': 565,
  'Polo (280 GSM)': 595,
  'Regular Fit Sweatshirt (320 GSM)': 565,
  'Boxy Fit Sweatshirt (320 GSM)': 585,
  'Regular Fit Hoodie (320 GSM)': 575,
  'Boxy Fit Hoodie (320 GSM)': 615,
  'Shorts (220 GSM)': 505,
  'Canvas Tote Bag': 350,
}

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

export function getPricePerPiece(productName: string, qty: number, rush = false): number {
  const base = PRODUCT_PRICES[productName] ?? 535
  const rushCharge = rush ? getRushCharge(qty) : 0
  return Math.round(applyVolumeDiscount(base + rushCharge, qty))
}

export function calcOrder(productName: string, qty: number, rush = false) {
  const basePrice = PRODUCT_PRICES[productName] ?? 535
  const discount = getDiscount(qty)
  const rushCharge = rush ? getRushCharge(qty) : 0
  const loadedUnitPrice = basePrice + rushCharge
  const discountAmountPerPiece = loadedUnitPrice * discount
  const pricePerPiece = Math.round(applyVolumeDiscount(loadedUnitPrice, qty))
  const discountedBase = pricePerPiece
  const subtotal = pricePerPiece * qty
  const gst = Math.round(subtotal * GST_RATE)
  const total = subtotal + gst
  return {
    basePrice,
    discount,
    discountedBase,
    rushCharge,
    loadedUnitPrice,
    discountAmountPerPiece,
    pricePerPiece,
    subtotal,
    gst,
    total,
  }
}

export function getDeliveryDate(rush = false): string {
  const days = rush ? RUSH_DELIVERY_DAYS : DELIVERY_DAYS
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}
