'use client'
import { MAX_SAMPLE_ITEM_QUANTITY, useCartStore } from '@/lib/store'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getShippingPaise } from '@/lib/orders/shipping'
import { products, productImageAlt } from '@/lib/products'

const emptyCartSuggestions = [
  'regular-fit-tee-200gsm',
  'boxy-fit-tee-260gsm',
  'canvas-tote-bag',
].map(slug => products.find(product => product.slug === slug)).filter((product): product is (typeof products)[number] => Boolean(product))

export default function Cart() {
  const { items, removeItem, updateQuantity, total, hasHydrated } = useCartStore()
  const router = useRouter()
  const cartTotal = total()
  const shippingPaise = getShippingPaise()
  const grandTotal = cartTotal + shippingPaise / 100

  if (!hasHydrated) return (
    <div className="techpack-canvas min-h-[70vh] animate-pulse">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="h-9 w-56 bg-[#ECE7DF] rounded-sm mb-12" />
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {[0, 1].map(i => (
              <div key={i} className="techpack-panel flex h-28 items-start gap-5 rounded-sm border p-5">
                <div className="w-20 h-20 bg-(--color-cream-soft) rounded-sm shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="h-4 w-1/2 bg-[#ECE7DF] rounded" />
                  <div className="h-3 w-1/3 bg-[#ECE7DF] rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="techpack-panel h-56 rounded-sm border" />
        </div>
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="techpack-canvas min-h-[70vh] px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-(--color-accent)">Sample cart</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Your cart is ready for a starting point.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-(--text-muted) sm:text-base">Order a catalogue sample to compare fabric and fit, or browse the full range before planning a custom run.</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {emptyCartSuggestions.map(product => (
            <Link key={product.slug} href={`/products/${product.slug}`} className="storefront-interactive-card group overflow-hidden rounded-sm border border-(--color-rule) bg-white">
              <div className="relative aspect-[4/3] overflow-hidden bg-(--color-cream-soft)">
                {product.image ? (
                  <Image src={product.image} alt={productImageAlt(product)} fill sizes="(max-width: 640px) 100vw, 33vw" className="storefront-interactive-image object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-(--text-muted)">Product image</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-(--text-primary)">{product.name}</p>
                  <p className="mt-1 text-xs text-(--text-muted)">{product.gsm} GSM · ₹{product.price.toLocaleString('en-IN')}</p>
                </div>
                <span aria-hidden="true" className="text-(--color-accent)">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 min-[360px]:flex-row">
          <Link href="/products" className="rounded-sm bg-(--color-accent) px-6 py-3.5 text-center text-sm font-medium text-white transition-colors duration-200 hover:bg-(--color-accent-dark)">
            Explore all products
          </Link>
          <Link href="/contact" className="rounded-sm border border-(--color-rule) px-6 py-3.5 text-center text-sm font-medium text-(--text-primary) transition-colors duration-200 hover:border-(--color-accent)">
            Ask for guidance
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="techpack-canvas min-h-[70vh]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:mb-12 sm:text-4xl">Your cart</h1>

        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {items.map(item => (
            <div key={`${item.id}-${item.size}`} className="techpack-panel flex flex-col gap-4 rounded-sm border p-4 sm:flex-row sm:gap-5 sm:p-5">
              <div className="flex min-w-0 gap-4 sm:contents">
              <div className="relative flex aspect-[2/3] w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-(--color-cream-soft)">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-contain p-1"
                  />
                ) : (
                  <span className="text-xs text-(--text-muted)">IMG</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-(--text-primary) leading-snug break-words">{item.name}</p>
                <p className="text-xs text-(--text-muted) mt-0.5">Size: {item.size}</p>
                <p className="mt-2 font-mono text-sm font-bold">&#8377;{(item.price * item.quantity).toLocaleString('en-IN')}</p>
              </div>
              </div>
              <div className="flex w-full sm:w-auto items-center justify-between sm:flex-col sm:items-end gap-3 sm:ml-auto">
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                    aria-label={`Decrease ${item.name} quantity`}
                    className="techpack-control flex h-10 w-10 items-center justify-center rounded-sm border text-base transition-colors hover:text-(--color-accent) sm:h-8 sm:w-8 sm:text-sm">
                    -
                  </button>
                  <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                    disabled={item.quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                    aria-label={`Increase ${item.name} quantity`}
                    className="techpack-control flex h-10 w-10 items-center justify-center rounded-sm border text-base transition-colors hover:text-(--color-accent) disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 sm:text-sm">
                    +
                  </button>
                </div>
                <button type="button"
                  onClick={() => removeItem(item.id, item.size)}
                  className="min-h-10 px-1 text-xs text-(--text-muted) transition-colors hover:text-(--text-primary)">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-4">
          <div className="techpack-surface flex flex-col gap-4 rounded-sm border p-6 lg:sticky lg:top-28">
            <p className="text-sm font-semibold">Order summary</p>
            <div className="flex flex-col gap-2 text-sm border-t border-[#ECE7DF] pt-4">
              <div className="flex justify-between">
                <span className="text-(--text-muted)">Subtotal</span>
                <span className="font-mono">&#8377;{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-muted)">Shipping</span>
                <span className="font-mono">Free</span>
              </div>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-[#ECE7DF] pt-4">
              <span>Total</span>
              <span className="font-mono">&#8377;{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/checkout')}
              className="w-full bg-(--color-accent) text-white py-3.5 rounded-sm text-sm font-medium hover:bg-(--color-accent-dark) transition-colors"
            >
              Proceed to checkout
            </button>
            <Link href="/products" className="text-xs text-center text-(--text-muted) hover:text-(--text-primary) transition-colors">
              Continue shopping
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
