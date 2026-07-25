import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/payment/',
        '/cart',
        '/checkout',
        '/configurator/build/',
        '/configurator/cart/',
      ],
    },
    sitemap: 'https://garmops.com/sitemap.xml',
  }
}
