import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/payment/', '/checkout/'],
    },
    sitemap: 'https://garmops.com/sitemap.xml',
  }
}
