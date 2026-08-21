'use client'

import { Collapsible } from '@base-ui/react/collapsible'
import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import type { Product } from '@/lib/products'
import { productImageAlt } from '@/lib/products'

const categories = ['All', 'T-Shirts', 'Polos', 'Hoodies', 'Sweatshirts', 'Tote Bags'] as const
const fits = ['All', 'Classic', 'Oversized'] as const
const feels = ['All', 'Everyday', 'Heavyweight', 'Structured', 'Warm Fleece', 'Heavy Canvas'] as const

type CategoryFilter = (typeof categories)[number]
type FitFilter = (typeof fits)[number]
type FeelFilter = (typeof feels)[number]

const categoryParams: Record<CategoryFilter, string | undefined> = {
  All: undefined,
  'T-Shirts': 't-shirts',
  Polos: 'polos',
  Hoodies: 'hoodies',
  Sweatshirts: 'sweatshirts',
  'Tote Bags': 'tote-bags',
}

const fitParams: Record<FitFilter, string | undefined> = {
  All: undefined,
  Classic: 'classic',
  Oversized: 'oversized',
}

const feelParams: Record<FeelFilter, string | undefined> = {
  All: undefined,
  Everyday: 'everyday',
  Heavyweight: 'heavyweight',
  Structured: 'structured',
  'Warm Fleece': 'warm-fleece',
  'Heavy Canvas': 'heavy-canvas',
}

function filterFromParam<T extends string>(values: readonly T[], params: Record<T, string | undefined>, current: string | null): T {
  return values.find(value => params[value] === current) ?? values[0]
}

function sizeRange(product: Product) {
  if (product.sizes.length <= 1) return product.sizes[0]
  return `${product.sizes[0]}–${product.sizes[product.sizes.length - 1]}`
}

