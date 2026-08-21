import { MetadataRoute } from 'next'
import { products } from '@/lib/products'
import { caseStudies } from '@/lib/casestudies'
import { journalPosts } from '@/lib/journal'
import { allLandingPages } from '@/lib/landingPages'
import { industryPages } from '@/lib/industries'
import { absoluteUrl, siteConfig } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const releaseDate = '2026-07-28'

  const staticPages = [
    { url: siteConfig.url, priority: 1.0, changeFrequency: 'weekly' as const, images: [absoluteUrl('/products/boxy-fit-tee-260gsm.webp')] },
    { url: absoluteUrl('/configurator'), priority: 0.9, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/products'), priority: 0.9, changeFrequency: 'weekly' as const },
    { url: absoluteUrl('/industries'), priority: 0.9, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/pricing'), priority: 0.9, changeFrequency: 'monthly' as const },
    { url: absoluteUrl('/journal'), priority: 0.8, changeFrequency: 'weekly' as const },
    { url: absoluteUrl('/contact'), priority: 0.7, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/about'), priority: 0.7, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/terms'), priority: 0.3, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/privacy'), priority: 0.3, changeFrequency: 'yearly' as const },
    { url: absoluteUrl('/work'), priority: 0.8, changeFrequency: 'monthly' as const },
  ].map(page => ({
    ...page,
    lastModified: releaseDate,
  }))

  const commercialPages = allLandingPages.map(page => ({
    url: absoluteUrl(`/${page.slug}`),
    lastModified: '2026-07-29',
    priority: page.slug === 'custom-tote-bags' || page.kind === 'industry' ? 0.8 : 0.9,
    changeFrequency: 'monthly' as const,
    images: page.seo.image ? [absoluteUrl(page.seo.image)] : undefined,
  }))

  const additionalIndustryPages = [industryPages.sports, industryPages.creative, industryPages.arts].map(page => ({
    url: absoluteUrl(`/${page.slug}`),
    lastModified: releaseDate,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
    images: page.seo.image ? [absoluteUrl(page.seo.image)] : undefined,
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

  return [...staticPages, ...commercialPages, ...additionalIndustryPages, ...productPages, ...workPages, ...journalPages]
}
