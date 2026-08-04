import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from './pricing'

export const homeFaqs = [
  {
    q: "What's the minimum order quantity?",
    a: 'Just 50 pieces per style, with volume discounts kicking in as quantity increases.',
  },
  {
    q: 'How long does delivery take?',
    a: `Standard delivery takes ${DELIVERY_DAYS} days from order confirmation. Need it sooner? Rush delivery is available in ${RUSH_DELIVERY_DAYS} days.`,
  },
  {
    q: 'Do you provide GST-compliant invoices?',
    a: 'Yes. Every verified full-payment order receives a GST-compliant tax invoice with the applicable HSN code. Shipping is quoted and collected separately after staff review.',
  },
] as const