export default function ProductSelector({ products }: { products: Product[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = filterFromParam(categories, categoryParams, searchParams.get('category'))
  const fit = filterFromParam(fits, fitParams, searchParams.get('fit'))
  const feel = filterFromParam(feels, feelParams, searchParams.get('feel'))

  const categoryProducts = useMemo(
    () => products.filter(product => category === 'All' || product.selectorCategory === category),
    [category, products],
  )

  const availableFits = useMemo(
    () => fits.filter(item => item === 'All' || categoryProducts.some(product => product.selectorFit === item)),
    [categoryProducts],
  )

  const availableFeels = useMemo(
    () => feels.filter(item => item === 'All' || categoryProducts.some(product => product.selectorFeel === item)),
    [categoryProducts],
  )

  const filteredProducts = useMemo(() => {
    return categoryProducts.filter(product => {
      if (fit !== 'All' && product.selectorFit !== fit) return false
      if (feel !== 'All' && product.selectorFeel !== feel) return false
      return true
    })
  }, [categoryProducts, feel, fit])

  const showFitFilter = availableFits.length > 2
  const showFeelFilter = availableFeels.length > 2
  const hasFilters = category !== 'All' || fit !== 'All' || feel !== 'All'

  const replaceFilters = (updates: Partial<Record<'category' | 'fit' | 'feel', string | undefined>>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const selectCategory = (nextCategory: CategoryFilter) => {
    replaceFilters({ category: categoryParams[nextCategory], fit: undefined, feel: undefined })
  }

  const resetFilters = () => {
    replaceFilters({ category: undefined, fit: undefined, feel: undefined })
  }

  const secondaryFilters = (
    <div className={`grid gap-4 ${showFitFilter && showFeelFilter ? 'lg:grid-cols-2' : ''}`}>
      {showFitFilter && (
        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-(--text-muted)">
            <SlidersHorizontal size={13} /> Fit
          </legend>
          <div className="flex flex-wrap gap-2">
            {availableFits.map(item => {
              const active = fit === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => replaceFilters({ fit: fitParams[item] })}
                  aria-pressed={active}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                    active
                      ? 'border-(--text-primary) bg-(--text-primary) text-white'
                      : 'border-[#DDD7CE] bg-white text-(--text-muted) hover:text-(--text-primary)'
                  }`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {showFeelFilter && (
        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-(--text-muted)">
            <SlidersHorizontal size={13} /> Fabric feel
          </legend>
          <div className="flex flex-wrap gap-2">
            {availableFeels.map(item => {
              const active = feel === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => replaceFilters({ feel: feelParams[item] })}
                  aria-pressed={active}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                    active
                      ? 'border-(--text-primary) bg-(--text-primary) text-white'
                      : 'border-[#DDD7CE] bg-white text-(--text-muted) hover:text-(--text-primary)'
                  }`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )

  return (
    <section className="max-w-7xl mx-auto px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mb-7 border-y border-[#E5E0D8] py-6 sm:py-7">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-muted)">Product selector</p>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-(--text-primary) sm:text-2xl">What are you looking for?</h2>
                <p className="mt-1 text-sm text-(--text-muted)">
                  Start with the product type. When there is a meaningful choice, narrow it by fit or fabric feel.
                </p>
              </div>
              <p aria-live="polite" className="mt-2 text-xs font-medium text-(--text-muted) sm:mt-0">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </p>
            </div>
          </div>

          <div className="relative -mr-4 sm:mr-0">
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-(--color-cream) to-transparent sm:hidden" aria-hidden="true" />
            <fieldset>
              <legend className="sr-only">Product category</legend>
              <div className="flex gap-2 overflow-x-auto pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map(item => {
                const active = category === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectCategory(item)}
                    aria-pressed={active}
                    className={`shrink-0 rounded-sm border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? 'border-(--color-accent) bg-(--color-accent) text-white'
                        : 'border-[#DDD7CE] bg-white text-(--text-primary)/65 hover:border-(--text-primary)/25 hover:text-(--text-primary)'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
              </div>
            </fieldset>
          </div>

          {(showFitFilter || showFeelFilter) && (
            <div className="border-t border-[#ECE7DF] pt-5">
              <div className="hidden sm:block">{secondaryFilters}</div>
              <Collapsible.Root className="group sm:hidden" defaultOpen={hasFilters}>
                <Collapsible.Trigger className="flex min-h-11 w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-[0.13em] text-(--text-muted)">
                  Refine by fit or feel
                  <ChevronDown size={16} className="transition-transform group-data-panel-open:rotate-180" />
                </Collapsible.Trigger>
                <Collapsible.Panel className="overflow-hidden pt-4 data-[ending-style]:h-0 data-[starting-style]:h-0">
                  {secondaryFilters}
                </Collapsible.Panel>
              </Collapsible.Root>
            </div>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-(--text-muted) hover:text-(--text-primary)"
            >
              <X size={13} /> Show all products
            </button>
          )}
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filteredProducts.map((product, index) => (
            <article
              key={product.id}
              className="storefront-interactive-card techpack-panel group flex flex-col overflow-hidden rounded-sm border"
            >
              <Link href={`/products/${product.slug}`} className="relative aspect-[4/3] w-full overflow-hidden bg-(--color-cream-soft) sm:aspect-[3/4]" aria-label={`View ${product.name} sample and specifications`}>
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={productImageAlt(product)}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"
                    className="storefront-interactive-image object-cover"
                    preload={index === 0}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-(--text-muted)">
                    Product photo
                  </span>
                )}
                <span className="absolute left-4 top-4 rounded-[3px] border border-black/10 bg-[#FAF8F5]/95 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-primary) shadow-sm backdrop-blur-sm">
                  {product.selectorBadge}
                </span>
              </Link>

              <div className="flex flex-1 flex-col p-4 sm:p-5 xl:p-4">
                <div>
                  <h3 className="text-lg font-semibold leading-snug tracking-tight text-(--text-primary) group-hover:underline"><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
                  <p className="mt-1.5 text-xs font-medium text-(--text-muted)">
                    {[product.selectorFit ? `${product.selectorFit} fit` : null, product.selectorFeel].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-3 hidden text-sm leading-6 text-(--text-primary)/65 sm:block">{product.selectorDescription}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-[3px] bg-[#F3F0EA] px-2.5 py-1 text-xs font-medium text-(--text-primary)/60">
                    {product.gsm} GSM
                  </span>
                  <span className="rounded-[3px] bg-[#F3F0EA] px-2.5 py-1 text-xs font-medium text-(--text-primary)/60">
                    {product.selectorMaterial}
                  </span>
                </div>

                <div className="mt-5 hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-(--text-muted)">Best for</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                    {product.bestFor.map(item => (
                      <span key={item} className="text-xs text-(--text-muted)">{item}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="grid grid-cols-2 gap-3 border-t border-[#ECE7DF] pt-4">
                    <div><p className="text-[11px] font-medium uppercase tracking-widest text-(--text-muted)">Catalogue sample</p><p className="mt-1 text-base font-bold text-(--text-primary)">&#8377;{product.price.toLocaleString('en-IN')}</p></div>
                    <div className="text-right"><p className="text-[11px] font-medium uppercase tracking-widest text-(--text-muted)">Custom MOQ</p><p className="mt-1 text-sm font-semibold text-(--text-primary)">{product.minimumOrderQuantity} pcs</p></div>
                  </div>
                  <p className="mt-2 text-[11px] text-(--text-muted)">Sizes {sizeRange(product)}</p>
                  <div className="mt-4 grid gap-2">
                    <Link href={`/products/${product.slug}`} className="flex min-h-10 items-center justify-between rounded-sm border border-(--color-rule) px-3 text-xs font-semibold text-(--text-primary)">
                      View sample & specs <ArrowRight size={14} />
                    </Link>
                    <Link href={`/configurator/build/${product.slug}`} className="flex min-h-10 items-center justify-between rounded-sm bg-(--color-accent) px-3 text-xs font-semibold text-white">
                      Configure custom order <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="techpack-panel rounded-sm border px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-(--text-primary)">No products match those filters.</h3>
          <p className="mt-2 text-sm text-(--text-muted)">Try another fit or fabric feel.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-sm bg-(--text-primary) px-4 py-2 text-sm font-medium text-white"
          >
            Show all products
          </button>
        </div>
      )}
    </section>
  )
}
