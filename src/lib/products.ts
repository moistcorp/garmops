import { getCatalogueBasePriceRupees } from './pricingRules'

export type Product = {
  id: number
  slug: string
  name: string
  technicalName: string
  selectorCategory: 'T-Shirts' | 'Polos' | 'Hoodies' | 'Sweatshirts' | 'Tote Bags'
  selectorFit?: 'Classic' | 'Oversized'
  selectorFeel: 'Everyday' | 'Heavyweight' | 'Structured' | 'Warm Fleece' | 'Heavy Canvas'
  selectorBadge: string
  selectorDescription: string
  selectorMaterial: string
  bestFor: string[]
  pricingKey: string
  icon: string
  category: string
  description: string
  gsm: number
  fits?: string[]
  details: string[]
  careInstructions: string[]
  sizes: string[]
  minimumOrderQuantity: number
  price: number
  image: string | null
}

export type ProductSpecification = {
  label: string
  value: string
}

export type ProductBenefit = {
  title: string
  description: string
}

export type ProductDecorationMethod = {
  name: 'Screen Print' | 'DTF' | 'Reflective Print'
  description: string
  recommended?: boolean
}

export const products: Product[] = [
  {
    id: 1,
    slug: 'regular-fit-tee-200gsm',
    name: 'Classic T-Shirt',
    technicalName: 'Regular Fit T-Shirt',
    selectorCategory: 'T-Shirts',
    selectorFit: 'Classic',
    selectorFeel: 'Everyday',
    selectorBadge: 'Most versatile',
    selectorDescription: 'A reliable everyday T-shirt for teams, events and company merchandise.',
    selectorMaterial: '100% Cotton',
    bestFor: ['Companies', 'Cafés', 'Events'],
    pricingKey: 'Regular Fit Tee (200 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: 'An everyday regular-fit T-shirt with a familiar silhouette for staff apparel, events and versatile merchandise.',
    gsm: 200,
    fits: ['Regular'],
    details: ['200 GSM 100% Cotton French Terry', 'Regular fit', 'Crew neck', 'Preshrunk fabric (0-3%)', 'Twin needle hem'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('regular-fit-tee-200gsm'),
    image: '/products/regular-fit-tee-200gsm.webp',
  },
  {
    id: 2,
    slug: 'boxy-fit-tee-200gsm',
    name: 'Relaxed T-Shirt',
    technicalName: 'Boxy Fit T-Shirt',
    selectorCategory: 'T-Shirts',
    selectorFit: 'Oversized',
    selectorFeel: 'Everyday',
    selectorBadge: 'Relaxed fit',
    selectorDescription: 'A relaxed silhouette with dropped shoulders for modern, casual merchandise.',
    selectorMaterial: '100% Cotton',
    bestFor: ['Cafés', 'Creative teams', 'Merch'],
    pricingKey: 'Boxy Fit Tee (200 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: 'A relaxed everyday T-shirt with dropped shoulders and a roomier body for contemporary merchandise.',
    gsm: 200,
    fits: ['Boxy'],
    details: ['200 GSM 100% combed cotton', 'Boxy oversized fit', 'Drop shoulder', 'Crew neck', 'Preshrunk fabric'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('boxy-fit-tee-200gsm'),
    image: '/products/boxy-fit-tee-200gsm.webp',
  },
  {
    id: 3,
    slug: 'regular-fit-tee-260gsm',
    name: 'Premium T-Shirt',
    technicalName: 'Regular Fit Heavyweight T-Shirt',
    selectorCategory: 'T-Shirts',
    selectorFit: 'Classic',
    selectorFeel: 'Heavyweight',
    selectorBadge: 'Premium feel',
    selectorDescription: 'A thicker, more structured T-shirt with a substantial premium feel.',
    selectorMaterial: '100% Cotton',
    bestFor: ['Premium company merch', 'Brands'],
    pricingKey: 'Regular Fit Tee (260 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: 'A heavyweight regular-fit T-shirt with a more substantial hand feel while retaining a familiar straight silhouette.',
    gsm: 260,
    fits: ['Regular'],
    details: ['260 GSM 100% combed cotton', 'Regular fit', 'Crew neck', 'Preshrunk fabric', 'Reinforced seams'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('regular-fit-tee-260gsm'),
    image: '/products/regular-fit-tee-260gsm.webp',
  },
  {
    id: 4,
    slug: 'boxy-fit-tee-260gsm',
    name: 'Premium Oversized T-Shirt',
    technicalName: 'Boxy Fit Heavyweight T-Shirt',
    selectorCategory: 'T-Shirts',
    selectorFit: 'Oversized',
    selectorFeel: 'Heavyweight',
    selectorBadge: 'Best for merch',
    selectorDescription: 'Heavy, structured and oversized for merchandise that feels more like a retail product.',
    selectorMaterial: '100% Cotton',
    bestFor: ['Fashion merch', 'Creator merch', 'Brand drops'],
    pricingKey: 'Boxy Fit Tee (260 GSM)',
    icon: '/icons/tee.webp',
    category: 'T-Shirts',
    description: 'A heavyweight oversized T-shirt with dropped shoulders and a structured body for premium merchandise and branded drops.',
    gsm: 260,
    fits: ['Boxy'],
    details: ['260 GSM 100% combed cotton', 'Boxy oversized fit', 'Drop shoulder', 'Crew neck', 'Reinforced seams'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('boxy-fit-tee-260gsm'),
    image: '/products/boxy-fit-tee-260gsm.webp',
  },
  {
    id: 5,
    slug: 'longsleeve-tee-260gsm',
    name: 'Long Sleeve T-Shirt',
    technicalName: 'Longsleeve Tee',
    selectorCategory: 'T-Shirts',
    selectorFit: 'Classic',
    selectorFeel: 'Heavyweight',
    selectorBadge: 'Long sleeve',
    selectorDescription: 'A substantial long-sleeve T-shirt with a clean regular fit and ribbed cuffs.',
    selectorMaterial: '100% Cotton',
    bestFor: ['Teams', 'Events', 'Merch'],
    pricingKey: 'Longsleeve Tee (260 GSM)',
    icon: '/icons/longsleeve.webp',
    category: 'Longsleeve',
    description: 'A heavyweight long-sleeve T-shirt with a regular straight-cut fit and ribbed cuffs.',
    gsm: 260,
    fits: ['Regular'],
    details: ['260 GSM 100% combed cotton', 'Regular fit', 'Long sleeves', 'Crew neck', 'Ribbed cuffs'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('longsleeve-tee-260gsm'),
    image: '/products/longsleeve-tee-260gsm.webp',
  },
  {
    id: 6,
    slug: 'polo-280gsm',
    name: 'Polo T-Shirt',
    technicalName: 'Polo',
    selectorCategory: 'Polos',
    selectorFit: 'Classic',
    selectorFeel: 'Structured',
    selectorBadge: 'Best for teams',
    selectorDescription: 'A smart, structured polo for staff uniforms, customer-facing teams and events.',
    selectorMaterial: 'Cotton Piqué',
    bestFor: ['Staff', 'Teams', 'Uniforms'],
    pricingKey: 'Polo (280 GSM)',
    icon: '/icons/tee.webp',
    category: 'Polos',
    description: 'A structured cotton-piqué polo with a regular fit for staff uniforms, teams and customer-facing apparel.',
    gsm: 280,
    fits: ['Regular'],
    details: ['280 GSM cotton pique', 'Regular fit', 'Ribbed polo collar', 'Button placket', 'Preshrunk fabric'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('polo-280gsm'),
    image: '/products/polo-tee.webp',
  },
  {
    id: 7,
    slug: 'canvas-tote-bag',
    name: 'Canvas Tote Bag',
    technicalName: 'Canvas Tote Bag',
    selectorCategory: 'Tote Bags',
    selectorFeel: 'Heavy Canvas',
    selectorBadge: 'Heavy canvas',
    selectorDescription: 'A sturdy natural-canvas tote for events, gifting and branded merchandise.',
    selectorMaterial: 'Natural Canvas',
    bestFor: ['Events', 'Gifting', 'Merch'],
    pricingKey: 'Canvas Tote Bag',
    icon: '/icons/totebag.webp',
    category: 'Accessories',
    description: 'A sturdy 12 oz natural-canvas tote with reinforced handles and a gusseted base for branded merchandise and event use.',
    gsm: 340,
    details: ['12oz (340 GSM) natural canvas', 'Reinforced 24" handles', 'Gusset base', '38cm x 42cm body'],
    careInstructions: ['Hand Wash', 'Air Dry', 'Do not Machine Wash', 'Iron on Low'],
    sizes: ['One Size'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('canvas-tote-bag'),
    image: '/products/canvas-tote-bag.webp',
  },
  {
    id: 8,
    slug: 'regular-fit-sweatshirt-320gsm',
    name: 'Classic Sweatshirt',
    technicalName: 'Regular Fit Sweatshirt',
    selectorCategory: 'Sweatshirts',
    selectorFit: 'Classic',
    selectorFeel: 'Warm Fleece',
    selectorBadge: 'Warm fleece',
    selectorDescription: 'A clean everyday crewneck with a soft brushed interior for cooler weather.',
    selectorMaterial: 'Cotton-Poly Fleece',
    bestFor: ['Teams', 'Company merch', 'Events'],
    pricingKey: 'Regular Fit Sweatshirt (320 GSM)',
    icon: '/icons/sweatshirt.webp',
    category: 'Sweatshirts',
    description: 'A warm crewneck sweatshirt with a regular fit, ribbed finishes and a brushed fleece interior.',
    gsm: 320,
    fits: ['Regular'],
    details: ['320 GSM 80/20 cotton-poly fleece', 'Regular fit', 'Crewneck collar', 'Ribbed cuffs and hem', 'Brushed inner fleece'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('regular-fit-sweatshirt-320gsm'),
    image: '/products/regular-fit-sweatshirt-320gsm.webp',
  },
  {
    id: 9,
    slug: 'regular-fit-hoodie-320gsm',
    name: 'Classic Hoodie',
    technicalName: 'Regular Fit Hoodie',
    selectorCategory: 'Hoodies',
    selectorFit: 'Classic',
    selectorFeel: 'Warm Fleece',
    selectorBadge: 'Everyday hoodie',
    selectorDescription: 'A versatile pullover hoodie with a clean fit, warm interior and structured hood.',
    selectorMaterial: 'Cotton-Poly Fleece',
    bestFor: ['Teams', 'Company merch', 'Events'],
    pricingKey: 'Regular Fit Hoodie (320 GSM)',
    icon: '/icons/hoodie.webp',
    category: 'Hoodies',
    description: 'A warm regular-fit pullover hoodie with a kangaroo pocket and structured hood for teams and company merchandise.',
    gsm: 320,
    fits: ['Regular'],
    details: ['320 GSM 80/20 cotton-poly fleece', 'Regular fit', 'Kangaroo pocket', 'Structured hood with drawcord', 'Ribbed cuffs and hem'],
    careInstructions: ['Machine Wash', 'Tumble Dry', 'Do not bleach', 'Iron on low heat'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    minimumOrderQuantity: 50,
    price: getCatalogueBasePriceRupees('regular-fit-hoodie-320gsm'),
    image: '/products/regular-fit-hoodie-320gsm.webp',
  },
]

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
  if (product.selectorCategory === 'T-Shirts') return '/custom-t-shirt-printing'
  if (product.selectorCategory === 'Polos') return '/custom-polo-t-shirts'
  if (product.selectorCategory === 'Hoodies') return '/custom-hoodies'
  if (product.selectorCategory === 'Tote Bags') return '/custom-tote-bags'
  return '/products'
}

export function productCategoryLinkLabel(product: Product) {
  if (product.selectorCategory === 'T-Shirts') return 'Compare all bulk custom T-shirt options'
  if (product.selectorCategory === 'Polos') return 'Explore custom polo T-shirts for company and staff orders'
  if (product.selectorCategory === 'Hoodies') return 'Explore custom hoodies for company and team orders'
  if (product.selectorCategory === 'Tote Bags') return 'Explore custom canvas tote bags in bulk'
  return 'Browse all custom apparel products'
}

export function productImageAlt(product: Product) {
  const fit = product.selectorFit ? `${product.selectorFit.toLowerCase()}-fit ` : ''
  return `${product.gsm} GSM ${fit}${product.name.toLowerCase()} for custom bulk apparel orders`
}

export function productFitLabel(product: Product) {
  if (product.selectorCategory === 'Tote Bags') return 'One size'
  return product.selectorFit === 'Oversized' ? 'Oversized fit' : 'Classic fit'
}

export function productFabricFeel(product: Product) {
  switch (product.selectorFeel) {
    case 'Everyday': return 'Everyday weight'
    case 'Heavyweight': return 'Heavyweight & structured'
    case 'Structured': return 'Structured piqué'
    case 'Warm Fleece': return 'Warm brushed fleece'
    case 'Heavy Canvas': return 'Sturdy heavy canvas'
  }
}

export function productFitDescription(product: Product) {
  if (product.slug.includes('boxy-fit-tee')) return 'Roomier body with dropped shoulders for a deliberately oversized silhouette.'
  if (product.slug.includes('longsleeve')) return 'Regular straight-cut fit with long sleeves and ribbed cuffs.'
  if (product.category === 'Polos') return 'Regular fit with a structured collar and button placket.'
  if (product.category === 'Sweatshirts') return 'Regular crewneck fit with ribbed cuffs and hem.'
  if (product.category === 'Hoodies') return 'Regular pullover fit with a structured hood and kangaroo pocket.'
  if (product.category === 'Accessories') return 'One-size tote with a gusseted base and reinforced handles.'
  return 'Regular straight silhouette designed for familiar everyday wear.'
}

export function productBenefits(product: Product): ProductBenefit[] {
  if (product.slug === 'regular-fit-tee-200gsm') return [
    { title: 'Easy everyday choice', description: '200 GSM keeps the garment versatile for regular staff, event and merchandise use.' },
    { title: 'Familiar fit', description: 'A straight regular-fit silhouette is easy to understand when ordering across a team.' },
    { title: 'Flexible branding base', description: 'The cotton body works well as a straightforward base for the three supported print methods.' },
  ]
  if (product.slug === 'boxy-fit-tee-200gsm') return [
    { title: 'Relaxed silhouette', description: 'Dropped shoulders and a roomier body create a more contemporary merchandise look.' },
    { title: 'Everyday weight', description: '200 GSM gives the oversized shape presence without moving into heavyweight territory.' },
    { title: 'Made for casual merch', description: 'A strong option for cafés, creative teams and modern branded merchandise.' },
  ]
  if (product.slug === 'regular-fit-tee-260gsm') return [
    { title: 'More substantial feel', description: '260 GSM gives the T-shirt noticeably more weight and structure than the everyday option.' },
    { title: 'Familiar silhouette', description: 'Keeps a regular straight fit while upgrading the fabric weight.' },
    { title: 'Premium merchandise base', description: 'Well suited to company merchandise and branded collections where garment feel matters.' },
  ]
  if (product.slug === 'boxy-fit-tee-260gsm') return [
    { title: 'Heavyweight feel', description: '260 GSM provides a substantial, structured base for premium merchandise.' },
    { title: 'Oversized silhouette', description: 'Dropped shoulders and a roomier body create a contemporary fit.' },
    { title: 'Built for statement merch', description: 'A strong choice when the blank garment itself needs to feel like part of the product.' },
  ]
  if (product.slug === 'longsleeve-tee-260gsm') return [
    { title: 'Substantial long-sleeve base', description: '260 GSM cotton gives the garment a heavier feel than a standard lightweight long sleeve.' },
    { title: 'Clean straight fit', description: 'Regular straight-cut construction keeps the silhouette simple and easy to wear.' },
    { title: 'Extra print real estate', description: 'The long sleeves create additional placement opportunities alongside front and back artwork.' },
  ]
  if (product.category === 'Polos') return [
    { title: 'Structured appearance', description: 'Cotton piqué, a collar and button placket create a smarter uniform-ready silhouette.' },
    { title: 'Team friendly', description: 'A practical option for staff, event teams and customer-facing roles.' },
    { title: 'Substantial fabric', description: '280 GSM gives the polo a solid, structured hand feel.' },
  ]
  if (product.category === 'Sweatshirts') return [
    { title: 'Warm fleece interior', description: 'Brushed 320 GSM fleece gives the sweatshirt a substantial cooler-weather feel.' },
    { title: 'Clean crewneck shape', description: 'A regular fit and ribbed finishes make it easy to use for teams and company merchandise.' },
    { title: 'Large branding area', description: 'The uninterrupted front and back provide straightforward artwork placement options.' },
  ]
  if (product.slug === 'regular-fit-hoodie-320gsm') return [
    { title: 'Warm everyday layer', description: '320 GSM fleece provides a substantial hand feel for cooler conditions and indoor use.' },
    { title: 'Familiar hoodie fit', description: 'Regular proportions, a kangaroo pocket and structured hood make sizing easy to understand.' },
    { title: 'Versatile team merch', description: 'A practical base for company, team and event merchandise.' },
  ]
  return [
    { title: 'Durable canvas', description: '12 oz natural canvas provides a sturdy base for repeated everyday use.' },
    { title: 'Useful construction', description: 'Reinforced handles and a gusseted base improve carrying capacity.' },
    { title: 'Made for branded utility', description: 'A practical merchandise format for events, gifting and retail-style programmes.' },
  ]
}

export function productSpecifications(product: Product): ProductSpecification[] {
  switch (product.slug) {
    case 'regular-fit-tee-200gsm':
      return [
        { label: 'Fabric', value: '100% Cotton French Terry' },
        { label: 'Weight', value: '200 GSM' },
        { label: 'Fit', value: 'Regular / classic' },
        { label: 'Neck', value: 'Crew neck' },
        { label: 'Shrinkage', value: 'Pre-shrunk (0–3%)' },
        { label: 'Finish', value: 'Twin needle hem' },
      ]
    case 'boxy-fit-tee-200gsm':
      return [
        { label: 'Fabric', value: '100% combed cotton' },
        { label: 'Weight', value: '200 GSM' },
        { label: 'Fit', value: 'Oversized / boxy' },
        { label: 'Shoulder', value: 'Drop shoulder' },
        { label: 'Neck', value: 'Crew neck' },
        { label: 'Shrinkage', value: 'Pre-shrunk' },
      ]
    case 'regular-fit-tee-260gsm':
      return [
        { label: 'Fabric', value: '100% combed cotton' },
        { label: 'Weight', value: '260 GSM' },
        { label: 'Fit', value: 'Regular / classic' },
        { label: 'Neck', value: 'Crew neck' },
        { label: 'Shrinkage', value: 'Pre-shrunk' },
        { label: 'Construction', value: 'Reinforced seams' },
      ]
    case 'boxy-fit-tee-260gsm':
      return [
        { label: 'Fabric', value: '100% combed cotton' },
        { label: 'Weight', value: '260 GSM' },
        { label: 'Fit', value: 'Oversized / boxy' },
        { label: 'Shoulder', value: 'Drop shoulder' },
        { label: 'Neck', value: 'Crew neck' },
        { label: 'Construction', value: 'Reinforced seams' },
      ]
    case 'longsleeve-tee-260gsm':
      return [
        { label: 'Fabric', value: '100% combed cotton' },
        { label: 'Weight', value: '260 GSM' },
        { label: 'Fit', value: 'Regular straight cut' },
        { label: 'Neck', value: 'Crew neck' },
        { label: 'Sleeve', value: 'Long sleeve' },
        { label: 'Cuff', value: 'Ribbed cuff' },
      ]
    case 'polo-280gsm':
      return [
        { label: 'Fabric', value: 'Cotton piqué' },
        { label: 'Weight', value: '280 GSM' },
        { label: 'Fit', value: 'Regular / classic' },
        { label: 'Collar', value: 'Ribbed polo collar' },
        { label: 'Front', value: 'Button placket' },
        { label: 'Shrinkage', value: 'Pre-shrunk' },
      ]
    case 'canvas-tote-bag':
      return [
        { label: 'Fabric', value: 'Natural canvas' },
        { label: 'Weight', value: '12 oz / 340 GSM' },
        { label: 'Body size', value: '38 cm × 42 cm' },
        { label: 'Base', value: 'Gusseted' },
        { label: 'Handles', value: 'Reinforced 24" handles' },
      ]
    case 'regular-fit-sweatshirt-320gsm':
      return [
        { label: 'Fabric', value: '80/20 cotton-poly fleece' },
        { label: 'Weight', value: '320 GSM' },
        { label: 'Fit', value: 'Regular / classic' },
        { label: 'Neck', value: 'Crewneck' },
        { label: 'Finish', value: 'Ribbed cuffs & hem' },
        { label: 'Inside', value: 'Brushed fleece' },
      ]
    case 'regular-fit-hoodie-320gsm':
      return [
        { label: 'Fabric', value: '80/20 cotton-poly fleece' },
        { label: 'Weight', value: '320 GSM' },
        { label: 'Fit', value: 'Regular / classic' },
        { label: 'Pocket', value: 'Kangaroo pocket' },
        { label: 'Hood', value: 'Structured with drawcord' },
        { label: 'Finish', value: 'Ribbed cuffs & hem' },
      ]
    default:
      return [
        { label: 'Fabric', value: '12 oz natural canvas' },
        { label: 'Weight', value: '340 GSM' },
        { label: 'Body size', value: '38 cm × 42 cm' },
        { label: 'Base', value: 'Gusseted' },
        { label: 'Handles', value: 'Reinforced 24" handles' },
      ]
  }
}

export function productDecorationMethods(product: Product): ProductDecorationMethod[] {
  const screenPrint: ProductDecorationMethod = {
    name: 'Screen Print',
    description: 'Best suited to bold, repeatable artwork and larger production runs.',
  }
  const dtf: ProductDecorationMethod = {
    name: 'DTF',
    description: 'Useful for detailed or multi-colour artwork where fine graphic detail matters.',
  }
  const reflective: ProductDecorationMethod = {
    name: 'Reflective Print',
    description: 'A specialist option when a reflective effect is intentional; artwork and placement should be reviewed.',
  }

  if (product.category === 'Polos') {
    return [
      { ...dtf, recommended: true, description: 'Recommended of the three available methods for detailed polo artwork; final suitability depends on artwork and placement.' },
      screenPrint,
      reflective,
    ]
  }

  return [
    { ...screenPrint, recommended: true },
    dtf,
    reflective,
  ]
}

export function productSuitableUseCases(product: Product) {
  return product.bestFor
}
