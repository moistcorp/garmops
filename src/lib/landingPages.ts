import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from './pricing'

export type LandingPageFaq = {
  question: string
  answer: string
}

export type LandingPageLink = {
  label: string
  href: string
}

export type LandingPageFeature = {
  title: string
  description: string
  link?: LandingPageLink
}

export type LandingPageUseCase = {
  title: string
  description: string
}

export type LandingPageStep = {
  title: string
  description: string
}

export type LandingPageSection = {
  eyebrow?: string
  title: string
  introduction?: string
  features: LandingPageFeature[]
  links?: LandingPageLink[]
}

export type SeoLandingPageContent = {
  slug: string
  kind: 'product-category' | 'industry' | 'solution' | 'local'
  breadcrumbLabel: string
  eyebrow: string
  title: string
  lead: string
  seo: {
    title: string
    description: string
    image?: string
  }
  primaryKeyword: string
  secondaryKeywords: string[]
  heroImage?: string
  heroImageAlt?: string
  serviceType: string
  audience: string[]
  trustPoints: string[]
  productHeading: string
  productIntroduction?: string
  featuresHeading: string
  featuresIntroduction?: string
  features: LandingPageFeature[]
  useCasesHeading?: string
  useCasesIntroduction?: string
  useCases?: LandingPageUseCase[]
  productSlugs?: string[]
  sections?: LandingPageSection[]
  stepsHeading?: string
  stepsIntroduction?: string
  steps?: LandingPageStep[]
  techniqueKeys?: Array<'screen-printing' | 'dtf' | 'reflective-print'>
  proofIndustries?: string[]
  faqs: LandingPageFaq[]
  relatedGuides: LandingPageLink[]
  relatedPages: LandingPageLink[]
  cta: {
    title: string
    description: string
    primary: LandingPageLink
    secondary?: LandingPageLink
  }
}

const standardTimeline = `${DELIVERY_DAYS}-day standard delivery target`
const rushTimeline = `${RUSH_DELIVERY_DAYS}-day rush target, subject to feasibility`

const orderingSteps: LandingPageStep[] = [
  {
    title: 'Select the garment',
    description: 'Compare the garment, fabric weight, fit and physical sample before locking the product.',
  },
  {
    title: 'Configure colour and artwork',
    description: 'Choose the garment colour, upload artwork, set its physical dimensions and select or review a decoration method.',
  },
  {
    title: 'Review the specification',
    description: 'Confirm artwork positions, neck label, quantity, size split, delivery location and the configuration or approval PDF.',
  },
  {
    title: 'Approve where required',
    description: 'Use a catalogue or paid pre-production sample when fit, colour, placement or finish is critical.',
  },
  {
    title: 'Production and quality control',
    description: 'Production begins after commercial and artwork approvals, followed by in-process and finished-piece checks.',
  },
  {
    title: 'Packing and delivery',
    description: 'The completed order is counted, packed and dispatched against the agreed delivery requirement.',
  },
]

