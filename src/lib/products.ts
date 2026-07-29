import { PRODUCT_PRICES } from './pricing'

export type Product = {
  id: number
  slug: string
  name: string
  pricingKey: string
  icon: string
  category: string
  description: string
  gsm: number
  fits?: string[]
  details: string[]
  careInstructions: string[]
  sizes: string[]
  price: number
  image: string | null
}

export const products: Product[] = [
  {
    id: 1,
    slug: 'regular-fit-tee-200gsm',
    name: 'Regular Fit T-Shirt',
    pricingKey: 'Regular Fit Tee (200 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: '200 GSM classic regular fit tee. Clean silhouette, ideal for everyday branding and bulk orders.',
    gsm: 200,
    fits: ['Regular'],
    details: ['200 GSM 100% Cotton French Terry', 'Regular fit', 'Crew neck', 'Preshrunk fabric (0-3%)', 'Twin needle hem'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Regular Fit Tee (200 GSM)'],
    image: '/products/regular-fit-tee-200gsm.webp',
  },
  {
    id: 2,
    slug: 'boxy-fit-tee-200gsm',
    name: 'Boxy Fit T-Shirt',
    pricingKey: 'Boxy Fit Tee (200 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: '200 GSM boxy fit tee. Dropped shoulders, relaxed body. Ideal for lifestyle and streetwear branding.',
    gsm: 200,
    fits: ['Boxy'],
    details: ['200 GSM 100% combed cotton', 'Boxy oversized fit', 'Drop shoulder', 'Crew neck', 'Preshrunk fabric'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Boxy Fit Tee (200 GSM)'],
    image: '/products/boxy-fit-tee-200gsm.webp',
  },
  {
    id: 3,
    slug: 'regular-fit-tee-260gsm',
    name: 'Regular Fit Heavyweight T-Shirt',
    pricingKey: 'Regular Fit Tee (260 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: '260 GSM heavyweight regular fit tee. Structured feel, premium drape.',
    gsm: 260,
    fits: ['Regular'],
    details: ['260 GSM 100% combed cotton', 'Regular fit', 'Crew neck', 'Preshrunk fabric', 'Reinforced seams'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Regular Fit Tee (260 GSM)'],
    image: '/products/regular-fit-tee-260gsm.webp',
  },
  {
    id: 4,
    slug: 'boxy-fit-tee-260gsm',
    name: 'Boxy Fit Heavyweight T-Shirt',
    pricingKey: 'Boxy Fit Tee (260 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: '260 GSM heavyweight boxy fit tee. Maximum structure, premium weight.',
    gsm: 260,
    fits: ['Boxy'],
    details: ['260 GSM 100% combed cotton', 'Boxy oversized fit', 'Drop shoulder', 'Crew neck', 'Reinforced seams'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Boxy Fit Tee (260 GSM)'],
    image: '/products/boxy-fit-tee-260gsm.webp',
  },
  {
    id: 5,
    slug: 'longsleeve-tee-260gsm',
    name: 'Longsleeve Tee',
    pricingKey: 'Longsleeve Tee (260 GSM)',
    icon: '/icons/longsleeve.webp',
    category: 'Longsleeve',
    description: '260 GSM long sleeve tee. Regular fit, clean finish.',
    gsm: 260,
    details: ['260 GSM 100% combed cotton', 'Regular fit', 'Long sleeves', 'Crew neck', 'Ribbed cuffs'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Longsleeve Tee (260 GSM)'],
    image: '/products/longsleeve-tee-260gsm.webp',
  },
  {
    id: 6,
    slug: 'polo-280gsm',
    name: 'Polo',
    pricingKey: 'Polo (280 GSM)',
    icon: '/icons/tee.webp',
    category: 'Polos',
    description: '280 GSM polo with a structured collar and clean regular fit.',
    gsm: 280,
    fits: ['Regular'],
    details: ['280 GSM cotton pique', 'Regular fit', 'Ribbed polo collar', 'Button placket', 'Preshrunk fabric'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Polo (280 GSM)'],
    image: '/products/polo-tee.webp',
  },
  {
    id: 7,
    slug: 'canvas-tote-bag',
    name: 'Canvas Tote Bag',
    pricingKey: 'Canvas Tote Bag',
    icon: '/icons/totebag.webp',
    category: 'Accessories',
    description: '12oz natural canvas tote. Reinforced handles, gusset base.',
    gsm: 340,
    details: ['12oz (340 GSM) natural canvas', 'Reinforced 24" handles', 'Gusset base', '38cm x 42cm body'],
    careInstructions: ['Hand Wash', 'Air Dry', 'Do not Machine Wash', 'Iron on Low'],
    sizes: ['One Size'],
    price: PRODUCT_PRICES['Canvas Tote Bag'],
    image: '/products/canvas-tote-bag.webp',
  },
  {
    id: 8,
    slug: 'regular-fit-sweatshirt-320gsm',
    name: 'Regular Fit Sweatshirt',
    pricingKey: 'Regular Fit Sweatshirt (320 GSM)',
    icon: '/icons/sweatshirt.webp',
    category: 'Sweatshirts',
    description: '320 GSM crewneck sweatshirt in regular fit.',
    gsm: 320,
    fits: ['Regular'],
    details: ['320 GSM 80/20 cotton-poly fleece', 'Regular fit', 'Crewneck collar', 'Ribbed cuffs and hem', 'Brushed inner fleece'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Regular Fit Sweatshirt (320 GSM)'],
    image: '/products/regular-fit-sweatshirt-320gsm.webp',
  },
  {
    id: 9,
    slug: 'regular-fit-hoodie-320gsm',
    name: 'Regular Fit Hoodie',
    pricingKey: 'Regular Fit Hoodie (320 GSM)',
    icon: '/icons/hoodie.webp',
    category: 'Hoodies',
    description: '320 GSM pullover hoodie in regular fit. Kangaroo pocket, structured hood.',
    gsm: 320,
    fits: ['Regular'],
    details: ['320 GSM 80/20 cotton-poly fleece', 'Regular fit', 'Kangaroo pocket', 'Structured hood with drawcord', 'Ribbed cuffs and hem'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Regular Fit Hoodie (320 GSM)'],
    image: '/products/regular-fit-hoodie-320gsm.webp',
  },
  {
    id: 10,
    slug: 'boxy-fit-hoodie-320gsm',
    name: 'Boxy Fit Hoodie',
    pricingKey: 'Boxy Fit Hoodie (320 GSM)',
    icon: '/icons/hoodie.webp',
    category: 'Hoodies',
    description: '320 GSM pullover hoodie in boxy fit. Oversized hood, dropped shoulders.',
    gsm: 320,
    fits: ['Boxy'],
    details: ['320 GSM 80/20 cotton-poly fleece', 'Boxy oversized fit', 'Drop shoulder', 'Kangaroo pocket', 'Oversized hood with drawcord'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    price: PRODUCT_PRICES['Boxy Fit Hoodie (320 GSM)'],
    image: '/products/boxy-fit-hoodie-320gsm.webp',
  },
]

export const categories = ['T-Shirts', 'Longsleeve', 'Polos', 'Sweatshirts', 'Hoodies', 'Accessories']

export function productSeoTitle(product: Product) {
  const fit = product.fits?.[0]

  if (product.category === 'T-Shirts') {
    const weight = product.gsm >= 260 ? ' Heavyweight' : ''
    const fitLabel = fit === 'Boxy' ? 'Boxy ' : fit === 'Regular' ? 'Regular Fit ' : ''
    return `Custom ${product.gsm} GSM ${fitLabel}${weight.trimStart()} T-Shirt | Bulk Orders India`
      .replace(/\s+/g, ' ')
  }

  if (product.category === 'Polos') {
    return `Custom ${product.gsm} GSM Polo T-Shirt | Company & Staff Orders`
  }

  if (product.category === 'Hoodies') {
    return `Custom ${product.gsm} GSM ${fit ?? ''} Fit Hoodie | Bulk Orders India`
      .replace(/\s+/g, ' ')
  }

  if (product.category === 'Accessories') {
    return 'Custom Canvas Tote Bag | Bulk Orders India'
  }

  if (product.category === 'Sweatshirts') {
    return `Custom ${product.gsm} GSM ${fit ?? ''} Fit Sweatshirt | Bulk Orders India`
      .replace(/\s+/g, ' ')
  }

  return `Custom ${product.name} | Bulk Orders India`
}

export function productSeoDescription(product: Product) {
  if (product.category === 'Polos') {
    return `Compare the ${product.gsm} GSM cotton-pique polo, order a catalogue sample or configure custom company and staff polos from 50 pieces in India.`
  }

  if (product.category === 'Accessories') {
    return 'Compare the 12 oz canvas tote specification, order a catalogue sample or configure custom printed tote bags from 50 pieces in India.'
  }

  return `Compare the ${product.gsm} GSM ${product.name} specification, order a catalogue sample or configure a bulk branded run from 50 pieces in India.`
}

export function productCategoryLandingPath(product: Product) {
  if (product.category === 'T-Shirts') return '/custom-t-shirt-printing'
  if (product.category === 'Polos') return '/custom-polo-t-shirts'
  if (product.category === 'Hoodies') return '/custom-hoodies'
  if (product.category === 'Accessories') return '/custom-tote-bags'
  return '/products'
}

export function productCategoryLinkLabel(product: Product) {
  if (product.category === 'T-Shirts') return 'Compare all bulk custom T-shirt options'
  if (product.category === 'Polos') return 'Explore custom polo T-shirts for company and staff orders'
  if (product.category === 'Hoodies') return 'Compare regular and boxy custom hoodies'
  if (product.category === 'Accessories') return 'Explore custom canvas tote bags in bulk'
  return 'Browse all custom apparel products'
}

export function productImageAlt(product: Product) {
  const fit = product.fits?.[0] ? `${product.fits[0].toLowerCase()}-fit ` : ''
  const productName = product.name.toLowerCase()
  return `${product.gsm} GSM ${fit}${productName} for custom bulk apparel orders`
}

export function productSuitableUseCases(product: Product) {
  if (product.category === 'Polos') {
    return ['Company and field teams', 'Restaurant and hospitality staff', 'Exhibitions and events', 'Clubs and studios']
  }
  if (product.category === 'Hoodies' || product.category === 'Sweatshirts') {
    return ['Employee merchandise', 'Team and club apparel', 'Event crews', 'Premium studio and retail merchandise']
  }
  if (product.category === 'Accessories') {
    return ['Company programmes', 'Conferences and events', 'Cafe and studio merchandise', 'Branded retail collections']
  }
  if (product.category === 'T-Shirts') {
    return product.gsm >= 260
      ? ['Premium company merchandise', 'Artist and studio collections', 'Events and branded retail drops', 'Clubs and community apparel']
      : ['Employee and staff apparel', 'Events and conferences', 'Restaurant and cafe apparel', 'Clubs and everyday merchandise']
  }
  return ['Company apparel', 'Events and team programmes', 'Branded merchandise collections']
}

export function productDecorationMethods(product: Product) {
  if (product.category === 'Polos') {
    return ['Embroidery for suitable compact logos', 'Screen printing for suitable artwork', 'DTF for reviewed detailed artwork']
  }
  if (product.category === 'Accessories') {
    return ['Screen printing for bold artwork', 'DTF for reviewed detailed artwork']
  }
  return ['Screen printing', 'DTF', 'DTG on compatible garments', 'Embroidery for suitable artwork and positions']
}
