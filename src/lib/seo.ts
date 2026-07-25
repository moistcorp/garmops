export const siteConfig = {
  name: 'Garmops',
  description: 'Small batch custom apparel for brands, cafes, and companies. MOQ 50 pieces. Ships in 35 days. Manufactured in India.',
  url: 'https://garmops.com',
  ogImage: '/hero.jpg',
}

export function generateMeta({
  title,
  description,
  path = '',
  image,
}: {
  title?: string
  description?: string
  path?: string
  image?: string
}) {
  const fullTitle = title ? `${title} — Garmops` : 'Garmops — Custom Apparel, Made to Order'
  const fullDescription = description ?? siteConfig.description
  const url = `${siteConfig.url}${path}`
  const ogImage = image ?? siteConfig.ogImage

  return {
    title: title ?? 'Custom Apparel, Made to Order',
    description: fullDescription,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url,
      siteName: siteConfig.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
      type: 'website',
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  }
}
