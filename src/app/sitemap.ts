import { MetadataRoute } from 'next'
import { products } from '@/lib/products'
import { caseStudies } from '@/lib/casestudies'
import { journalPosts } from '@/lib/journal'
import { absoluteUrl, siteConfig } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const releaseDate = '2026-07-28'

  const staticPages = [
    { url: siteConfig.url, priority: 1.0, changeFrequency: 'weekly' as const, images: [absoluteUrl('/products/boxy-fit-tee-260gsm.jpg')] },
    { url: absoluteUrl('/configurator'), priority: 0.9, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/products'), priority: 0.9, changeFrequency: 'weekly' as const },
    { url: absoluteUrl('/pricing'), priority: 0.9, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/how-it-works'), priority: 0.8, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/journal'), priority: 0.8, changeFrequency: 'weekly' as const },
    { url: absoluteUrl('/contact'), priority: 0.7, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/about'), priority: 0.7, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/work'), priority: 0.8, changeFrequency: 'monthly' as const },
  ].map(page => ({
    ...page,
    lastModified: releaseDate,
  }))

  const productPages = products.map(p => ({
    url: absoluteUrl(`/products/${p.slug}`),
    lastModified: releaseDate,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
    images: p.image ? [absoluteUrl(p.image)] : undefined,
  }))

  const workPages = caseStudies.map(cs => ({
    url: absoluteUrl(`/work/${cs.slug}`),
    lastModified: releaseDate,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    images: cs.coverImage ? [absoluteUrl(cs.coverImage)] : undefined,
  }))

  const journalPages = journalPosts.map(post => ({
    url: absoluteUrl(`/journal/${post.slug}`),
    lastModified: post.updatedAt ?? post.publishedAt,
    priority: post.publishedAt === releaseDate ? 0.8 : 0.6,
    changeFrequency: 'monthly' as const,
    images: post.image ? [absoluteUrl(post.image)] : undefined,
  }))

  return [...staticPages, ...productPages, ...workPages, ...journalPages]
}
