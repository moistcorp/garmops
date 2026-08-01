import { caseStudies } from './casestudies'
import { homeFaqs } from './homeContent'
import { journalPosts } from './journal'
import { landingPageByPath } from './landingPages'
import {
  DELIVERY_DAYS,
  GST_RATE,
  RUSH_DELIVERY_DAYS,
  VOLUME_TIERS,
} from './pricing'
import { products } from './products'
import { siteConfig } from './seo'
import { normalizeAgentPath } from './agentRoutes'

const MOQ = 50

function absolute(path: string) {
  return new URL(path, siteConfig.url).toString()
}

function list(items: readonly string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function links(items: Array<{ label: string; href: string }>) {
  return items.map(({ label, href }) => `- [${label}](${absolute(href)})`).join('\n')
}

function table(headers: string[], rows: string[][]) {
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return [
    `| ${headers.map(escapeCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n')
}

function document({
  title,
  description,
  path,
  body,
}: {
  title: string
  description: string
  path: string
  body: string
}) {
  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `canonical: ${JSON.stringify(absolute(path))}`,
    '---',
    '',
    `# ${title}`,
    '',
    `> ${description}`,
    '',
    body.trim(),
    '',
    '## Contact Garmops',
    '',
    `- Email: [${siteConfig.email}](mailto:${siteConfig.email})`,
    `- Telephone and WhatsApp: [${siteConfig.phone}](tel:${siteConfig.phone.replace(/-/g, '')})`,
    `- [Request a quote](${absolute('/contact')})`,
    '',
    'Final pricing, production feasibility, shipping, and delivery dates are confirmed by Garmops after reviewing the complete order specification.',
    '',
  ].join('\n')
}

function homeMarkdown() {
  const lowestPrice = Math.min(...products.map((product) => product.price))
  return document({
    title: 'Garmops — Custom Apparel, Made to Order',
    description: siteConfig.description,
    path: '/',
    body: `
## Key order facts

- Minimum order: ${MOQ} pieces per style.
- Standard delivery target: ${DELIVERY_DAYS} days from order confirmation.
- Rush delivery target: ${RUSH_DELIVERY_DAYS} days when the order is feasible.
- Current catalogue prices start at ₹${lowestPrice.toLocaleString('en-IN')} per piece before GST and shipping.
- Location: ${siteConfig.address.locality}, ${siteConfig.address.region}, India.
- GST-compliant invoicing and company purchase orders are supported.

## Products

${products.map((product) => `- [${product.name}, ${product.gsm} GSM](${absolute(`/products/${product.slug}`)}): ${product.description} Starting at ₹${product.price.toLocaleString('en-IN')} per piece.`).join('\n')}

## Start here

${links([
  { label: 'Browse products and sample specifications', href: '/products' },
  { label: 'Estimate current pricing', href: '/pricing' },
  { label: 'Configure an order', href: '/configurator' },
  { label: 'Read buyer guides', href: '/journal' },
  { label: 'Review case studies', href: '/work' },
])}

## Common questions

${homeFaqs.map(({ q, a }) => `### ${q}\n\n${a}`).join('\n\n')}
`,
  })
}

function productsMarkdown() {
  return document({
    title: 'Custom Apparel Product Catalogue',
    description: `Garmops product specifications and sample starting prices for bulk custom apparel from ${MOQ} pieces per style.`,
    path: '/products',
    body: `
## Catalogue

${products.map((product) => [
  `### [${product.name}](${absolute(`/products/${product.slug}`)})`,
  '',
  product.description,
  '',
  `- Fabric weight: ${product.gsm} GSM`,
  `- Category: ${product.category}`,
  `- Available sizes: ${product.sizes.join(', ')}`,
  `- Starting price: ₹${product.price.toLocaleString('en-IN')} per piece before GST and shipping`,
  `- Construction: ${product.details.join('; ')}`,
].join('\n')).join('\n\n')}

## Pricing scope

The displayed base price is a starting estimate for the garment, stitching, a single-colour screen print, and a neck label. Quantity, artwork size and positions, decoration method, sampling, custom dyeing, packaging, rush production, GST, and shipping can change the final price.
`,
  })
}

function productMarkdown(slug: string) {
  const product = products.find((item) => item.slug === slug)
  if (!product) return null

  return document({
    title: `${product.name} — ${product.gsm} GSM`,
    description: product.description,
    path: `/products/${product.slug}`,
    body: `
## Specification

- Category: ${product.category}
- Fabric weight: ${product.gsm} GSM
- Fit: ${product.fits?.join(', ') ?? 'See the approved product sample'}
- Sizes: ${product.sizes.join(', ')}
- Starting price: ₹${product.price.toLocaleString('en-IN')} per piece before GST and shipping
- Minimum custom order: ${MOQ} pieces per style

## Construction

${list(product.details)}

## Care

${list(product.careInstructions)}

## Ordering

The displayed price is a starting estimate. Confirm garment colour, total quantity, size split, artwork files, print dimensions and positions, decoration method, neck label, packaging, delivery destination, and required-in-hand date before relying on a final quote.

${links([
  { label: 'Configure this custom order', href: `/configurator?product=${product.slug}` },
  { label: 'Estimate pricing', href: '/pricing' },
  { label: 'Request a reviewed quote', href: '/contact' },
])}
`,
  })
}

function landingPageMarkdown(pathname: string) {
  const content = landingPageByPath(pathname)
  if (!content) return null

  const selectedProducts = products.filter(product => content.productSlugs?.includes(product.slug))
  const featureSections = [
    {
      title: content.featuresHeading,
      introduction: content.featuresIntroduction,
      features: content.features,
    },
    ...(content.sections ?? []),
  ]

  return document({
    title: content.title,
    description: content.seo.description,
    path: pathname,
    body: `
## Service summary

${content.lead}

## Key order facts

${list(content.trustPoints)}

## ${content.productHeading}

${content.productIntroduction ?? 'Review the current Garmops catalogue specifications before approving a bulk order.'}

${selectedProducts.map(product => [
  `### [${product.name}](${absolute(`/products/${product.slug}`)})`,
  '',
  product.description,
  '',
  `- Fabric weight: ${product.gsm} GSM`,
  `- Fit: ${product.fits?.join(', ') ?? 'See the product specification'}`,
  `- Available sizes: ${product.sizes.join(', ')}`,
  `- Catalogue sample price: ₹${product.price.toLocaleString('en-IN')}`,
  `- Construction: ${product.details.join('; ')}`,
].join('\n')).join('\n\n')}

${featureSections.map(section => [
  `## ${section.title}`,
  '',
  section.introduction ?? '',
  '',
  ...section.features.map(feature => [
    `### ${feature.title}`,
    '',
    feature.description,
    feature.link ? `\n[${feature.link.label}](${absolute(feature.link.href)})` : '',
  ].join('\n')),
  ...(section.links?.length ? ['', 'Related:', '', links(section.links)] : []),
].join('\n')).join('\n\n')}

${content.useCases?.length && content.useCasesHeading ? [
  `## ${content.useCasesHeading}`,
  '',
  content.useCasesIntroduction ?? '',
  '',
  ...content.useCases.map(useCase => `### ${useCase.title}\n\n${useCase.description}`),
].join('\n') : ''}

${content.steps?.length && content.stepsHeading ? [
  `## ${content.stepsHeading}`,
  '',
  content.stepsIntroduction ?? '',
  '',
  ...content.steps.map((step, index) => `${index + 1}. **${step.title}:** ${step.description}`),
].join('\n') : ''}

## Frequently asked questions

${content.faqs.map(faq => `### ${faq.question}\n\n${faq.answer}`).join('\n\n')}

## Related buyer guides

${links(content.relatedGuides)}

## Related Garmops pages

${links([
  ...content.relatedPages,
  { label: content.cta.primary.label, href: content.cta.primary.href },
  ...(content.cta.secondary ? [content.cta.secondary] : []),
])}
`,
  })
}

function pricingMarkdown() {
  return document({
    title: 'Bulk Custom Apparel Pricing',
    description: `Current Garmops base prices, volume discounts, GST, and delivery options for orders from ${MOQ} pieces per style.`,
    path: '/pricing',
    body: `
## Current starting prices

${table(
  ['Product', 'GSM', 'Starting price per piece'],
  products.map((product) => [
    `[${product.name}](${absolute(`/products/${product.slug}`)})`,
    String(product.gsm),
    `₹${product.price.toLocaleString('en-IN')}`,
  ]),
)}

## Volume tiers

${table(
  ['Quantity', 'Discount from base garment price'],
  VOLUME_TIERS.map((tier) => [
    tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`,
    tier.label,
  ]),
)}

## What affects the final quote

- The base estimate includes the garment, stitching, a single-colour screen print, and a neck label.
- GST is ${(GST_RATE * 100).toFixed(0)}%; shipping is calculated separately.
- Additional artwork positions, colours, techniques, sampling, custom dyeing, packaging, and rush production add cost.
- Standard delivery targets ${DELIVERY_DAYS} days from confirmation.
- A ${RUSH_DELIVERY_DAYS}-day rush option is subject to feasibility and currently adds a rush fee.
- The estimator is indicative. A reviewed written quote and production specification govern the order.
`,
  })
}

function journalIndexMarkdown() {
  return document({
    title: 'Garmops Guides',
    description: 'Production-led buyer guides for custom apparel, bulk merchandise, fabric, printing, pricing, and manufacturer selection.',
    path: '/journal',
    body: `
## Guides

${journalPosts.map((post) => [
  `### [${post.title}](${absolute(`/journal/${post.slug}`)})`,
  '',
  `${post.excerpt} ${post.readTime}; published ${post.date}.`,
].join('\n')).join('\n\n')}
`,
  })
}

function journalMarkdown(slug: string) {
  const post = journalPosts.find((item) => item.slug === slug)
  if (!post) return null

  const sections = post.sections.map((section) => [
    `## ${section.heading}`,
    '',
    section.paragraphs.join('\n\n'),
    section.bullets?.length ? `\n\n${list(section.bullets)}` : '',
    section.table ? `\n\n${table(section.table.headers, section.table.rows)}` : '',
    section.links?.length ? `\n\nRelated:\n\n${links(section.links)}` : '',
  ].join('')).join('\n\n')

  return document({
    title: post.title,
    description: post.metaDescription ?? post.excerpt,
    path: `/journal/${post.slug}`,
    body: `
- Category: ${post.category}
- Published: ${post.publishedAt}
- Updated: ${post.updatedAt ?? post.publishedAt}
- Author: ${post.author ?? 'Garmops'}
- Reading time: ${post.readTime}

${post.takeaways?.length ? `## Key takeaways\n\n${list(post.takeaways)}\n\n` : ''}${sections}

${post.faq?.length ? `## Frequently asked questions\n\n${post.faq.map(({ q, a }) => `### ${q}\n\n${a}`).join('\n\n')}` : ''}

${post.relatedLinks?.length ? `## Related Garmops resources\n\n${links(post.relatedLinks)}` : ''}
`,
  })
}

function workIndexMarkdown() {
  return document({
    title: 'Garmops Custom Apparel Case Studies',
    description: 'Case studies covering custom uniforms, festival merchandise, team kits, and studio apparel produced by Garmops.',
    path: '/work',
    body: `
## Case studies

${caseStudies.map((study) => [
  `### [${study.title}](${absolute(`/work/${study.slug}`)})`,
  '',
  study.excerpt,
  '',
  `- Client: ${study.client}`,
  `- Product: ${study.product}`,
  `- Quantity: ${study.quantity}`,
  `- Turnaround: ${study.turnaround}`,
].join('\n')).join('\n\n')}
`,
  })
}

function workMarkdown(slug: string) {
  const study = caseStudies.find((item) => item.slug === slug)
  if (!study) return null

  return document({
    title: study.title,
    description: study.excerpt,
    path: `/work/${study.slug}`,
    body: `
## Project facts

- Client: ${study.client}
- Industry: ${study.industry}
- Product: ${study.product}
- Quantity: ${study.quantity}
- Colour: ${study.color}
- Decoration: ${study.printMethod}
- Turnaround: ${study.turnaround}
- Date: ${study.date}
- Deliverables: ${study.deliverables.join(', ')}

## Challenge

${study.challenge}

## Solution

${study.solution}

## Result

${study.result}

${study.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join('\n\n')}

${study.testimonial ? `## Client comment\n\n> ${study.testimonial.quote}\n>\n> — ${study.testimonial.author}, ${study.testimonial.role}` : ''}
`,
  })
}

function aboutMarkdown() {
  return document({
    title: 'About Garmops',
    description: 'Garmops is a B2B custom apparel and branded merchandise manufacturer and online ordering platform operated by Moist Corp in Greater Noida, India.',
    path: '/about',
    body: `
## What Garmops makes

Garmops produces bulk custom T-shirts, polos, hoodies, sweatshirts, long-sleeve tees, and canvas tote bags for brands, startups, companies, hospitality teams, creative studios, sports organisations, artists, and events.

## Operating facts

- Minimum custom order: ${MOQ} pieces per style.
- Standard delivery target: ${DELIVERY_DAYS} days from order confirmation.
- Rush delivery target: ${RUSH_DELIVERY_DAYS} days for feasible orders.
- Location: ${siteConfig.address.locality}, ${siteConfig.address.region}, India.
- Shipping: pan-India and international options.
- GST-compliant invoices and company purchase orders are supported.
- Catalogue samples and paid custom pre-production samples are available.

## Useful resources

${links([
  { label: 'Product catalogue', href: '/products' },
  { label: 'Current pricing', href: '/pricing' },
  { label: 'Case studies', href: '/work' },
])}
`,
  })
}

function contactMarkdown() {
  return document({
    title: 'Contact Garmops',
    description: 'Request a reviewed quote for a bulk custom-apparel or branded-merchandise order.',
    path: '/contact',
    body: `
## Quote request checklist

${list([
  'Organisation name and intended use',
  'Product, fit, GSM, garment colour, and quantity per style',
  'Size split',
  'Artwork files, intended positions, and physical print dimensions',
  'Decoration technique or permission for Garmops to recommend one',
  'Neck-label, packaging, custom colour, and sample requirements',
  'Delivery postcode and required-in-hand date',
  'GST and purchase-order requirements',
])}

Do not send payment-card details, payment credentials, passwords, or sensitive identity documents in a quote request.
`,
  })
}

function configuratorMarkdown() {
  return document({
    title: 'Garmops Online Custom Apparel Configurator',
    description: 'A human-facing tool for selecting a product, colour, artwork position, decoration, neck label, sizes, and quantity for a Garmops order.',
    path: '/configurator',
    body: `
## What the configurator does

1. Select a catalogue garment.
2. Choose a ready-stock colour or record a custom dye reference.
3. Upload artwork and define supported positions.
4. Select a decoration technique and neck-label options.
5. Enter quantity and size allocation.
6. Review the estimate and submit the order details for production review.

The configurator is an interactive browser experience, not a public agent API. Agents should prepare a written brief using the Garmops Agent Skill, then give the user the brief and link them to the configurator or contact page.

## Agent resources

${links([
  { label: 'Prepare a custom-apparel brief skill', href: '/.well-known/agent-skills/prepare-custom-apparel-brief/SKILL.md' },
  { label: 'Product catalogue', href: '/products' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
])}
`,
  })
}

export function renderAgentMarkdown(pathname: string) {
  const normalized = normalizeAgentPath(pathname)
  const landingPage = landingPageMarkdown(normalized)

  if (landingPage) return landingPage
  if (normalized === '/') return homeMarkdown()
  if (normalized === '/products') return productsMarkdown()
  if (normalized === '/pricing') return pricingMarkdown()
  if (normalized === '/journal') return journalIndexMarkdown()
  if (normalized === '/work') return workIndexMarkdown()
  if (normalized === '/about') return aboutMarkdown()
  if (normalized === '/contact') return contactMarkdown()
  if (normalized === '/configurator') return configuratorMarkdown()

  const [, section, slug, ...rest] = normalized.split('/')
  if (rest.length > 0 || !slug) return null
  if (section === 'products') return productMarkdown(slug)
  if (section === 'journal') return journalMarkdown(slug)
  if (section === 'work') return workMarkdown(slug)
  return null
}
