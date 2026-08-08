import { industryHubCards } from './industries'
import { productFitLabel, products } from './products'

export const CURRENT_PRINT_TECHNIQUES = ['Screen Print', 'DTF', 'Reflective Print'] as const

export type CurrentPrintTechnique = (typeof CURRENT_PRINT_TECHNIQUES)[number]
export type CaseStudyTechnique = CurrentPrintTechnique
export type CaseStudyImageType = 'project image' | 'finished garment' | 'artwork' | 'print detail' | 'fabric detail' | 'production' | 'packing' | 'worn/use image'

export type CaseStudyProduct = {
  productId: string
  quantity?: number
  colour?: string
  artwork?: string
  printTechniques?: CaseStudyTechnique[]
  sizeRange?: string
}

export type CaseStudyImage = {
  src: string
  alt: string
  type: CaseStudyImageType
  caption?: string
}

export type CaseStudyField = {
  label: string
  value: string
}

export type CaseStudyOutcome = {
  title: string
  description: string
  sourceNote?: string
}

export type CaseStudy = {
  slug: string
  client: string
  projectName: string
  industryId: string
  headline: string
  summary: string
  coverImage: string | null
  products: CaseStudyProduct[]
  totalQuantity?: number
  printTechniques: CaseStudyTechnique[]
  productionTimeline?: string
  projectDate?: string
  colourways?: string[]
  artworkCount?: number
  brief: CaseStudyField[]
  configuration?: CaseStudyField[]
  productionNotes?: string[]
  outcomes?: CaseStudyOutcome[]
  gallery?: CaseStudyImage[]
  testimonial?: {
    quote: string
    name: string
    role?: string
    company?: string
  }
  auditNotes?: string[]
}

const projectImage = (src: string, alt: string): CaseStudyImage => ({
  src,
  alt,
  type: 'project image',
})

/** The public portfolio currently contains only the Screen Print project. */
export const caseStudies: CaseStudy[] = [
  {
    slug: 'soundwave-festival-merch',
    client: 'Soundwave Festival',
    projectName: 'Soundwave Festival merchandise',
    industryId: 'events-entertainment',
    headline: 'Festival merchandise across three screen-print designs.',
    summary: 'Soundwave needed 300 pieces of merchandise across three designs for its annual music festival. The original project record describes a 22-day production timeline and delivery to the venue.',
    coverImage: '/work/soundwave/cover.webp',
    products: [
      {
        productId: 'boxy-fit-tee-260gsm',
        colour: 'White and Charcoal',
        artwork: 'Three designs',
        printTechniques: ['Screen Print'],
      },
      {
        productId: 'canvas-tote-bag',
        colour: 'White and Charcoal',
        artwork: 'Three designs',
        printTechniques: ['Screen Print'],
      },
    ],
    totalQuantity: 300,
    printTechniques: ['Screen Print'],
    productionTimeline: '22 days',
    projectDate: 'January 2025',
    colourways: ['White', 'Charcoal'],
    artworkCount: 3,
    brief: [
      { label: 'Need', value: 'Festival merchandise for a two-day event' },
      { label: 'Products', value: 'Premium Oversized T-Shirt + Canvas Tote Bag' },
      { label: 'Quantity', value: '300 pieces' },
      { label: 'Artwork', value: 'Three screen-print designs' },
      { label: 'Production timeline', value: '22 days' },
    ],
    configuration: [
      { label: 'Garments', value: 'Premium Oversized T-Shirt and Canvas Tote Bag' },
      { label: 'Colourways', value: 'White and Charcoal' },
      { label: 'Print', value: 'Screen Print' },
      { label: 'Artwork', value: 'Three designs' },
      { label: 'Packing', value: 'Individual bagging with size stickers' },
    ],
    productionNotes: [
      'The original project record says all pieces were bagged individually with size stickers for merchandise-booth setup.',
      'No artwork files, process photographs, size range or product-level quantity split are present in the repository.',
    ],
    outcomes: [
      {
        title: '280 of 300 pieces sold',
        description: 'The original project record states that 280 of 300 pieces sold across the two-day festival.',
        sourceNote: 'Original project record; sales data and owner approval are not established in the repository.',
      },
      {
        title: 'Tote bags sold out on day one',
        description: 'The original project record states that the tote bags sold out on the first day.',
        sourceNote: 'Original project record; sales data and owner approval are not established in the repository.',
      },
      {
        title: 'A larger run was discussed',
        description: 'The original project record says Soundwave briefed Garmops for a larger run the following year.',
        sourceNote: 'Original project record; owner approval is not established in the repository.',
      },
    ],
    gallery: [projectImage('/work/soundwave/cover.webp', 'Soundwave Festival project image')],
    testimonial: {
      quote: 'We sold 93% of our merch over two days. That has never happened before. The quality matched the energy of the festival.',
      name: 'Arjun Sood',
      role: 'Festival Director',
      company: 'Soundwave',
    },
    auditNotes: [
      'This is the only stored project whose declared technique is entirely within the current Screen Print, DTF and Reflective Print offering.',
      'The cover image shows a hoodie and does not visibly establish the stored T-shirt and tote combination.',
      'Client identity, product mapping, total quantity, production timeline, testimonial permission, sell-through claims and larger-run claim require owner verification.',
    ],
  },
]

export function getCaseStudy(slug: string) {
  return caseStudies.find(study => study.slug === slug)
}

export function getCaseStudyProduct(productId: string) {
  return products.find(product => product.slug === productId)
}

export function getCaseStudyIndustry(industryId: string) {
  return industryHubCards.find(industry => industry.id === industryId)
}

export function matchesCaseStudyIndustry(study: CaseStudy, filter: string) {
  const legacyIndustryIds: Record<string, string> = {
    'Hotels & Restaurants': 'cafes-hospitality',
    'Music & Events': 'events-entertainment',
    'Creative Studios': 'creative-teams',
    'Companies & Startups': 'companies-teams',
  }
  const normalizedFilter = legacyIndustryIds[filter] ?? filter
  const industry = getCaseStudyIndustry(study.industryId)
  return study.industryId === normalizedFilter || industry?.name === filter
}

export function getCaseStudyProductLabel(productId: string) {
  return getCaseStudyProduct(productId)?.name ?? productId
}

export function getCaseStudyProductSpecs(productId: string) {
  const product = getCaseStudyProduct(productId)
  if (!product) return []

  return [
    `${product.gsm} GSM`,
    product.selectorMaterial,
    productFitLabel(product),
  ]
}

export function formatCaseStudyProducts(study: CaseStudy) {
  return study.products.map(product => getCaseStudyProductLabel(product.productId)).join(' + ')
}

export function getRelatedCaseStudies(study: CaseStudy, limit = 2) {
  const candidates = caseStudies
    .filter(candidate => candidate.slug !== study.slug)
    .map(candidate => {
      const sameIndustry = candidate.industryId === study.industryId
      const sameProduct = candidate.products.some(product => study.products.some(item => item.productId === product.productId))
      const sameTechnique = candidate.printTechniques.some(technique => study.printTechniques.includes(technique))

      return {
        candidate,
        score: Number(sameIndustry) * 3 + Number(sameProduct) * 2 + Number(sameTechnique),
      }
    })
    .sort((a, b) => b.score - a.score)

  return candidates.slice(0, limit).map(item => item.candidate)
}
