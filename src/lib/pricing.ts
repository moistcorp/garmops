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

export const GST_RATE = 0.05

export const VOLUME_TIERS = [
  { min: 50, max: 99, discount: 0, label: 'Base price' },
  { min: 100, max: 249, discount: 0.07, label: '7% off' },
  { min: 250, max: 499, discount: 0.12, label: '12% off' },
  { min: 500, max: 999, discount: 0.17, label: '17% off' },
  { min: 1000, max: Infinity, discount: 0.22, label: '22% off' },
]

export const RUSH_TIERS = [
  { min: 50, max: 99, charge: 70 },
  { min: 100, max: 249, charge: 50 },
  { min: 250, max: 499, charge: 30 },
  { min: 500, max: 999, charge: 20 },
  { min: 1000, max: Infinity, charge: 20 },
]

export const DELIVERY_DAYS = 35
export const RUSH_DELIVERY_DAYS = 18

export function getDiscount(qty: number): number {
  for (const tier of VOLUME_TIERS) {
    if (qty >= tier.min && qty <= tier.max) return tier.discount
  }
  return 0.22
}

export function getRushCharge(qty: number): number {
  for (const tier of RUSH_TIERS) {
    if (qty >= tier.min && qty <= tier.max) return tier.charge
  }
  return 20
}

export function getPricePerPiece(productName: string, qty: number, rush = false): number {
  const base = PRODUCT_PRICES[productName] ?? 535
  const discount = getDiscount(qty)
  const discounted = Math.round(base * (1 - discount))
  const rushCharge = rush ? getRushCharge(qty) : 0
  return discounted + rushCharge
}

export function calcOrder(productName: string, qty: number, rush = false) {
  const basePrice = PRODUCT_PRICES[productName] ?? 535
  const discount = getDiscount(qty)
  const discountedBase = Math.round(basePrice * (1 - discount))
  const rushCharge = rush ? getRushCharge(qty) : 0
  const pricePerPiece = discountedBase + rushCharge
  const subtotal = pricePerPiece * qty
  const gst = Math.round(subtotal * GST_RATE)
  const total = subtotal + gst
  return { basePrice, discount, discountedBase, rushCharge, pricePerPiece, subtotal, gst, total }
}

export function getDeliveryDate(rush = false): string {
  const days = rush ? RUSH_DELIVERY_DAYS : DELIVERY_DAYS
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}
