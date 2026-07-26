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
    <div className="max-w-7xl mx-auto px-6 py-16 animate-pulse">
      <div className="h-9 w-56 bg-[#ECE7DF] rounded-lg mb-12" />
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {[0, 1].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#ECE7DF] p-5 flex gap-5 items-start h-28">
              <div className="w-20 h-20 bg-[var(--color-cream-soft)] rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-2 pt-1">
                <div className="h-4 w-1/2 bg-[#ECE7DF] rounded" />
                <div className="h-3 w-1/3 bg-[#ECE7DF] rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-56 bg-white rounded-2xl border border-[#ECE7DF]" />
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="max-w-7xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-bold mb-4 tracking-tight">Your cart is empty</h1>
      <p className="text-[#111111]/50 text-sm mb-8">Add some items from the shop to continue.</p>
      <Link href="/products" className="inline-block bg-[var(--color-teal)] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition">
        Back to shop
      </Link>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-12 tracking-tight">Your cart</h1>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {items.map(item => (
            <div key={`${item.id}-${item.size}`} className="bg-white rounded-2xl border border-[#ECE7DF] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
              <div className="flex min-w-0 gap-4 sm:contents">
              <div className="relative w-20 h-20 bg-[var(--color-cream-soft)] rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="text-xs text-[#111111]/20">IMG</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111111] leading-snug break-words">{item.name}</p>
                <p className="text-xs text-[#111111]/50 mt-0.5">Size: {item.size}</p>
                <p className="text-sm font-bold mt-2">&#8377;{(item.price * item.quantity).toLocaleString('en-IN')}</p>
              </div>
              </div>
              <div className="flex w-full sm:w-auto items-center justify-between sm:flex-col sm:items-end gap-3 sm:ml-auto">
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                    className="w-7 h-7 rounded-full border border-[#E5E5E5] text-sm hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors flex items-center justify-center">
                    -
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button type="button"
                    onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                    disabled={item.quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                    className="w-7 h-7 rounded-full border border-[#E5E5E5] text-sm hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40">
                    +
                  </button>
                </div>
                <button type="button"
                  onClick={() => removeItem(item.id, item.size)}
                  className="text-xs text-[#111111]/30 hover:text-[#111111] transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#ECE7DF] bg-white p-6 flex flex-col gap-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
            <p className="text-sm font-semibold">Order summary</p>
            <div className="flex flex-col gap-2 text-sm border-t border-[#ECE7DF] pt-4">
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Subtotal</span>
                <span>&#8377;{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Shipping</span>
                <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-[#111111]/40">Add ₹{(2000 - cartTotal).toLocaleString('en-IN')} more for free shipping</p>
              )}
            </div>
            <div className="flex justify-between font-bold text-base border-t border-[#ECE7DF] pt-4">
              <span>Total</span>
              <span>&#8377;{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/checkout')}
              className="w-full bg-[var(--color-teal)] text-white py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors"
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
  )
}