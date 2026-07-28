import { products } from '@/lib/products'
import { notFound } from 'next/navigation'
import ShopProductClient from './ShopProductClient'
import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import { breadcrumbSchema, productSchema } from '@/lib/structuredData'

export const dynamicParams = false

export function generateStaticParams() {
  return products.map(product => ({ slug: product.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = products.find(item => item.slug === slug)
  if (!product) {
    return {
      title: 'Product Not Found',
      robots: { index: false, follow: false, nocache: true },
    }
  }
  return generateMeta({
    title: `${product.name} Sample`,
    description: `${product.description} Order a sample or customise it for a bulk branded apparel run from 50 pieces.`,
    path: `/products/${product.slug}`,
    image: product.image ?? undefined,
    keywords: [
      `${product.name.toLowerCase()} India`,
      `custom ${product.category.toLowerCase()}`,
      `${product.gsm} GSM ${product.name.toLowerCase()}`,
      'bulk custom apparel',
    ],
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
  return (
    <>
      <JsonLd data={productSchema(product)} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Products', path: '/products' },
        { name: product.name, path: `/products/${product.slug}` },
      ])} />
      <ShopProductClient product={product} allProducts={products} />
    </>
  )
}
