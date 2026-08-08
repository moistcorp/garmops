export type IndustryHubCard = {
  id: string
  name: string
  description: string
  image: string
  alt: string
  for: string[]
  popularProducts: string[]
  href?: string
  contactHref?: string
}

export type IndustryUseCase = {
  title: string
  description: string
  productSlugs: string[]
}

export type IndustryProductRecommendation = {
  slug: string
  reason: string
}

export type IndustryPlanningNote = {
  title: string
  description: string
}

export type IndustryFaq = {
  question: string
  answer: string
}

export type IndustryPageContent = {
  slug: string
  breadcrumbLabel: string
  eyebrow: string
  title: string
  lead: string
  seo: {
    title: string
    description: string
    image: string
  }
  heroImage: string
  heroImageAlt: string
  serviceType: string
  audience: string[]
  trustPoints: string[]
  useCases: IndustryUseCase[]
  recommendations: IndustryProductRecommendation[]
  proofIndustries?: string[]
  printIntro: string
  printNotes: Partial<Record<'screen-printing' | 'dtf' | 'reflective-print', string>>
  planningTitle: string
  planningIntroduction: string
  planningNotes: IndustryPlanningNote[]
  faqs: IndustryFaq[]
  relatedLinks: Array<{ label: string; href: string }>
  cta: {
    title: string
    description: string
    primary: { label: string; href: string }
    secondary?: { label: string; href: string }
  }
}

export const industryHubCards: IndustryHubCard[] = [
  {
    id: 'companies-teams',
    name: 'Companies & Teams',
    description: 'Branded apparel for everyday teams, onboarding, off-sites, employee programmes and company merchandise.',
    image: '/industries/companies-startups.webp',
    alt: 'Branded apparel and merchandise for company teams',
    for: ['Employee apparel', 'Onboarding', 'Off-sites', 'Company events'],
    popularProducts: ['Classic T-Shirt', 'Polo T-Shirt', 'Classic Hoodie'],
    href: '/corporate-merchandise',
  },
  {
    id: 'cafes-hospitality',
    name: 'Cafés & Hospitality',
    description: 'Staff apparel and merchandise for cafés, restaurants, hotels and customer-facing hospitality teams.',
    image: '/industries/hotels-restaurants.webp',
    alt: 'Branded apparel for cafes restaurants and hospitality teams',
    for: ['Staff apparel', 'Customer-facing teams', 'Café merch', 'Retail totes'],
    popularProducts: ['Classic T-Shirt', 'Polo T-Shirt', 'Canvas Tote Bag'],
    href: '/industries/hospitality',
  },
  {
    id: 'events-entertainment',
    name: 'Events & Entertainment',
    description: 'Merchandise for crews, attendees, artists, festivals, launches, conferences and live experiences.',
    image: '/industries/music-events.webp',
    alt: 'Custom merchandise for events festivals and entertainment',
    for: ['Crew apparel', 'Attendee merch', 'Artist drops', 'Conference kits'],
    popularProducts: ['Classic T-Shirt', 'Premium Oversized T-Shirt', 'Canvas Tote Bag'],
    href: '/industries/events',
  },
  {
    id: 'sports-fitness',
    name: 'Sports & Fitness',
    description: 'Branded apparel for gyms, clubs, studio communities, coaches and member merchandise.',
    image: '/industries/sports-fitness.webp',
    alt: 'Branded apparel for sports fitness gyms and clubs',
    for: ['Gym teams', 'Club apparel', 'Member merch', 'Community events'],
    popularProducts: ['Classic T-Shirt', 'Premium T-Shirt', 'Classic Hoodie'],
    contactHref: '/contact?industry=sports-fitness',
  },
  {
    id: 'creative-teams',
    name: 'Creative Teams',
    description: 'Design-led merchandise for agencies, studios and production teams that want the garment to feel considered too.',
    image: '/industries/creative-studios.webp',
    alt: 'Design led merchandise for creative studios and agencies',
    for: ['Studio merch', 'Team apparel', 'Client gifting', 'Limited drops'],
    popularProducts: ['Premium Oversized T-Shirt', 'Classic Hoodie', 'Canvas Tote Bag'],
    contactHref: '/contact?industry=creative-teams',
  },
  {
    id: 'arts-culture',
    name: 'Arts & Culture',
    description: 'Merchandise for exhibitions, cultural organisations, artists, museums and curated retail programmes.',
    image: '/industries/arts-culture.webp',
    alt: 'Custom merchandise for arts culture exhibitions and artists',
    for: ['Exhibitions', 'Artist merch', 'Institutional retail', 'Cultural events'],
    popularProducts: ['Premium T-Shirt', 'Premium Oversized T-Shirt', 'Canvas Tote Bag'],
    contactHref: '/contact?industry=arts-culture',
  },
]

