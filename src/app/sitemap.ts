import { MetadataRoute } from 'next'
import { products } from '@/lib/products'
import { caseStudies } from '@/lib/casestudies'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://Garmops.com'

  const staticPages = [
    { url: base, priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${base}/configurator`, priority: 0.9, changeFrequency: 'monthly' as const },
    { url: `${base}/products`, priority: 0.8, changeFrequency: 'weekly' as const },
    { url: `${base}/pricing`, priority: 0.8, changeFrequency: 'monthly' as const },
    { url: `${base}/how-it-works`, priority: 0.7, changeFrequency: 'monthly' as const },
    { url: `${base}/journal`, priority: 0.7, changeFrequency: 'weekly' as const },
    { url: `${base}/contact`, priority: 0.6, changeFrequency: 'yearly' as const },
    { url: `${base}/work`, priority: 0.8, changeFrequency: 'monthly' as const },
  ]

  const productPages = products.map(p => ({
    url: `${base}/products/${p.slug}`,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
  }))

  const workPages = caseStudies.map(cs => ({
  url: `${base}/work/${cs.slug}`,
  priority: 0.7,
  changeFrequency: 'monthly' as const,
}))

return [...staticPages, ...productPages, ...workPages]

  return [...staticPages, ...productPages]
}
