import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from './pricing'

export const homeFaqs = [
  {
    q: "What's the minimum custom order quantity?",
    a: 'Custom production starts from 50 pieces per product configuration. If your cart contains multiple product configurations, each line item needs to meet that product’s minimum independently.',
  },
  {
    q: 'How long does a custom order take?',
    a: `Standard delivery is ${DELIVERY_DAYS} days from order confirmation. A ${RUSH_DELIVERY_DAYS}-day rush option may be available where the order and production capacity allow it.`,
  },
  {
    q: 'Can I order a sample before placing a bulk order?',
    a: 'Yes. Catalogue samples are available on individual product pages so you can check the base garment, fit and fabric before committing to custom production.',
  },
  {
    q: 'Can I split the quantity across different sizes?',
    a: 'Yes. Once you choose a garment, the order quantity can be allocated across the sizes available for that specific product. Use its size chart before collecting the final split.',
  },
  {
    q: 'Which printing methods do you offer?',
    a: 'Garmops currently offers Screen Print, DTF and Reflective Print. The suitable method depends on the garment, artwork, print dimensions and the effect you want.',
  },
  {
    q: 'Can I order more than one product in the same order?',
    a: 'Yes. You can build an order with multiple product configurations, such as T-shirts, hoodies and tote bags. Each separate line item still needs to meet its own product MOQ.',
  },
] as const
