import { products } from '@/lib/products'
import { notFound } from 'next/navigation'
import ShopProductClient from './ShopProductClient'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export function generateStaticParams() {
  return products.map(product => ({ slug: product.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = products.find(item => item.slug === slug)
  if (!product) return generateMeta({ title: 'Product Not Found' })
  return generateMeta({
    title: product.name,
    description: product.description,
    path: `/products/${product.slug}`,
    image: product.image ?? undefined,
  })
}

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = products.find(p => p.slug === slug)
  if (!product) notFound()
  return <ShopProductClient product={product} allProducts={products} />
}
