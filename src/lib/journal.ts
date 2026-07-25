export type JournalPost = {
  slug: string
  title: string
  excerpt: string
  date: string
  category: string
  readTime: string
  sections: Array<{ heading: string; paragraphs: string[] }>
}

export const journalPosts: JournalPost[] = [
  {
    slug: 'why-low-moq-matters',
    title: 'Why low MOQ is a game changer for small brands',
    excerpt: 'Most manufacturers require 500+ pieces minimum. Here is why we built Garmops around 50 — and what it means for brands just getting started.',
    date: 'June 12, 2025',
    category: 'Industry',
    readTime: '4 min read',
    sections: [
      {
        heading: 'Start with demand, not inventory',
        paragraphs: [
          'A smaller first run lets a brand test fit, colour, pricing, and demand without tying up months of cash in stock. The first order becomes a learning cycle rather than a long-term bet.',
          'At 50 pieces, it is practical to launch one focused design, gather customer feedback, and use real sell-through data to plan the next production run.',
        ],
      },
      {
        heading: 'More room to improve',
        paragraphs: [
          'Smaller batches make iteration affordable. You can adjust the size split, artwork placement, or garment weight between runs instead of living with the same decision across hundreds of units.',
          'The trade-off is a higher unit price than mass production. For an early-stage label, lower inventory risk and faster learning often matter more than the lowest possible per-piece cost.',
        ],
      },
    ],
  },
  {
    slug: 'screen-print-vs-dtg',
    title: 'Screen print vs DTG — which is right for your order?',
    excerpt: 'Two of the most common print techniques, but they serve very different needs. We break down when to use each one based on artwork, quantity, and budget.',
    date: 'May 28, 2025',
    category: 'Production',
    readTime: '5 min read',
    sections: [
      {
        heading: 'Choose screen print for repeatability',
        paragraphs: [
          'Screen printing applies one colour at a time through a prepared mesh. Its setup makes the most sense for larger runs, solid colours, and artwork that needs strong, repeatable coverage.',
          'Each additional colour adds setup and production work, so simplified artwork is usually more economical.',
        ],
      },
      {
        heading: 'Choose DTG for detail and smaller runs',
        paragraphs: [
          'Direct-to-garment printing works more like an inkjet printer for fabric. It handles gradients, photographs, and many colours without preparing a screen for every colour.',
          'The right choice still depends on fabric composition, garment colour, desired hand feel, and quantity. Share the original artwork rather than a compressed screenshot so the production team can assess it accurately.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-brief-a-manufacturer',
    title: 'How to brief a manufacturer — what to send and what to expect',
    excerpt: 'A good brief saves weeks of back and forth. Here is exactly what information you need to provide to get an accurate quote and smooth production run.',
    date: 'May 14, 2025',
    category: 'Guide',
    readTime: '6 min read',
    sections: [
      {
        heading: 'Define the product clearly',
        paragraphs: [
          'Include the garment type, fit, fabric weight, colour, total quantity, size split, and delivery location. If a detail is undecided, label it as open rather than leaving it out.',
          'For every artwork, specify the garment side, intended width or height, print technique if known, and Pantone references where colour matching matters.',
        ],
      },
      {
        heading: 'Send production-ready source files',
        paragraphs: [
          'Vector artwork in AI, EPS, PDF, or SVG is ideal for most decoration methods. Raster artwork should be supplied at its final print size and high resolution.',
          'Ask the manufacturer to confirm the final specification, price, sample plan, production lead time, shipping terms, and approval checkpoints in writing before production begins.',
        ],
      },
    ],
  },
  {
    slug: 'fabric-weight-guide',
    title: 'Fabric weight explained — GSM and what it means for your merch',
    excerpt: 'GSM stands for grams per square metre. It is the single most important spec when choosing a blank. Here is how to pick the right weight for your product.',
    date: 'April 30, 2025',
    category: 'Guide',
    readTime: '4 min read',
    sections: [
      {
        heading: 'What GSM tells you',
        paragraphs: [
          'GSM measures fabric mass per square metre. A higher number usually feels heavier and more substantial, while a lower number usually feels lighter and more breathable.',
          'It does not measure quality by itself. Fibre, yarn, knit construction, finishing, and shrinkage control all affect how a garment wears.',
        ],
      },
      {
        heading: 'Match weight to use',
        paragraphs: [
          'A lighter tee can suit warm climates and event uniforms; a heavyweight tee offers more structure for a premium retail product. Hoodies and sweatshirts need enough weight to support their intended silhouette.',
          'Evaluate weight together with fit and fabric composition, ideally using a physical sample before approving a bulk run.',
        ],
      },
    ],
  },
  {
    slug: 'cafe-merch-guide',
    title: 'The cafe merch playbook — what sells and what sits on the shelf',
    excerpt: 'After working with cafe brands, we have a clear picture of what custom merch actually moves. Here is how to plan a focused first collection.',
    date: 'April 15, 2025',
    category: 'Industry',
    readTime: '5 min read',
    sections: [
      {
        heading: 'Make the product useful first',
        paragraphs: [
          'Totes, tees, caps, and reusable drinkware fit naturally into a customer’s routine. The strongest cafe merchandise can stand on its own even when the buyer is not inside the cafe.',
          'A small, recognisable design often travels further than a large logo. Treat the cafe identity as source material for a product, not simply an advertisement.',
        ],
      },
      {
        heading: 'Keep the first range focused',
        paragraphs: [
          'Start with one or two product types and a controlled colour palette. This keeps the size split and inventory easier to manage while making the display feel intentional.',
          'Track sales by product, size, and colour. Reorder proven combinations and use customer requests to decide what belongs in the next release.',
        ],
      },
    ],
  },
  {
    slug: 'pantone-to-fabric',
    title: 'From Pantone to fabric — how color matching actually works',
    excerpt: 'Your brand color looks perfect on screen. Getting it right on fabric is a different challenge. Here is how we handle color accuracy at Garmops.',
    date: 'April 2, 2025',
    category: 'Production',
    readTime: '3 min read',
    sections: [
      {
        heading: 'Screens are not fabric',
        paragraphs: [
          'Digital colours are emitted as light, while printed and dyed colours are viewed as reflected light. The fabric base, texture, ink opacity, and lighting all change the result.',
          'A Pantone reference gives everyone a physical target, but it does not remove the need to sample. Different fabric and decoration processes can produce slightly different appearances from the same reference.',
        ],
      },
      {
        heading: 'Approve a physical standard',
        paragraphs: [
          'For colour-critical work, review a lab dip, strike-off, or decorated pre-production sample under consistent lighting. Record the approved reference so production and quality control compare against the same target.',
          'Allow realistic tolerances and communicate which colours are brand-critical before quoting; exact custom matching may affect minimums, lead time, and cost.',
        ],
      },
    ],
  },
]