const sharedTrustPoints = [
  'From 50 pieces per style',
  'Product samples available',
  'Split quantities across available sizes',
  'Artwork reviewed before production',
  'GST invoice',
  'Order status visible after checkout',
]

export const industryPages = {
  companies: {
    slug: 'corporate-merchandise',
    breadcrumbLabel: 'Companies & Teams',
    eyebrow: 'Companies & Teams',
    title: 'Branded apparel for your team.',
    lead: 'Build company T-shirts, polos, hoodies and merchandise for everyday teams, onboarding, off-sites, employee programmes and company events. Start with the use case, then choose the garment that fits it.',
    seo: {
      title: 'Corporate Merchandise & Employee Apparel India | Garmops',
      description: 'Choose branded T-shirts, polos, hoodies and merchandise for employee apparel, onboarding, off-sites and company events from 50 pieces per style.',
      image: '/industries/companies-startups.webp',
    },
    heroImage: '/industries/companies-startups.webp',
    heroImageAlt: 'Branded apparel and merchandise for company teams',
    serviceType: 'Branded company apparel and employee merchandise',
    audience: ['Company teams', 'HR teams', 'Operations teams', 'Marketing teams', 'Founders'],
    trustPoints: sharedTrustPoints,
    useCases: [
      {
        title: 'Everyday team apparel',
        description: 'A simple branded uniform for regular office, field, café-style or event use where comfort and easy sizing matter.',
        productSlugs: ['regular-fit-tee-200gsm', 'polo-280gsm'],
      },
      {
        title: 'New-joiner kits',
        description: 'Build a useful onboarding set with one wearable garment and an optional one-size merchandise piece.',
        productSlugs: ['regular-fit-tee-200gsm', 'regular-fit-hoodie-320gsm', 'canvas-tote-bag'],
      },
      {
        title: 'Off-sites & company events',
        description: 'Choose a garment the whole group can recognise and wear comfortably through an event or team programme.',
        productSlugs: ['regular-fit-tee-200gsm', 'regular-fit-hoodie-320gsm'],
      },
      {
        title: 'Premium employee merch',
        description: 'Use a heavier or more fashion-led blank when garment feel is part of the experience rather than just the logo.',
        productSlugs: ['regular-fit-tee-260gsm', 'boxy-fit-tee-260gsm'],
      },
    ],
    recommendations: [
      { slug: 'regular-fit-tee-200gsm', reason: 'The safest starting point for broad team use, events and straightforward size collection.' },
      { slug: 'polo-280gsm', reason: 'A more structured option for customer-facing or coordinated team apparel.' },
      { slug: 'regular-fit-tee-260gsm', reason: 'Adds a more substantial fabric feel without changing to an oversized silhouette.' },
      { slug: 'regular-fit-hoodie-320gsm', reason: 'Useful when the programme needs a warmer layer for off-sites, gifting or cooler weather.' },
      { slug: 'canvas-tote-bag', reason: 'A one-size add-on for onboarding kits, events and internal gifting.' },
    ],
    printIntro: 'Choose the finish around the artwork and garment rather than the department ordering it. These are the three print methods currently offered by Garmops.',
    printNotes: {
      'screen-printing': 'A strong starting point for repeat logos, typography and larger graphics across team T-shirts and company-event apparel.',
      dtf: 'Useful when company artwork contains more detail or multiple colours that would make screen separations less practical.',
      'reflective-print': 'Best treated as a speciality effect for event, campaign or statement garments rather than a default staff-uniform finish.',
    },
    planningTitle: 'What you will decide before production',
    planningIntroduction: 'Keep the order simple: one approved garment, one artwork owner, one size split and one delivery requirement.',
    planningNotes: [
      { title: 'Garment', description: 'Choose the product and colour around how the team will actually wear it.' },
      { title: 'Artwork', description: 'Provide the approved logo or graphic and define each print position and physical size.' },
      { title: 'Sizes', description: 'Split the order across the selected product’s available sizes using its own size chart.' },
      { title: 'Delivery', description: 'Provide the destination and required date so production and shipping feasibility can be reviewed.' },
    ],
    faqs: [
      { question: 'What is the minimum company apparel order?', answer: 'Custom orders start from 50 pieces per style. A programme can contain more than one product, but each line item must meet the applicable minimum.' },
      { question: 'Which T-shirt is the easiest starting point for a mixed team?', answer: 'The Classic T-Shirt is the most straightforward starting point because it uses a familiar regular fit and everyday fabric weight. If garment feel matters more, compare it with the Premium T-Shirt.' },
      { question: 'Can we split one order across different sizes?', answer: 'Yes. Quantities can be allocated across the sizes available for that product. Use the product-specific chart before collecting the final split.' },
      { question: 'Can we order a sample before the custom run?', answer: 'Yes. Catalogue samples are available so you can check the base garment before committing to a bulk custom order.' },
      { question: 'Which print techniques are available?', answer: 'Garmops currently offers Screen Print, DTF and Reflective Print. The right choice depends on the artwork, garment, print size, quantity and desired finish.' },
    ],
    relatedLinks: [
      { label: 'Browse all products', href: '/products' },
      { label: 'Read the corporate merchandise planning guide', href: '/journal/corporate-merchandise-india-planning-guide' },
      { label: 'Learn how to brief an apparel manufacturer', href: '/journal/how-to-brief-a-manufacturer' },
    ],
    cta: {
      title: 'Ready to build your team apparel?',
      description: 'Choose the garment first, then take that exact product into the configurator to add colour, artwork and quantities.',
      primary: { label: 'Browse products', href: '/products' },
      secondary: { label: 'Start designing', href: '/configurator' },
    },
  },
  hospitality: {
    slug: 'industries/hospitality',
    breadcrumbLabel: 'Cafés & Hospitality',
    eyebrow: 'Cafés & Hospitality',
    title: 'Branded apparel for cafés, restaurants and hospitality teams.',
    lead: 'Choose staff apparel and merchandise around the role: casual T-shirts for everyday teams, structured polos for a cleaner look, and more design-led garments or totes for customer merchandise.',
    seo: {
      title: 'Restaurant, Café & Hospitality Apparel India | Garmops',
      description: 'Choose branded T-shirts, polos, sweatshirts and tote bags for cafés, restaurants, hotels and hospitality teams from 50 pieces per style.',
      image: '/industries/hotels-restaurants.webp',
    },
    heroImage: '/industries/hotels-restaurants.webp',
    heroImageAlt: 'Branded apparel for cafes restaurants and hospitality teams',
    serviceType: 'Branded cafe restaurant and hospitality apparel',
    audience: ['Cafés', 'Restaurants', 'Hotels', 'Hospitality groups', 'Venue teams'],
    trustPoints: sharedTrustPoints,
    useCases: [
      {
        title: 'Casual staff apparel',
        description: 'An approachable everyday T-shirt route for teams working in casual cafés, restaurants and event-led hospitality settings.',
        productSlugs: ['regular-fit-tee-200gsm'],
      },
      {
        title: 'Structured team apparel',
        description: 'Use a polo when the role calls for a collar and a more structured customer-facing silhouette.',
        productSlugs: ['polo-280gsm'],
      },
      {
        title: 'Café merchandise',
        description: 'Move to a relaxed or heavier blank when the product is intended to be bought and worn by customers as merchandise.',
        productSlugs: ['boxy-fit-tee-200gsm', 'boxy-fit-tee-260gsm'],
      },
      {
        title: 'Retail & gifting',
        description: 'Add a one-size tote or premium T-shirt when the merchandise needs to work beyond staff apparel.',
        productSlugs: ['canvas-tote-bag', 'regular-fit-tee-260gsm'],
      },
    ],
    recommendations: [
      { slug: 'regular-fit-tee-200gsm', reason: 'A versatile everyday option for casual staff teams and venue events.' },
      { slug: 'polo-280gsm', reason: 'A more structured silhouette for customer-facing staff where a collar is preferred.' },
      { slug: 'boxy-fit-tee-200gsm', reason: 'A relaxed merchandise option for cafés and hospitality brands with a more casual visual identity.' },
      { slug: 'boxy-fit-tee-260gsm', reason: 'A heavier oversized option when customer merchandise should feel more like a retail garment.' },
      { slug: 'canvas-tote-bag', reason: 'A simple one-size merchandise piece for retail counters, events and gifting.' },
    ],
    proofIndustries: ['Hotels & Restaurants'],
    printIntro: 'The garment, artwork and operating environment should drive the print choice. For staff apparel, keep durability, print size and wash routine in mind during review.',
    printNotes: {
      'screen-printing': 'A practical route for café tees, simple venue graphics and repeat merchandise runs with bold artwork.',
      dtf: 'Useful for detailed venue illustrations, multi-colour marks or artwork that is less practical to separate for screen print.',
      'reflective-print': 'Better suited to speciality merchandise, nightlife or statement graphics than ordinary day-to-day staff apparel.',
    },
    planningTitle: 'Plan the garment around the role',
    planningIntroduction: 'Hospitality apparel works best when the team separates staff needs from customer merchandise instead of forcing one product to do both jobs.',
    planningNotes: [
      { title: 'Staff role', description: 'Decide whether the wearer needs a casual T-shirt, a structured polo or a warmer layer.' },
      { title: 'Brand artwork', description: 'Confirm the approved mark, print position and physical dimensions before production.' },
      { title: 'Size collection', description: 'Use the exact size chart for the selected product rather than reusing a split from another garment.' },
      { title: 'Merchandise vs staff wear', description: 'Treat customer merchandise as a separate product decision if fit, weight or styling needs to feel more premium.' },
    ],
    faqs: [
      { question: 'Should a restaurant or café choose polos or T-shirts?', answer: 'Choose around the role and brand. T-shirts suit casual teams and merchandise; polos create a more structured silhouette for customer-facing staff.' },
      { question: 'Can we use one garment for both staff and customer merchandise?', answer: 'You can, but it is often better to separate the two if customers expect a more relaxed or premium fit than the staff uniform.' },
      { question: 'Can we split sizes across the order?', answer: 'Yes. Use the selected product’s size chart and allocate the total quantity across its available sizes.' },
      { question: 'Can we order a sample first?', answer: 'Yes. A catalogue sample is useful for checking fit, fabric feel and whether the garment suits the venue before placing the custom run.' },
      { question: 'Which print techniques are available?', answer: 'Garmops currently offers Screen Print, DTF and Reflective Print. Technique suitability is reviewed against the garment and artwork.' },
    ],
    relatedLinks: [
      { label: 'Browse all products', href: '/products' },
      { label: 'Explore custom polo T-shirts', href: '/custom-polo-t-shirts' },
      { label: 'Explore custom canvas tote bags', href: '/custom-tote-bags' },
    ],
    cta: {
      title: 'Build the right apparel mix for your venue.',
      description: 'Start with the staff or merchandise use case, choose the garment, then configure the exact product you want to produce.',
      primary: { label: 'Browse products', href: '/products' },
      secondary: { label: 'Start designing', href: '/configurator' },
    },
  },
  events: {
    slug: 'industries/events',
    breadcrumbLabel: 'Events & Entertainment',
    eyebrow: 'Events & Entertainment',
    title: 'Merchandise built around your event.',
    lead: 'Plan crew apparel, attendee merchandise, artist drops and conference kits around the people receiving them and the date they need to arrive. Start with the job, then choose the garment.',
    seo: {
      title: 'Event Merchandise & Bulk Event Apparel India | Garmops',
      description: 'Choose custom T-shirts, hoodies and tote bags for event crews, attendees, festivals, conferences and artist merchandise from 50 pieces per style.',
      image: '/industries/music-events.webp',
    },
    heroImage: '/industries/music-events.webp',
    heroImageAlt: 'Custom merchandise for events festivals and entertainment',
    serviceType: 'Custom event merchandise and bulk event apparel',
    audience: ['Event teams', 'Festivals', 'Conference organisers', 'Artists', 'Agencies', 'Brand launch teams'],
    trustPoints: sharedTrustPoints,
    useCases: [
      {
        title: 'Crew apparel',
        description: 'Use a straightforward, easy-to-size garment when the primary job is identifying and outfitting a working event team.',
        productSlugs: ['regular-fit-tee-200gsm', 'regular-fit-hoodie-320gsm'],
      },
      {
        title: 'Attendee merchandise',
        description: 'Choose a versatile product when it needs to work across a broad audience and distribution plan.',
        productSlugs: ['regular-fit-tee-200gsm', 'canvas-tote-bag'],
      },
      {
        title: 'Artist & retail merchandise',
        description: 'Move toward heavier or oversized garments when the blank itself is part of the creative and retail value.',
        productSlugs: ['regular-fit-tee-260gsm', 'boxy-fit-tee-260gsm'],
      },
      {
        title: 'Conference kits',
        description: 'Pair a wearable product with a one-size tote when distribution needs to be simple at registration or check-in.',
        productSlugs: ['regular-fit-tee-200gsm', 'polo-280gsm', 'canvas-tote-bag'],
      },
    ],
    recommendations: [
      { slug: 'regular-fit-tee-200gsm', reason: 'The simplest starting point for crews, attendees and broad event distribution.' },
      { slug: 'boxy-fit-tee-260gsm', reason: 'A stronger choice for artist, festival or retail merchandise where silhouette and fabric weight matter.' },
      { slug: 'regular-fit-hoodie-320gsm', reason: 'Useful as a warmer crew or merchandise layer when the event environment calls for it.' },
      { slug: 'canvas-tote-bag', reason: 'A one-size option for conference kits, sponsor merchandise and attendee distribution.' },
      { slug: 'polo-280gsm', reason: 'A structured option for hosts, representatives or event teams that need a collared garment.' },
    ],
    proofIndustries: ['Music & Events'],
    printIntro: 'Event artwork can range from simple crew marks to complex sponsor layouts and retail graphics. Choose the print method around that artwork, the garment and the intended effect.',
    printNotes: {
      'screen-printing': 'A strong starting point for bold event graphics, tour artwork and repeat bulk runs where solid colours dominate.',
      dtf: 'Useful for detailed, multi-colour sponsor or event artwork that would be cumbersome to separate for screen printing.',
      'reflective-print': 'Especially relevant to nightlife, festivals and statement event graphics where the artwork is intended to react to direct light.',
    },
    planningTitle: 'Work backwards from the event date',
    planningIntroduction: 'The must-arrive date matters more than the factory dispatch date. Lock approvals early enough to leave room for production, checking and transit.',
    planningNotes: [
      { title: 'Use case & quantity', description: 'Separate crew, attendee and retail quantities so each product is sized and packed for the right job.' },
      { title: 'Artwork approvals', description: 'Lock sponsor, artist and partner artwork before production rather than treating logos as interchangeable placeholders.' },
      { title: 'Sizes', description: 'Use named crew or attendee data where possible and the exact chart for the selected product.' },
      { title: 'Packing & destination', description: 'Confirm how the event team will receive, identify and distribute the pieces, especially when there are multiple destinations.' },
    ],
    faqs: [
      { question: 'What is the minimum order for event merchandise?', answer: 'Custom orders start from 50 pieces per style. Each separate product configuration should meet its applicable minimum.' },
      { question: 'Which product is the safest starting point for a broad attendee group?', answer: 'The Classic T-Shirt is the simplest starting point because it uses a familiar fit and everyday weight. Artist or retail merchandise may benefit from a heavier or oversized product instead.' },
      { question: 'How should we plan event sizes?', answer: 'Use named attendee or crew data where possible and always collect sizes against the exact product chart. Avoid carrying a size split from one fit into another without checking measurements.' },
      { question: 'Can we order a sample before the event run?', answer: 'Yes. A catalogue sample can help confirm the base garment before you finalise the custom order.' },
      { question: 'Which print techniques are available?', answer: 'Garmops currently offers Screen Print, DTF and Reflective Print. The best method depends on the artwork, garment, print dimensions and desired effect.' },
    ],
    relatedLinks: [
      { label: 'Browse all products', href: '/products' },
      { label: 'Explore bulk custom T-shirts', href: '/custom-t-shirt-printing' },
      { label: 'Explore custom tote bags', href: '/custom-tote-bags' },
    ],
    cta: {
      title: 'Start with the event job, not the print method.',
      description: 'Choose the garment for the crew, attendee or retail use case first, then configure the artwork and quantities around that product.',
      primary: { label: 'Browse products', href: '/products' },
      secondary: { label: 'Start designing', href: '/configurator' },
    },
  },
} satisfies Record<string, IndustryPageContent>

export type IndustryPageKey = keyof typeof industryPages
