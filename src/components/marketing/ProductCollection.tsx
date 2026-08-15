import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/lib/products'
import { productImageAlt } from '@/lib/products'

export default function ProductCollection({
  heading,
  introduction,
  products,
}: {
  heading: string
  introduction?: string
  products: Product[]
}) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-(--text-primary)/45">Products</p>
        <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">{heading}</h2>
        {introduction && <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">{introduction}</p>}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(product => (
          <Link
            key={product.slug}
            href={`/products/${product.slug}`}
            className="techpack-panel group flex min-w-0 flex-col overflow-hidden rounded-sm border transition-transform hover:-translate-y-0.5 hover:!border-(--color-accent)/45"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-(--color-cream-soft)">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={productImageAlt(product)}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-(--text-primary)/25">
                  Product specification
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-base font-semibold leading-snug text-(--text-primary) group-hover:underline">
                {product.name}
              </h3>
              <p className="mt-1 text-xs text-(--text-primary)/50">
                {product.gsm} GSM{product.fits?.[0] ? ` · ${product.fits[0]} fit` : ''}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#3f3f3f]">{product.description}</p>
              <p className="mt-5 border-t border-white/70 pt-4 text-sm font-semibold text-(--text-primary)">
                Sample: ₹{product.price.toLocaleString('en-IN')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
