import type { JournalPost } from './journal'
import type { Product } from './products'
import { absoluteUrl, siteConfig } from './seo'

export type BreadcrumbItem = {
  name: string
  path: string
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl('/logo3.png'),
    image: absoluteUrl(siteConfig.ogImage),
    description: siteConfig.description,
    email: siteConfig.email,
    telephone: siteConfig.phone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: siteConfig.address.locality,
      addressRegion: siteConfig.address.region,
      addressCountry: siteConfig.address.country,
    },
    areaServed: [
      { '@type': 'Country', name: 'India' },
      { '@type': 'AdministrativeArea', name: 'International' },
    ],
    sameAs: [
      siteConfig.social.instagram,
      siteConfig.social.linkedin,
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: siteConfig.phone,
      email: siteConfig.email,
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
    knowsAbout: [
      'Custom apparel manufacturing',
      'Bulk T-shirt printing',
      'Branded merchandise',
      'Screen printing',
      'Direct-to-garment printing',
      'Direct-to-film printing',
      'Garment embroidery',
      'Low minimum order quantity apparel',
    ],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    publisher: { '@id': `${siteConfig.url}/#organization` },
  }
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function productSchema(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${absoluteUrl(`/products/${product.slug}`)}#product`,
    name: product.name,
    description: product.description,
    image: product.image ? [absoluteUrl(product.image)] : undefined,
    sku: `GARMOPS-${product.id}`,
    category: product.category,
    brand: {
      '@type': 'Brand',
      name: siteConfig.name,
    },
    material: product.details[0],
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Fabric weight',
        value: `${product.gsm} GSM`,
      },
      ...(product.fits
        ? [{
            '@type': 'PropertyValue',
            name: 'Fit',
            value: product.fits.join(', '),
          }]
        : []),
      {
        '@type': 'PropertyValue',
        name: 'Available sizes',
        value: product.sizes.join(', '),
      },
    ],
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/products/${product.slug}`),
      priceCurrency: 'INR',
      price: product.price,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${siteConfig.url}/#organization` },
    },
  }
}

export function articleSchema(post: JournalPost) {
  const articleText = post.sections
    .flatMap(section => [
      ...section.paragraphs,
      ...(section.bullets ?? []),
      ...(section.table?.rows.flat() ?? []),
    ])
    .join(' ')

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${absoluteUrl(`/journal/${post.slug}`)}#article`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: siteConfig.language,
    mainEntityOfPage: absoluteUrl(`/journal/${post.slug}`),
    wordCount: articleText.trim().split(/\s+/).length,
    keywords: post.keywords?.join(', '),
    author: {
      '@type': 'Organization',
      name: post.author ?? 'Garmops Production Team',
      url: absoluteUrl('/about'),
    },
    publisher: {
      '@id': `${siteConfig.url}/#organization`,
    },
    image: absoluteUrl(post.image ?? siteConfig.ogImage),
    about: post.keywords?.map(name => ({
      '@type': 'Thing',
      name,
    })),
  }
}

export function faqSchema(items: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}
