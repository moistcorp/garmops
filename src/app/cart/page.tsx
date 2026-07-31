'use client'
import { MAX_SAMPLE_ITEM_QUANTITY, useCartStore } from '@/lib/store'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Cart() {
  const { items, removeItem, updateQuantity, total, hasHydrated } = useCartStore()
  const router = useRouter()
  const cartTotal = total()
  const shipping = cartTotal >= 2000 ? 0 : 99
  const grandTotal = cartTotal + shipping

  if (!hasHydrated) return (
    <div className="techpack-canvas min-h-[70vh] animate-pulse">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="h-9 w-56 bg-[#ECE7DF] rounded-[4px] mb-12" />
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {[0, 1].map(i => (
              <div key={i} className="techpack-panel flex h-28 items-start gap-5 rounded-[4px] border p-5">
                <div className="w-20 h-20 bg-[var(--color-cream-soft)] rounded-[4px] shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="h-4 w-1/2 bg-[#ECE7DF] rounded" />
                  <div className="h-3 w-1/3 bg-[#ECE7DF] rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="techpack-panel h-56 rounded-[4px] border" />
        </div>
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="techpack-canvas flex min-h-[70vh] items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
      <div className="techpack-surface w-full max-w-lg rounded-[4px] border p-6 sm:rounded-[4px] sm:p-10">
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Your cart is empty</h1>
        <p className="text-[#111111]/50 text-sm mb-8">Add some items from the shop to continue.</p>
        <Link href="/products" className="inline-block bg-[var(--color-accent)] text-white px-6 py-3 rounded-[4px] text-sm font-medium hover:bg-[var(--color-accent-dark)] transition">
          Back to shop
        </Link>
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
            <div key={`${item.id}-${item.size}`} className="techpack-panel flex flex-col gap-4 rounded-[4px] border p-4 sm:flex-row sm:gap-5 sm:p-5">
              <div className="flex min-w-0 gap-4 sm:contents">
              <div className="relative w-20 h-20 bg-[var(--color-cream-soft)] rounded-[4px] shrink-0 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="text-xs text-[#111111]/20">IMG</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111111] leading-snug break-words">{item.name}</p>
                <p className="text-xs text-[#111111]/50 mt-0.5">Size: {item.size}</p>
                <p className="mt-2 font-mono text-sm font-bold">&#8377;{(item.price * item.quantity).toLocaleString('en-IN')}</p>
              </div>
              </div>
              <div className="flex w-full sm:w-auto items-center justify-between sm:flex-col sm:items-end gap-3 sm:ml-auto">
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                    className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-base transition-colors hover:text-[var(--color-accent)] sm:h-8 sm:w-8 sm:text-sm">
                    -
                  </button>
                  <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                    disabled={item.quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                    className="techpack-control flex h-10 w-10 items-center justify-center rounded-[4px] border text-base transition-colors hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 sm:text-sm">
                    +
                  </button>
                </div>
                <button type="button"
                  onClick={() => removeItem(item.id, item.size)}
                  className="min-h-10 px-1 text-xs text-[#111111]/40 transition-colors hover:text-[#111111]">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-4">
          <div className="techpack-surface flex flex-col gap-4 rounded-[4px] border p-6 lg:sticky lg:top-28">
            <p className="text-sm font-semibold">Order summary</p>
            <div className="flex flex-col gap-2 text-sm border-t border-[#ECE7DF] pt-4">
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Subtotal</span>
                <span className="font-mono">&#8377;{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Shipping</span>
                <span className="font-mono">{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-[#111111]/40">Add ₹{(2000 - cartTotal).toLocaleString('en-IN')} more for free shipping</p>
              )}
            </div>
            <div className="flex justify-between font-bold text-base border-t border-[#ECE7DF] pt-4">
              <span>Total</span>
              <span className="font-mono">&#8377;{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/checkout')}
              className="w-full bg-[var(--color-accent)] text-white py-3.5 rounded-[4px] text-sm font-medium hover:bg-[var(--color-accent-dark)] transition-colors"
            >
              Proceed to checkout
            </button>
            <Link href="/products" className="text-xs text-center text-[#111111]/40 hover:text-[#111111] transition-colors">
              Continue shopping
            </Link>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
