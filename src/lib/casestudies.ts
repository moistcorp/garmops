export type CaseStudy = {
  slug: string
  client: string
  industry: string
  title: string
  excerpt: string
  coverImage: string | null
  product: string
  color: string
  printMethod: string
  date: string
  deliverables: string[]
  quantity: number
  turnaround: string
  challenge: string
  solution: string
  result: string
  sections: {
    heading: string
    body: string
    image: string | null
  }[]
  testimonial?: {
    quote: string
    author: string
    role: string
  }
}

export const caseStudies: CaseStudy[] = [
  {
    slug: 'bistro57-staff-uniforms',
    client: 'Bistro 57',
    industry: 'Hotels & Restaurants',
    title: 'Staff uniforms that feel as good as the food',
    excerpt: 'Bistro 57 needed 120 custom polo shirts for front-of-house staff across two locations. We delivered in 28 days.',
    coverImage: '/work/bistro57/cover.webp',
    product: 'Custom polo shirts',
    color: 'White and Charcoal',
    printMethod: 'Embroidery',
    date: 'March 2025',
    deliverables: ['Custom polo shirts', 'Embroidered logo', 'Two colorways'],
    quantity: 120,
    turnaround: '28 days',
    challenge: 'Bistro 57 had been using off-the-shelf polos from a general supplier. The fit was inconsistent, the embroidery quality was poor, and the color faded after a few washes. With a new location opening, they needed a uniform that matched the quality of their dining experience.',
    solution: 'We sourced 220 GSM pique cotton in two colorways — white for daytime service, charcoal for evening. The Bistro 57 logo was embroidered at chest with a custom thread match to their brand Pantone. Each piece was washed and inspected before dispatch.',
    result: 'All 120 pieces delivered 2 days ahead of the new location opening. Zero rejections. The client reordered an additional 40 pieces two months later.',
    sections: [
      {
        heading: 'The brief',
        body: 'Two colorways, 220 GSM pique cotton, embroidered logo at chest. Size breakdown across XS to XXL for mixed male and female staff. Delivery needed before the new Vasant Vihar location opening on April 1st.',
        image: null,
      },
      {
        heading: 'Fabric and color matching',
        body: 'The client\'s brand guide specified Pantone 433 C for the charcoal colorway. We sourced a fabric batch that matched within a Delta E of 1.2 — well within acceptable tolerance for garment production. The white was finished with a slight optical brightener for a clean, crisp appearance under restaurant lighting.',
        image: null,
      },
      {
        heading: 'Embroidery execution',
        body: 'The Bistro 57 wordmark required a 12-thread color reduction to work at chest scale. We ran a sample on the actual fabric before bulk production. The client approved on first sample — no revisions needed.',
        image: null,
      },
    ],
    testimonial: {
      quote: 'The quality was noticeably better than anything we had before. Our staff actually complimented the shirts, which has never happened.',
      author: 'Priya Menon',
      role: 'Operations Manager, Bistro 57',
    },
  },
  {
    slug: 'soundwave-festival-merch',
    client: 'Soundwave Festival',
    industry: 'Music & Events',
    title: 'Festival merch that sold out in two days',
    excerpt: 'Soundwave needed 300 pieces of merch across three designs for their annual music festival. We turned it around in 22 days.',
    coverImage: '/work/soundwave/cover.webp',
    product: 'Custom tees and tote bags',
    color: 'White and Charcoal',
    printMethod: 'Screen Print',
    date: 'January 2025',
    deliverables: ['Oversized tees', 'Tote bags', 'Screen print', 'Three designs'],
    quantity: 300,
    turnaround: '22 days',
    challenge: 'Festival merch has one job — sell fast and look good doing it. Soundwave had a tight window between their artist lineup announcement and the festival date. They needed 300 pieces across three designs, all screen printed, all delivered to the venue.',
    solution: 'We ran all three designs on 260 GSM boxy fit tees and 12oz canvas totes simultaneously. Screen printing was handled in-house across two shifts. All pieces were bagged individually with size stickers for easy retail setup at the merch booth.',
    result: '280 of 300 pieces sold across the two-day festival. The tote bags sold out on day one. Soundwave has already briefed us for next year with a larger run.',
    sections: [
      {
        heading: 'Three designs, one timeline',
        body: 'Running three screen print designs simultaneously requires careful scheduling to avoid ink contamination between colorways. We sequenced the print run — light to dark — and ran spot checks every 25 pieces. All three designs maintained consistent registration throughout.',
        image: null,
      },
      {
        heading: 'Packaging for retail',
        body: 'Festival merch is sold differently from regular retail. Pieces need to be visible, quickly sortable by size, and priced clearly. We polybag-folded each piece with a size sticker on the front so the merch team could set up and restock the booth in under an hour.',
        image: null,
      },
    ],
    testimonial: {
      quote: 'We sold 93% of our merch over two days. That has never happened before. The quality matched the energy of the festival.',
      author: 'Arjun Sood',
      role: 'Festival Director, Soundwave',
    },
  },
  {
    slug: 'northstar-gym-kit',
    client: 'Northstar Gym',
    industry: 'Sports & Fitness',
    title: 'Gym kit built for performance and brand',
    excerpt: 'Northstar needed matching shorts and tees for 80 members joining their new flagship location.',
    coverImage: '/work/northstar/cover.webp',
    date: 'November 2024',
    product: 'Gym shorts and t-shirts',
    color: 'White and Charcoal',
    printMethod: 'Screen Print',
    deliverables: ['Gym shorts', 'T-shirts', 'Screen print', 'Member welcome kit'],
    quantity: 160,
    turnaround: '30 days',
    challenge: 'Northstar was opening a flagship gym and wanted to give every founding member a welcome kit — matching shorts and tee with the Northstar mark. The pieces needed to look sharp in the gym and hold up through heavy wash cycles.',
    solution: 'We used 200 GSM combed cotton for the tees and 220 GSM cotton shorts. Both screen printed with a single-color Northstar mark. The tees were regular fit — versatile enough to wear in and out of the gym. Everything was packed into a branded mailer box.',
    result: 'All 160 pieces delivered on time. Member feedback on the kit was strong enough that Northstar added a retail component — they now sell the kit in-gym to non-members.',
    sections: [
      {
        heading: 'Welcome kit packaging',
        body: 'The brief asked for pieces that felt like a gift, not a freebie. We folded each set — tee and shorts — into a tissue wrap inside a black mailer box. Simple, but the unboxing felt premium. Several members posted it on Instagram before they even got to the gym.',
        image: null,
      },
    ],
    testimonial: {
      quote: 'Our members loved the kit. We had no idea it would turn into a retail product but the demand was there.',
      author: 'Karan Mehta',
      role: 'Founder, Northstar Gym',
    },
  },
  {
    slug: 'houseofcraft-studio-merch',
    client: 'House of Craft',
    industry: 'Creative Studios',
    title: 'Studio merch that doubles as brand marketing',
    excerpt: 'House of Craft wanted merch their team would actually wear — not branded corporate gifts. We built them a small drop.',
    coverImage: '/work/houseofcraft/cover.webp',
    date: 'September 2024',
    product: 'Custom hoodies and tote bags',
    color: 'Off-White',
    printMethod: 'Screen Print and Embroidery',
    deliverables: ['Boxy hoodies', 'Tote bags', 'Screen print', 'Embroidery'],
    quantity: 75,
    turnaround: '32 days',
    challenge: 'Creative studios have a unique merch challenge — their team has high standards and will not wear something that feels cheap or generic. House of Craft wanted pieces that looked like they came from a proper clothing brand, not a corporate swag vendor.',
    solution: 'We built a small drop — 50 boxy fit hoodies in off-white with a screen printed back graphic and embroidered chest mark, plus 25 canvas totes. The hoodie was 320 GSM — heavy enough to feel substantial. The back graphic was a custom illustration provided by their in-house design team.',
    result: 'The merch became a talking point with clients. House of Craft now hands a tote to every new client at kickoff. They have reordered twice.',
    sections: [
      {
        heading: 'Combining print techniques',
        body: 'The hoodie used both screen print (back graphic, large format) and embroidery (chest mark, small format). These two techniques require different lead times and handoffs. We sequenced embroidery first, then moved to screen print, inspecting each piece between processes.',
        image: null,
      },
      {
        heading: 'Off-white as a canvas',
        body: 'Off-white is harder to produce consistently than pure white — the exact shade varies by dye lot. We ordered a 10% oversupply and colour-matched each piece before bulk production to ensure consistency across the full run.',
        image: null,
      },
    ],
    testimonial: {
      quote: 'People ask us where the hoodie is from. That is exactly what we wanted.',
      author: 'Sneha Rao',
      role: 'Creative Director, House of Craft',
    },
  },
]