export const landingPages = {
  customTshirtPrinting: {
    slug: 'custom-t-shirt-printing',
    kind: 'product-category',
    breadcrumbLabel: 'Bulk Custom T-Shirt Printing',
    eyebrow: 'Custom T-shirts',
    title: 'Bulk custom T-shirt printing in India',
    lead: 'Garmops produces custom T-shirts for companies, events, restaurants, studios, gyms and growing brands across India. Choose regular or boxy fits in 200 GSM or 260 GSM cotton, add Screen Print, DTF, Reflective Print and custom neck labels, and begin from 50 pieces per style.',
    seo: {
      title: 'Bulk Custom T-Shirt Printing India | MOQ 50',
      description: 'Order premium custom T-shirts in bulk from 50 pieces. Choose 200 or 260 GSM, regular or oversized fits, Screen Print, DTF, Reflective Print and custom labels.',
      image: '/products/boxy-fit-tee-260gsm.webp',
    },
    primaryKeyword: 'bulk custom T-shirt printing India',
    secondaryKeywords: [
      'custom T-shirts bulk order',
      'company T-shirts with logo',
      '200 GSM custom T-shirts',
      '260 GSM custom T-shirts',
    ],
    heroImage: '/products/boxy-fit-tee-260gsm.webp',
    heroImageAlt: '260 GSM boxy-fit T-shirt for a bulk custom apparel order',
    serviceType: 'Bulk custom T-shirt printing',
    audience: ['Companies', 'Events', 'Hospitality businesses', 'Studios', 'Gyms and clubs', 'Brands'],
    trustPoints: [
      'MOQ 50 pieces per style',
      '200 GSM and 260 GSM options',
      'Regular and boxy fits',
      'Made in India',
      'GST invoicing',
      standardTimeline,
    ],
    productHeading: 'Choose the right T-shirt',
    productIntroduction: 'Start with the intended use and silhouette, then compare weight and finish. Product specifications and sample prices below come directly from the current Garmops catalogue.',
    featuresHeading: 'Match the garment to the order',
    featuresIntroduction: 'Fabric weight and fit solve different parts of the brief. Review both before comparing decoration quotes.',
    features: [
      {
        title: '200 GSM T-shirts',
        description: 'A versatile, lighter option for everyday company apparel, events, hospitality teams and accessible merchandise ranges.',
      },
      {
        title: '260 GSM T-shirts',
        description: 'A heavier, more structured option for premium merchandise and streetwear-inspired collections. It is a different feel, not an objectively better T-shirt.',
      },
      {
        title: 'Regular fit',
        description: 'A familiar silhouette for teams, staff apparel and broad size collection. Approve the product-specific size chart before gathering sizes.',
      },
      {
        title: 'Boxy or oversized fit',
        description: 'A wider body and dropped-shoulder silhouette for relaxed, design-led merchandise. Do not substitute a regular-fit size split without checking measurements.',
      },
    ],
    useCasesHeading: 'Best suited for',
    useCasesIntroduction: 'The same base T-shirt can play different roles when fit, weight, artwork and packing are planned around the wearer.',
    useCases: [
      { title: 'Employee T-shirts', description: 'Team apparel, onboarding and internal programmes with a documented size split.' },
      { title: 'Events and conferences', description: 'Attendee, crew, volunteer and sponsor apparel planned backwards from a fixed date.' },
      { title: 'Restaurants and cafes', description: 'Casual staff apparel or customer merchandise with role, colour and repeat-order needs considered.' },
      { title: 'Artists and studios', description: 'Artwork-led merchandise using the garment weight and fit as part of the creative direction.' },
      { title: 'Gyms and clubs', description: 'Member, coach or community apparel selected for the intended setting and wash routine.' },
      { title: 'Branded retail drops', description: 'Focused collections where physical samples, fit approval and inventory planning matter.' },
    ],
    productSlugs: [
      'regular-fit-tee-200gsm',
      'boxy-fit-tee-200gsm',
      'regular-fit-tee-260gsm',
      'boxy-fit-tee-260gsm',
    ],
    sections: [
      {
        eyebrow: 'Budget',
        title: 'What affects bulk T-shirt pricing',
        introduction: 'A useful quote describes the same garment and production specification on every supplier comparison.',
        features: [
          { title: 'Garment and quantity', description: 'Fit, fabric weight and total units set the production base; volume tiers can change the unit price.' },
          { title: 'Artwork and positions', description: 'Physical print dimensions, number of positions, colour count and file preparation affect setup and production.' },
          { title: 'Print method', description: 'Screen Print, DTF and Reflective Print have different artwork, material and handling requirements.' },
          { title: 'Finishing and deadline', description: 'Labels, packaging, sampling, rush production and GST must be compared as separate requirements; shipping is free.' },
        ],
        links: [{ label: 'Estimate bulk T-shirt pricing', href: '/pricing' }],
      },
    ],
    stepsHeading: 'How a bulk T-shirt order works',
    stepsIntroduction: 'Keep product, artwork, sizes, commercial approval and the delivery requirement in one controlled specification.',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf', 'reflective-print'],
    faqs: [
      {
        question: 'What is the minimum order quantity for custom T-shirts?',
        answer: 'The minimum custom order is 50 pieces per style. Sizes can be split within that style using the available product size range.',
      },
      {
        question: 'Which T-shirt GSM should we choose?',
        answer: 'Choose 200 GSM for a lighter, versatile everyday garment and 260 GSM for a heavier, more structured feel. Fit, intended use, climate, artwork and budget should be reviewed together before approval.',
      },
      {
        question: 'Can we combine different sizes in one bulk order?',
        answer: 'Yes. A style can be allocated across its available sizes. Use the approved product-specific size chart and lock the final split before production.',
      },
      {
        question: 'Which printing method should we use?',
        answer: 'The recommendation depends on the artwork, colour count, print size, garment fabric and colour, quantity, desired hand feel and budget. Garmops reviews those details before production.',
      },
      {
        question: 'Can we add a custom neck label?',
        answer: 'Yes. The configurator supports custom neck-label choices. Label artwork, dimensions and construction still need production review and approval.',
      },
      {
        question: 'Can we order a sample before bulk production?',
        answer: 'Yes. Catalogue samples can be ordered to assess the base garment, and a paid pre-production sample can be requested when the complete customised result needs physical approval.',
      },
      {
        question: 'How is the final price calculated?',
        answer: 'The final price depends on the garment, quantity, artwork positions and dimensions, decoration method, colour count, labels, packaging, sampling, delivery speed, GST and shipping.',
      },
      {
        question: 'Do you deliver custom T-shirts across India?',
        answer: 'Garmops supports pan-India delivery. Shipping cost and delivery feasibility are confirmed against the order specification, destination and required-in-hand date.',
      },
    ],
    relatedGuides: [
      { label: 'Read the bulk T-shirt printing buyer’s guide', href: '/journal/bulk-custom-t-shirt-printing-india' },
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Understand 200 GSM and 260 GSM fabric weights', href: '/journal/fabric-weight-guide' },
    ],
    relatedPages: [
      { label: 'Custom polos for company and staff orders', href: '/custom-polo-t-shirts' },
      { label: 'Plan custom corporate merchandise', href: '/corporate-merchandise' },
      { label: 'Hospitality apparel and merchandise', href: '/industries/hospitality' },
    ],
    cta: {
      title: 'Ready to specify your custom T-shirts?',
      description: 'Choose the garment, colour, artwork positions, technique and size quantities, then submit the complete configuration for production review.',
      primary: { label: 'Start designing', href: '/configurator' },
      secondary: { label: 'Estimate your order', href: '/pricing' },
    },
  },
  customPoloTshirts: {
    slug: 'custom-polo-t-shirts',
    kind: 'product-category',
    breadcrumbLabel: 'Custom Polo T-Shirts',
    eyebrow: 'Company polos',
    title: 'Custom polo T-shirts for companies and teams',
    lead: 'Create structured custom polo T-shirts for employees, front-of-house staff, hospitality teams, clubs and events. Garmops offers a 280 GSM cotton-pique polo with Screen Print, DTF or Reflective Print, size selection and custom-branding options from 50 pieces.',
    seo: {
      title: 'Custom Polo T-Shirts for Companies India',
      description: 'Create custom polo T-shirts for companies, restaurants, hotels and teams. Add Screen Print, DTF or Reflective Print to 280 GSM cotton-pique polos from 50 pieces.',
      image: '/products/polo-tee.webp',
    },
    primaryKeyword: 'custom polo T-shirts for companies India',
    secondaryKeywords: ['corporate polo shirts', 'embroidered staff polos', 'company polo T-shirts with logo'],
    heroImage: '/products/polo-tee.webp',
    heroImageAlt: '280 GSM cotton-pique polo for a custom company apparel order',
    serviceType: 'Custom polo T-shirt production',
    audience: ['Companies', 'Restaurants and cafes', 'Hotels', 'Events', 'Clubs and studios', 'Sales teams'],
    trustPoints: [
      'MOQ 50 pieces per style',
      '280 GSM cotton pique',
      'Regular fit',
      'Print options',
      'GST invoicing',
      'Sizes XS to XXL',
    ],
    productHeading: 'The Garmops polo specification',
    productIntroduction: 'The construction, size range and sample price below are pulled from the live product catalogue so teams can compare a known base garment before branding.',
    featuresHeading: 'Why companies choose polo T-shirts',
    features: [
      { title: 'A structured team appearance', description: 'The collar and placket provide a more structured silhouette for customer-facing or mixed office-and-event settings.' },
      { title: 'Flexible logo placement', description: 'Compact chest or sleeve branding can create a consistent identity without turning the garment into a large-format graphic.' },
      { title: 'Useful across settings', description: 'One approved polo can work across office teams, exhibitions, hospitality, clubs and field teams where the use case is similar.' },
      { title: 'Repeatable specification', description: 'Document the garment, colour, artwork size, thread or ink reference and size chart to make later staff orders easier to compare.' },
    ],
    useCasesHeading: 'Where custom polos are used',
    useCases: [
      { title: 'Corporate teams', description: 'Employee apparel for office, visitor-facing and internal programme use.' },
      { title: 'Restaurants and cafes', description: 'Structured front-of-house apparel with role and replacement quantities planned.' },
      { title: 'Hotels and hospitality', description: 'Branded teamwear where garment colour, placement and repeatability are defined.' },
      { title: 'Exhibitions and events', description: 'Consistent apparel for representatives, hosts and event operations teams.' },
      { title: 'Clubs, gyms and studios', description: 'Coach, membership or community apparel with product-specific sizing.' },
      { title: 'Sales and field teams', description: 'A common team garment for customer visits and outdoor programmes where appropriate.' },
    ],
    productSlugs: ['polo-280gsm'],
    sections: [
      {
        title: 'Choosing a print technique for a company logo',
        introduction: 'Choose the method after reviewing the real artwork at its intended physical size.',
        features: [
          { title: 'Screen Print, DTF or Reflective Print', description: 'Choose around the artwork detail, finished size, garment fabric, quantity and desired result.' },
          { title: 'Screen or transfer printing', description: 'Useful for larger or more detailed artwork depending on the design, colour count and intended finish.' },
          { title: 'Technique approval', description: 'A digital mock-up shows placement; a physical sample or strike-off is the safer approval when colour or detail is critical.' },
        ],
        links: [{ label: 'See how custom pricing works', href: '/pricing' }],
      },
      {
        title: 'Logo placement and approvals',
        features: [
          { title: 'Left chest', description: 'A common position for a compact company mark. Confirm the width, height and distance from the collar or placket.' },
          { title: 'Sleeve or back', description: 'Additional positions may suit role, sponsor or event information, but each position changes the specification and quote.' },
          { title: 'Size collection', description: 'Share the approved polo size chart, collect responses against measurements and assign one owner to close missing entries.' },
        ],
      },
      {
        title: 'Pricing and production planning',
        features: [
          { title: 'Quote inputs', description: 'Confirm quantity, sizes, colour, logo files, physical artwork dimensions, positions, technique, sampling and destination.' },
          { title: 'Production sequence', description: 'Commercial approval and artwork approval come before sampling where needed, bulk production, checks, packing and delivery.' },
        ],
        links: [
          { label: 'Estimate company polo pricing', href: '/pricing' },
          { label: 'Start designing a custom polo order', href: '/configurator' },
        ],
      },
    ],
    stepsHeading: 'From polo brief to delivery',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf', 'reflective-print'],
    faqs: [
      { question: 'What is the minimum order for custom polo T-shirts?', answer: 'The minimum custom order is 50 pieces per style, split across the available XS to XXL size range.' },
      { question: 'What is the Garmops polo made from?', answer: 'The current catalogue polo is 280 GSM cotton pique with a regular fit, ribbed polo collar, button placket and preshrunk fabric.' },
      { question: 'Which print technique should we use for a company logo?', answer: 'Screen Print, DTF and Reflective Print suit different artwork, quantities and visual outcomes. The final recommendation depends on the artwork, position, fabric and desired result.' },
      { question: 'Can we place branding on the sleeve or back?', answer: 'Additional positions can be reviewed. Each position needs a physical dimension and visual approval and may change the final quote.' },
      { question: 'Can we order a polo sample first?', answer: 'Yes. The catalogue polo can be purchased as a sample. A paid pre-production sample can also be requested when the branded result needs physical approval.' },
      { question: 'How should we collect staff sizes?', answer: 'Use the approved polo measurement chart, ask wearers to compare it with a garment that fits and close the final size list before production.' },
    ],
    relatedGuides: [
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Use the corporate merchandise planning guide', href: '/journal/corporate-merchandise-india-planning-guide' },
      { label: 'Prepare a complete manufacturer brief', href: '/journal/how-to-brief-a-manufacturer' },
    ],
    relatedPages: [
      { label: 'Custom polos for employee programmes', href: '/corporate-merchandise' },
      { label: 'Polo shirts for hospitality teams', href: '/industries/hospitality' },
      { label: 'View the 280 GSM polo sample', href: '/products/polo-280gsm' },
    ],
    cta: {
      title: 'Build a clear company polo specification',
      description: 'Select the garment colour, add logo artwork and positions, allocate sizes and send the complete order for review.',
      primary: { label: 'Configure company polos', href: '/configurator' },
      secondary: { label: 'Order a polo sample', href: '/products/polo-280gsm' },
    },
  },
  customHoodies: {
    slug: 'custom-hoodies',
    kind: 'product-category',
    breadcrumbLabel: 'Custom Hoodies',
    eyebrow: 'Bulk hoodies',
    title: 'Custom hoodies in bulk for companies, teams and merchandise',
    lead: 'Create 320 GSM custom hoodies in a familiar regular fit for employee programmes, teams, events, clubs and merchandise collections. Add Screen Print, DTF, Reflective Print or custom labels and begin from 50 pieces per style.',
    seo: {
      title: 'Custom Hoodies in Bulk India | Company & Team Hoodies',
      description: 'Order custom 320 GSM regular-fit hoodies for companies, teams, events and merchandise. Screen Print, DTF, Reflective Print and labels from 50 pieces.',
      image: '/products/regular-fit-hoodie-320gsm.webp',
    },
    primaryKeyword: 'custom hoodies bulk India',
    secondaryKeywords: ['company hoodies with logo', 'embroidered employee hoodies', 'team hoodies'],
    heroImage: '/products/regular-fit-hoodie-320gsm.webp',
    heroImageAlt: '320 GSM regular-fit hoodie for a custom bulk merchandise order',
    serviceType: 'Bulk custom hoodie production',
    audience: ['Companies', 'Teams', 'Events', 'Studios', 'Clubs', 'Merchandise brands'],
    trustPoints: [
      'MOQ 50 pieces per style',
      '320 GSM fleece',
      'Regular fit',
      'Print options',
      'Custom neck-label choices',
      'Sizes XS to XXL',
    ],
    productHeading: 'The current hoodie base',
    productIntroduction: 'The current hoodie uses 320 GSM 80/20 cotton-poly fleece. Review the construction and fit before approving artwork or collecting sizes.',
    featuresHeading: 'Specify the hoodie base',
    features: [
      { title: 'Regular-fit hoodie', description: 'A familiar teamwear silhouette with kangaroo pocket, structured hood, drawcord and ribbed cuffs and hem.' },
      { title: '320 GSM fleece', description: 'A substantial brushed-fleece construction suited to cooler weather, air-conditioned settings and premium apparel programmes.' },
      { title: 'Product-specific sizing', description: 'Use the measurement chart for the selected hoodie before locking the size split.' },
    ],
    useCasesHeading: 'Common custom hoodie orders',
    useCases: [
      { title: 'Employee merchandise', description: 'Higher-value team apparel for onboarding, milestones and company programmes.' },
      { title: 'Winter teamwear', description: 'A warmer layer for teams, subject to the actual environment and wearer needs.' },
      { title: 'Studio merchandise', description: 'Design-led hoodies with artwork placements chosen around the final visual and wear context.' },
      { title: 'Event crews', description: 'Visible crew or operations apparel planned against a fixed event deadline.' },
      { title: 'Clubs and communities', description: 'Member apparel with a controlled colourway and size collection process.' },
      { title: 'Premium collections', description: 'Retail-style merchandise where fit, sample approval, labels and artwork finish matter.' },
    ],
    productSlugs: ['regular-fit-hoodie-320gsm'],
    sections: [
      {
        title: 'Print technique and artwork placement',
        features: [
          { title: 'Compact logo artwork', description: 'Plan the finished dimensions and placement so the mark remains clear at its intended viewing distance.' },
          { title: 'Printed graphics', description: 'Screen Print, DTF or Reflective Print can support different graphics depending on artwork, fabric, colour, quantity and desired finish.' },
          { title: 'Placement approval', description: 'Record the artwork dimensions and its distance from garment landmarks. A mock-up should not be the only reference for a critical placement.' },
        ],
      },
      {
        title: 'Bulk pricing, sizes and samples',
        features: [
          { title: 'Pricing basis', description: 'The hoodie, quantity, artwork positions, technique, colours, labels, sample needs, deadline, GST and shipping shape the final quote.' },
          { title: 'Size planning', description: 'Collect sizes against the regular-fit chart and keep a controlled contingency only where the order requires it.' },
          { title: 'Sample options', description: 'Order a catalogue sample to assess the blank, or request a paid pre-production sample when decoration or placement is critical.' },
        ],
        links: [
          { label: 'Estimate a custom hoodie order', href: '/pricing' },
          { label: 'Start designing a custom hoodie order', href: '/configurator' },
        ],
      },
    ],
    stepsHeading: 'How custom hoodie production works',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf', 'reflective-print'],
    faqs: [
      { question: 'What is the minimum order for custom hoodies?', answer: 'The minimum is 50 pieces per style, allocated across the available sizes for the selected hoodie.' },
      { question: 'What fabric does the Garmops hoodie use?', answer: 'The current hoodie uses 320 GSM 80/20 cotton-poly fleece with a brushed inner fleece.' },
      { question: 'Which print techniques are available for company hoodies?', answer: 'Garmops currently offers Screen Print, DTF and Reflective Print. Suitability depends on the artwork, placement, garment colour, quantity and desired finish.' },
      { question: 'Can we combine print techniques?', answer: 'Multiple artwork positions can be reviewed as one specification. Each position and technique affects approvals, sequencing, cost and production feasibility.' },
      { question: 'Can we order samples before a bulk hoodie run?', answer: 'Yes. Catalogue samples are available, and a paid pre-production sample can be requested for a customised hoodie.' },
    ],
    relatedGuides: [
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Plan company merchandise and employee sizes', href: '/journal/corporate-merchandise-india-planning-guide' },
      { label: 'Learn how to brief an apparel manufacturer', href: '/journal/how-to-brief-a-manufacturer' },
    ],
    relatedPages: [
      { label: 'Company hoodies and employee merchandise', href: '/corporate-merchandise' },
      { label: 'Custom event merchandise', href: '/industries/events' },
      { label: 'Browse all product samples', href: '/products' },
    ],
    cta: {
      title: 'Turn your hoodie brief into a production specification',
      description: 'Choose the fit and colour, place artwork, select a technique and allocate sizes before Garmops reviews feasibility.',
      primary: { label: 'Design custom hoodies', href: '/configurator' },
      secondary: { label: 'Compare hoodie samples', href: '/products' },
    },
  },
  customToteBags: {
    slug: 'custom-tote-bags',
    kind: 'product-category',
    breadcrumbLabel: 'Custom Tote Bags',
    eyebrow: 'Canvas totes',
    title: 'Custom canvas tote bags in bulk',
    lead: 'Create custom printed canvas tote bags for companies, events, cafes, studios and merchandise collections. The current Garmops tote uses durable 12 oz natural canvas with reinforced handles and a gusset base and is available from 50 pieces.',
    seo: {
      title: 'Custom Tote Bags in Bulk India | Printed Canvas Totes',
      description: 'Create custom printed canvas tote bags for companies, events, cafes, studios and merchandise collections. Durable 12 oz totes from 50 pieces.',
      image: '/products/canvas-tote-bag.webp',
    },
    primaryKeyword: 'custom tote bags bulk India',
    secondaryKeywords: ['printed canvas tote bags', 'branded tote bags for events', 'company tote bags'],
    heroImage: '/products/canvas-tote-bag.webp',
    heroImageAlt: '12 oz canvas tote bag for a custom bulk merchandise order',
    serviceType: 'Bulk custom canvas tote-bag printing',
    audience: ['Companies', 'Events', 'Cafes and restaurants', 'Studios', 'Merchandise brands'],
    trustPoints: [
      'MOQ 50 pieces per style',
      '12 oz natural canvas',
      'Reinforced 24-inch handles',
      'Gusset base',
      '38 cm × 42 cm body',
      'One size',
    ],
    productHeading: 'The Garmops canvas tote',
    productIntroduction: 'Review the live product specification, care guidance and sample price before approving artwork or committing to a bulk run.',
    featuresHeading: 'Plan a useful branded tote',
    features: [
      { title: 'Known base construction', description: 'The catalogue tote uses 12 oz natural canvas, reinforced 24-inch handles, a gusset base and a 38 cm × 42 cm body.' },
      { title: 'No size collection', description: 'A one-size product can simplify event or company distribution, while artwork, quantities and packing still need approval.' },
      { title: 'Print-led surface', description: 'Bold logos and illustrations can work well when the artwork is prepared for the canvas texture and approved at a physical size.' },
      { title: 'Practical care', description: 'The current care guidance is hand wash, air dry, do not machine wash and iron on low. Share care information with recipients where relevant.' },
    ],
    useCasesHeading: 'Where custom tote bags are used',
    useCases: [
      { title: 'Company programmes', description: 'A size-free branded item for onboarding, meetings or apparel-led employee kits.' },
      { title: 'Conferences and events', description: 'Attendee, speaker or sponsor merchandise planned with the distribution format and print deadline.' },
      { title: 'Cafes and restaurants', description: 'Customer merchandise or a retail companion to a focused apparel range.' },
      { title: 'Studios and artists', description: 'Artwork-led merchandise in a practical canvas format.' },
      { title: 'Retail collections', description: 'A controlled product for small merchandise drops and reorders.' },
    ],
    productSlugs: ['canvas-tote-bag'],
    sections: [
      {
        title: 'Artwork, print area and approval',
        features: [
          { title: 'Artwork format', description: 'Original vector artwork is preferred for logos and flat graphics. High-resolution raster files can proceed to review when appropriate.' },
          { title: 'Physical print size', description: 'Specify the intended width and height, side of the tote, number of colours and distance from seams or edges.' },
          { title: 'Canvas texture', description: 'The physical weave influences fine detail and ink coverage, so use a sample or strike-off when the result is brand-critical.' },
        ],
      },
      {
        title: 'Ordering and pricing factors',
        features: [
          { title: 'Production inputs', description: 'Quantity, artwork positions, colour count, technique, file preparation, sample needs, packing and deadline all affect the order.' },
          { title: 'Commercial treatment', description: 'GST is identified separately from the base product estimate; shipping is free.' },
        ],
        links: [
          { label: 'Estimate a branded tote order', href: '/pricing' },
          { label: 'Start designing a custom tote order', href: '/configurator' },
        ],
      },
    ],
    stepsHeading: 'How a custom tote order works',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf'],
    faqs: [
      { question: 'What is the minimum order for custom tote bags?', answer: 'The minimum custom order is 50 pieces per style.' },
      { question: 'What is the current tote specification?', answer: 'The current product uses 12 oz (340 GSM) natural canvas, reinforced 24-inch handles, a gusset base and a 38 cm × 42 cm body.' },
      { question: 'Which artwork files should we provide?', answer: 'Original vector AI, EPS, PDF or SVG artwork is preferred for logos and flat graphics. High-resolution raster artwork can be reviewed at its intended print size.' },
      { question: 'Can artwork be printed on both sides?', answer: 'Additional positions can be reviewed. Each side needs separate dimensions and approval and will affect the production specification and price.' },
      { question: 'How should the canvas tote be cared for?', answer: 'The current catalogue guidance is hand wash, air dry, do not machine wash and iron on low.' },
      { question: 'Can we order one tote as a sample?', answer: 'Yes. The catalogue tote can be ordered as a sample before a bulk custom requirement is approved.' },
    ],
    relatedGuides: [
      { label: 'Prepare production-ready artwork and a complete brief', href: '/journal/how-to-brief-a-manufacturer' },
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Plan cafe and restaurant merchandise', href: '/journal/cafe-merch-guide' },
    ],
    relatedPages: [
      { label: 'Corporate merchandise and employee apparel', href: '/corporate-merchandise' },
      { label: 'Custom event merchandise', href: '/industries/events' },
      { label: 'Hospitality apparel and cafe merchandise', href: '/industries/hospitality' },
    ],
    cta: {
      title: 'Build a print-ready tote specification',
      description: 'Choose the tote, upload artwork, define the print size and quantity and submit the configuration for review.',
      primary: { label: 'Design branded tote bags', href: '/configurator' },
      secondary: { label: 'Order a tote sample', href: '/products/canvas-tote-bag' },
    },
  },
  corporateMerchandise: {
    slug: 'corporate-merchandise',
    kind: 'solution',
    breadcrumbLabel: 'Corporate Merchandise',
    eyebrow: 'For company teams',
    title: 'Custom corporate merchandise and employee apparel',
    lead: 'Garmops helps HR, Operations, Administration, Procurement and Marketing teams plan branded apparel for employees, onboarding, events, off-sites and company programmes. Select the garment, collect sizes, approve artwork and track a defined production specification from 50 pieces.',
    seo: {
      title: 'Custom Corporate Merchandise & Employee Apparel India',
      description: 'Plan company T-shirts, polos, hoodies, sweatshirts and totes for employees, onboarding and events. Bulk custom apparel from 50 pieces.',
      image: '/industries/companies-startups.webp',
    },
    primaryKeyword: 'custom merchandise for companies India',
    secondaryKeywords: ['employee merchandise', 'onboarding apparel', 'company T-shirts', 'employee hoodies'],
    heroImage: '/industries/companies-startups.webp',
    heroImageAlt: 'Custom employee apparel and corporate merchandise for company teams',
    serviceType: 'Custom corporate merchandise and employee apparel',
    audience: ['Human Resources teams', 'Operations teams', 'Administration teams', 'Procurement teams', 'Marketing teams', 'Founders'],
    trustPoints: [
      'MOQ 50 pieces per style',
      'GST-compliant invoicing',
      'Full-payment GST invoicing supported',
      'Product samples available',
      standardTimeline,
      rushTimeline,
    ],
    productHeading: 'Build a focused company apparel range',
    productIntroduction: 'Choose the smallest useful set of products for the objective. Current specifications and prices are sourced from the Garmops catalogue.',
    featuresHeading: 'Corporate merchandise use cases',
    features: [
      { title: 'Employee onboarding', description: 'A documented apparel specification for new-joiner programmes, with sizes, replacements and repeat orders considered.' },
      { title: 'Team apparel', description: 'T-shirts, polos, sweatshirts or hoodies selected for the actual work setting and wearer group.' },
      { title: 'Annual meets and off-sites', description: 'Event-linked apparel planned backwards from the must-arrive date, including internal approval and distribution.' },
      { title: 'Conferences and exhibitions', description: 'Representative, crew or attendee apparel with logo positions and sponsor requirements controlled.' },
      { title: 'Employee recognition', description: 'A premium garment can mark milestones when fit, decoration and presentation are aligned to the programme.' },
      { title: 'Sales and field teams', description: 'Repeatable branded apparel with clear size and replacement records.' },
    ],
    useCasesHeading: 'A workflow for HR, Operations and Procurement',
    useCases: [
      { title: 'Define the objective', description: 'Record recipients, intended use, quantity, budget and the must-arrive date.' },
      { title: 'Choose the product', description: 'Compare garment, fit, GSM, physical samples and decoration compatibility.' },
      { title: 'Collect sizes and artwork', description: 'Use the product-specific chart and approved brand source files, with one internal owner.' },
      { title: 'Approve the specification', description: 'Review the configuration or approval PDF, final sizes, artwork positions, delivery details and commercial terms.' },
      { title: 'Sample where needed', description: 'Use a catalogue or pre-production sample when fit, colour, placement or finish carries material risk.' },
      { title: 'Produce and deliver', description: 'Begin bulk production after approval, then complete checks, counting, packing and dispatch.' },
    ],
    productSlugs: [
      'regular-fit-tee-200gsm',
      'boxy-fit-tee-260gsm',
      'polo-280gsm',
      'regular-fit-hoodie-320gsm',
      'regular-fit-sweatshirt-320gsm',
      'canvas-tote-bag',
    ],
    sections: [
      {
        title: 'Procurement information to confirm',
        features: [
          { title: 'MOQ and price basis', description: 'The minimum is 50 pieces per style. Compare garment, quantity, decoration, labels, samples, deadline, GST and shipping on like-for-like specifications.' },
          { title: 'Commercial documents', description: 'GST-compliant invoices are generated after verified full payment. Shipping is free.' },
          { title: 'Artwork and approvals', description: 'Provide source artwork, physical dimensions, positions, colour references, an approver and an approval deadline.' },
          { title: 'Timeline and shipping', description: `The standard delivery target is ${DELIVERY_DAYS} days from confirmation. A ${RUSH_DELIVERY_DAYS}-day rush target is subject to order and destination feasibility. Shipping is free.` },
        ],
        links: [
          { label: 'Estimate a company apparel order', href: '/pricing' },
          { label: 'Send a formal requirement', href: '/contact' },
        ],
      },
      {
        title: 'Why the configurator helps internal approval',
        features: [
          { title: 'Visual product specification', description: 'Record the selected garment and colour with artwork positions and physical dimensions.' },
          { title: 'Decoration and labels', description: 'Capture a selected or recommended technique and supported custom neck-label choices.' },
          { title: 'Size quantities', description: 'Allocate units across the available product sizes and keep the approved split with the order.' },
          { title: 'Approval PDF', description: 'The current configurator can create a dated configuration and approval snapshot; final pricing and feasibility still require Garmops review.' },
        ],
      },
      {
        title: 'Common planning risks',
        features: [
          { title: 'Late size collection', description: 'Set an internal deadline and owner before production must be confirmed.' },
          { title: 'Unclear artwork versions', description: 'Use named source files and one approved visual for every position and colourway.' },
          { title: 'Approval delay', description: 'Identify the commercial and creative approvers and include their response time in the schedule.' },
          { title: 'Unlike quote comparisons', description: 'Do not compare prices that use different fabric weights, fits, decoration sizes or included services.' },
          { title: 'No contingency plan', description: 'Consider controlled buffer pieces for new joiners, exchanges or event use without guessing an arbitrary percentage.' },
        ],
      },
    ],
    stepsHeading: 'A controlled company-order sequence',
    steps: orderingSteps,
    proofIndustries: [],
    faqs: [
      { question: 'What is the minimum corporate merchandise order?', answer: 'The minimum is 50 pieces per style. A mixed programme may contain several styles, with each style meeting its applicable minimum.' },
      { question: 'Which products can a company customise?', answer: 'The current catalogue includes regular and heavyweight T-shirts, polos, hoodies, sweatshirts, long-sleeve tees and canvas tote bags.' },
      { question: 'Does Garmops provide GST invoices?', answer: 'Yes. Garmops generates GST-compliant invoices with HSN codes after verified full payment. Shipping is free.' },
      { question: 'Can employees choose different sizes?', answer: 'Yes. Allocate the quantity across the available sizes for the selected product, using its approved measurement chart.' },
      { question: 'Can we approve a sample before production?', answer: 'Yes. Catalogue samples can help compare base garments, and paid pre-production samples are available when the complete branded result requires physical approval.' },
      { question: 'How long should a company allow?', answer: `The current standard delivery target is ${DELIVERY_DAYS} days from order confirmation. A ${RUSH_DELIVERY_DAYS}-day rush option is subject to feasibility. Internal sizing, artwork and approval time must be planned before confirmation.` },
    ],
    relatedGuides: [
      { label: 'Read the corporate merchandise planning guide', href: '/journal/corporate-merchandise-india-planning-guide' },
      { label: 'Learn how to brief an apparel manufacturer', href: '/journal/how-to-brief-a-manufacturer' },
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Plan a bulk custom T-shirt order', href: '/journal/bulk-custom-t-shirt-printing-india' },
    ],
    relatedPages: [
      { label: 'Bulk custom T-shirt production', href: '/custom-t-shirt-printing' },
      { label: 'Custom company polo T-shirts', href: '/custom-polo-t-shirts' },
      { label: 'Custom hoodies for employee programmes', href: '/custom-hoodies' },
    ],
    cta: {
      title: 'Prepare one clear company-order specification',
      description: 'Bring product, artwork, sizes, commercial inputs and the required date together before the order goes for approval.',
      primary: { label: 'Build a company order', href: '/configurator' },
      secondary: { label: 'Discuss a corporate requirement', href: '/contact' },
    },
  },
  hospitality: {
    slug: 'industries/hospitality',
    kind: 'industry',
    breadcrumbLabel: 'Hospitality Apparel',
    eyebrow: 'Hospitality',
    title: 'Custom restaurant uniforms and hospitality merchandise',
    lead: 'Create consistent branded apparel for restaurant, cafe and hospitality teams, or develop merchandise that customers can purchase and use. Garmops supports custom T-shirts, structured polos, hoodies, sweatshirts and canvas totes from 50 pieces.',
    seo: {
      title: 'Restaurant Staff Uniforms & Cafe Merchandise India',
      description: 'Create branded T-shirts, polos, sweatshirts, hoodies and totes for restaurants, cafes, hotels and hospitality teams from 50 pieces.',
      image: '/industries/hotels-restaurants.webp',
    },
    primaryKeyword: 'restaurant staff uniforms India',
    secondaryKeywords: ['restaurant T-shirts with logo', 'cafe merchandise', 'hospitality polo shirts'],
    heroImage: '/industries/hotels-restaurants.webp',
    heroImageAlt: 'Custom restaurant staff uniforms and hospitality merchandise in India',
    serviceType: 'Custom restaurant uniforms and hospitality merchandise',
    audience: ['Restaurants', 'Cafes', 'Hotels', 'Hospitality groups', 'Food and beverage brands'],
    trustPoints: [
      'MOQ 50 pieces per style',
      'Staff apparel and retail merchandise',
      'T-shirts, polos and layers',
      'Canvas tote bags',
      'Print options',
      'Product samples available',
    ],
    productHeading: 'Products for hospitality teams and customers',
    productIntroduction: 'Staff apparel and retail merchandise can use different garments, fits and branding. Treat each as its own product specification.',
    featuresHeading: 'Staff apparel and retail merchandise serve different jobs',
    features: [
      { title: 'Operational staff apparel', description: 'Plan by role, wearer, shift, replacement need and repeat-order documentation. Consistency and clear sizing are central.' },
      { title: 'Customer merchandise', description: 'Plan around design, silhouette, price point, display and sell-through. A retail product should stand on its own beyond the venue.' },
      { title: 'Different fit decisions', description: 'A structured regular-fit polo may suit front-of-house use, while a heavyweight or boxy tee may better suit a retail collection.' },
      { title: 'Different decoration decisions', description: 'Compact embroidered staff branding and larger customer-facing artwork can require different production methods and approvals.' },
    ],
    useCasesHeading: 'Recommended hospitality product routes',
    useCases: [
      { title: 'Polos for front of house', description: 'A structured option for customer-facing teams, with compact logo placement and role quantities documented.' },
      { title: 'T-shirts for casual teams', description: 'Useful for casual service, events and merchandise where the garment is appropriate to the operating environment.' },
      { title: 'Hoodies and sweatshirts', description: 'Team layers for cooler environments or premium customer merchandise.' },
      { title: 'Canvas totes', description: 'One-size branded merchandise for retail, events or an apparel collection.' },
    ],
    productSlugs: [
      'polo-280gsm',
      'regular-fit-tee-200gsm',
      'boxy-fit-tee-260gsm',
      'regular-fit-sweatshirt-320gsm',
      'regular-fit-hoodie-320gsm',
      'canvas-tote-bag',
    ],
    sections: [
      {
        title: 'Branding choices for hospitality apparel',
        features: [
          { title: 'Logo position', description: 'Define chest, sleeve or back artwork with physical dimensions and an approved visual.' },
          { title: 'Role identifiers', description: 'If a role name is required, control spelling, hierarchy, placement and quantities by role before production.' },
          { title: 'Print technique', description: 'Choose Screen Print, DTF or Reflective Print around artwork detail, garment fabric, intended size, wear context and desired finish.' },
          { title: 'Garment colour', description: 'Review brand contrast and likely operating conditions, including how visible marks or stains may be, without treating one colour as universally correct.' },
        ],
      },
      {
        title: 'Operational planning for restaurant and hotel teams',
        features: [
          { title: 'Role and shift quantities', description: 'Count wearers by role and consider rotation across shifts before locking the total.' },
          { title: 'Size collection', description: 'Use the approved chart for each garment rather than a single generic uniform size list.' },
          { title: 'Replacement and new joiners', description: 'Set a controlled buffer and keep a record of the approved product, artwork and sizes for later needs.' },
          { title: 'Repeat-order documentation', description: 'Retain artwork, physical dimensions, colour references, supplier specification and a physical reference where useful.' },
        ],
      },
      {
        title: 'Cafe and restaurant merchandise',
        features: [
          { title: 'Wearable brand extension', description: 'Use distinctive venue graphics, typography or illustration to make the product useful beyond the premises.' },
          { title: 'Focused seasonal drops', description: 'Start with a controlled product and colour range, then use real sales data to guide reorders.' },
          { title: 'Event merchandise', description: 'Tie quantities, artwork freeze and packing to the date on which merchandise must arrive.' },
        ],
      },
    ],
    stepsHeading: 'From hospitality brief to repeatable order',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf', 'reflective-print'],
    proofIndustries: ['Hotels & Restaurants'],
    faqs: [
      { question: 'What is the minimum order for restaurant staff apparel?', answer: 'The minimum custom order is 50 pieces per style, with sizes split within the range for that product.' },
      { question: 'Should restaurant staff use polos or T-shirts?', answer: 'Polos provide a more structured silhouette; T-shirts can suit casual teams, events and merchandise. Choose around the role, venue, wearer comfort, branding and approved sample.' },
      { question: 'Can staff uniforms and customer merchandise be ordered together?', answer: 'They can be planned in one programme, but each garment style must meet its applicable minimum and should have its own sizing, artwork and approval specification.' },
      { question: 'Can staff roles be added to the garment?', answer: 'Role identifiers can be reviewed as artwork. Confirm exact wording, position, dimensions and quantities by role before approval.' },
      { question: 'How should a restaurant plan replacement stock?', answer: 'Use the current wearer and shift list, likely replacement needs and new-joiner plan. Keep the buffer controlled and retain the approved specification for repeat orders.' },
      { question: 'Can we order product samples?', answer: 'Yes. Catalogue samples are available, and a paid pre-production sample can be requested for a customised staff or merchandise product.' },
    ],
    relatedGuides: [
      { label: 'Read the cafe and restaurant merchandise guide', href: '/journal/cafe-merch-guide' },
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Prepare a complete hospitality apparel brief', href: '/journal/how-to-brief-a-manufacturer' },
    ],
    relatedPages: [
      { label: 'Custom polo T-shirts for hospitality teams', href: '/custom-polo-t-shirts' },
      { label: 'Bulk custom T-shirt printing', href: '/custom-t-shirt-printing' },
      { label: 'Custom canvas tote bags', href: '/custom-tote-bags' },
    ],
    cta: {
      title: 'Define apparel for the role and the brand',
      description: 'Choose staff or merchandise products, document sizes and artwork and send the delivery requirement for production review.',
      primary: { label: 'Design hospitality apparel', href: '/configurator' },
      secondary: { label: 'Discuss staff requirements', href: '/contact' },
    },
  },
  events: {
    slug: 'industries/events',
    kind: 'industry',
    breadcrumbLabel: 'Event Merchandise',
    eyebrow: 'Events and artists',
    title: 'Custom event merchandise and bulk event apparel',
    lead: 'Plan branded apparel for conferences, festivals, launches, tours, artist collections and live events. Choose the garment, artwork, decoration method, size quantities and delivery requirement in one production specification from 50 pieces.',
    seo: {
      title: 'Event Merchandise Manufacturer India | Bulk Event Apparel',
      description: 'Plan custom T-shirts, hoodies, sweatshirts and totes for conferences, festivals, launches and artist merchandise from 50 pieces.',
      image: '/industries/music-events.webp',
    },
    primaryKeyword: 'event merchandise manufacturer India',
    secondaryKeywords: ['event T-shirt printing', 'festival merchandise', 'conference T-shirts', 'artist merchandise'],
    heroImage: '/industries/music-events.webp',
    heroImageAlt: 'Custom event merchandise and artist apparel produced in India',
    serviceType: 'Custom event merchandise and bulk event apparel',
    audience: ['Conference teams', 'Festival teams', 'Event agencies', 'Artists and managers', 'Brand launch teams', 'Event sponsors'],
    trustPoints: [
      'MOQ 50 pieces per style',
      'Attendee, crew and retail apparel',
      'T-shirts, layers and totes',
      'Print options',
      'Artwork review',
      'Deadline feasibility review',
    ],
    productHeading: 'Choose products around the event job',
    productIntroduction: 'Attendee giveaways, crew apparel and artist retail merchandise have different budget, fit, decoration and distribution requirements.',
    featuresHeading: 'Event merchandise use cases',
    features: [
      { title: 'Attendee T-shirts', description: 'A size-dependent event item that requires a quantity and distribution plan when wearer data is incomplete.' },
      { title: 'Crew and volunteer apparel', description: 'Role-visible garments planned from a named list, size chart and operational requirement.' },
      { title: 'Speaker or partner merchandise', description: 'A controlled product for a defined recipient list, with branding and packing approved early.' },
      { title: 'Festival or artist retail', description: 'Design-led merchandise where garment fit, sample approval, retail price and sell-through matter.' },
      { title: 'Sponsor-branded apparel', description: 'Artwork with multiple marks, hierarchy, minimum reproduction sizes and a firm approval owner.' },
      { title: 'Conference tote bags', description: 'A one-size product that can support event distribution without replacing an apparel-size plan.' },
    ],
    useCasesHeading: 'Plan the event timeline backwards',
    useCases: [
      { title: 'Event and must-arrive date', description: 'Start from when cartons must be at the venue or distribution point, not the factory dispatch date.' },
      { title: 'Internal approval deadline', description: 'Allow time for organisers, sponsors, artists and legal or brand stakeholders to review.' },
      { title: 'Artwork freeze', description: 'Lock final files, sponsor marks, positions, dimensions and colour references before production confirmation.' },
      { title: 'Sample decision', description: 'Decide early whether a catalogue sample, strike-off or full pre-production sample is required.' },
      { title: 'Production and packing', description: 'Reserve time for bulk production, in-process checks, final counting and any verified packing requirement.' },
      { title: 'Shipping buffer', description: 'Allow for destination and transit risk. Rush feasibility must be reviewed against the complete order.' },
    ],
    productSlugs: [
      'regular-fit-tee-200gsm',
      'boxy-fit-tee-260gsm',
      'regular-fit-hoodie-320gsm',
      'regular-fit-sweatshirt-320gsm',
      'polo-280gsm',
      'canvas-tote-bag',
    ],
    sections: [
      {
        title: 'Artwork for sponsors, artists and event teams',
        features: [
          { title: 'Multiple logos', description: 'Keep original files, hierarchy, minimum sizes and approval responsibility clear for every sponsor or partner mark.' },
          { title: 'Front and back positions', description: 'Specify each position with physical dimensions, garment colour and an approved visual.' },
          { title: 'Colour count and technique', description: 'Screen Print, DTF and Reflective Print respond differently to artwork detail, colours, fabric and quantity.' },
          { title: 'File readiness', description: 'Vector artwork is preferred where required. Other files can proceed to review, but production readiness must be confirmed before approval.' },
        ],
      },
      {
        title: 'Size and quantity planning',
        features: [
          { title: 'Known crew or attendee lists', description: 'Collect sizes using the exact product chart and close missing entries before production.' },
          { title: 'Unknown audience demand', description: 'Use prior event or sales data where available and keep a controlled contingency rather than a universal size percentage.' },
          { title: 'Product-specific charts', description: 'Do not reuse a regular-fit allocation for a boxy tee, polo or hoodie without checking the measurements.' },
        ],
      },
      {
        title: 'Packing and distribution requirements',
        introduction: 'Ask for operational needs at quote stage so feasibility and cost can be confirmed rather than assumed.',
        features: [
          { title: 'Size identification', description: 'State whether cartons or pieces need size labels and how the event team will distribute them.' },
          { title: 'Individual packing', description: 'Discuss individual packing before approval; it should not be assumed to be included.' },
          { title: 'Multiple delivery points', description: 'Provide every destination, unit allocation and required date for shipping review.' },
        ],
      },
    ],
    stepsHeading: 'A deadline-led event order sequence',
    steps: orderingSteps,
    techniqueKeys: ['screen-printing', 'dtf', 'reflective-print'],
    proofIndustries: ['Music & Events'],
    faqs: [
      { question: 'What is the minimum order for event merchandise?', answer: 'The minimum custom order is 50 pieces per style. Each garment or tote style in a mixed event range should be planned against its applicable minimum.' },
      { question: 'How early should we start an event apparel order?', answer: `The current standard delivery target is ${DELIVERY_DAYS} days from order confirmation, but artwork, sponsor approval, size collection, sampling and transit need time before and around production. Start from the must-arrive date and work backwards.` },
      { question: 'Is rush event production guaranteed?', answer: `No. The current ${RUSH_DELIVERY_DAYS}-day rush target is available only where the order specification, artwork, quantity, production method and destination are feasible.` },
      { question: 'Can non-vector artwork be uploaded?', answer: 'The configurator can accept artwork for review, but production readiness must be confirmed. Some techniques usually require vector artwork or file preparation before final approval.' },
      { question: 'How should we estimate event T-shirt sizes?', answer: 'Use a named attendee or crew list where possible and prior event data where it is not. Keep a controlled buffer and use the selected product’s own measurement chart.' },
      { question: 'Can individual packing or multi-location shipping be arranged?', answer: 'Discuss these needs at quote stage. Packing format, size labelling and multiple destinations require feasibility and price confirmation.' },
    ],
    relatedGuides: [
      { label: 'Plan a bulk event T-shirt order', href: '/journal/bulk-custom-t-shirt-printing-india' },
      { label: 'See how custom pricing works', href: '/pricing' },
      { label: 'Prepare a complete event merchandise brief', href: '/journal/how-to-brief-a-manufacturer' },
    ],
    relatedPages: [
      { label: 'Bulk custom event T-shirts', href: '/custom-t-shirt-printing' },
      { label: 'Custom hoodies for crews and merchandise', href: '/custom-hoodies' },
      { label: 'Conference and event tote bags', href: '/custom-tote-bags' },
    ],
    cta: {
      title: 'Put the event date inside the production brief',
      description: 'Share products, artwork, sizes, sponsor approvals, packing needs and the must-arrive date so feasibility can be reviewed.',
      primary: { label: 'Configure event merchandise', href: '/configurator' },
      secondary: { label: 'Discuss an event deadline', href: '/contact' },
    },
  },
} satisfies Record<string, SeoLandingPageContent>

export type LandingPageKey = keyof typeof landingPages

export const allLandingPages = Object.values(landingPages)

export function landingPageByPath(pathname: string): SeoLandingPageContent | undefined {
  const normalized = pathname.replace(/^\/|\/$/g, '')
  return allLandingPages.find(page => page.slug === normalized)
}
