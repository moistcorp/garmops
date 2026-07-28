import type { Metadata } from 'next'

export const siteConfig = {
  name: 'Garmops',
  description: 'Premium custom apparel and bulk branded merchandise for businesses, made in India. Start at 50 pieces with transparent pricing and an online configurator.',
  url: 'https://www.garmops.com',
  ogImage: '/products/boxy-fit-tee-260gsm.webp',
  locale: 'en_IN',
  language: 'en-IN',
  email: 'hello@garmops.com',
  phone: '+91-8800711169',
  address: {
    locality: 'Greater Noida',
    region: 'Uttar Pradesh',
    country: 'IN',
  },
  social: {
    instagram: 'https://www.instagram.com/garmops/',
    linkedin: 'https://www.linkedin.com/company/garmops',
  },
} as const

export function googleSiteVerification() {
  const configuredValue = process.env.GOOGLE_SITE_VERIFICATION
    ?? process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  const value = configuredValue?.trim()

  if (!value || value === 'your_google_verification_token') return undefined

  // Accept either the raw token or the complete tag copied from Search Console.
  return value.match(/content=["']([^"']+)["']/i)?.[1] ?? value
}

export function absoluteUrl(path = '') {
  if (/^https?:\/\//.test(path)) return path
  return new URL(path || '/', siteConfig.url).toString()
}

export function generateMeta({
  title,
  description,
  path = '',
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  authors,
  keywords,
  noIndex = false,
}: {
  title?: string
  description?: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  keywords?: string[]
  noIndex?: boolean
}): Metadata {
  const fullTitle = title ? `${title} — Garmops` : 'Garmops — Custom Apparel, Made to Order'
  const fullDescription = description ?? siteConfig.description
  const url = absoluteUrl(path)
  const ogImage = absoluteUrl(image ?? siteConfig.ogImage)
  const openGraph: Metadata['openGraph'] = type === 'article'
    ? {
        title: fullTitle,
        description: fullDescription,
        url,
        siteName: siteConfig.name,
        images: [{ url: ogImage, alt: fullTitle }],
        type: 'article',
        locale: siteConfig.locale,
        publishedTime,
        modifiedTime,
        authors,
      }
    : {
        title: fullTitle,
        description: fullDescription,
        url,
        siteName: siteConfig.name,
        images: [{ url: ogImage, alt: fullTitle }],
        type: 'website',
        locale: siteConfig.locale,
      }

  return {
    title: title ?? 'Custom Apparel, Made to Order',
    description: fullDescription,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: url },
    applicationName: siteConfig.name,
    authors: authors?.map(name => ({ name })),
    creator: siteConfig.name,
    publisher: siteConfig.name,
    keywords,
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [ogImage],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  }
}
