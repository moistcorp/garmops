'use client'

import { MAX_SAMPLE_ITEM_QUANTITY, useCartStore } from '@/lib/store'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQuantity, total, hasHydrated } = useCartStore()
  const cartTotal = total()
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => drawerRef.current?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        className="liquid-glass-surface fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l outline-none sm:my-3 sm:mr-3 sm:h-[calc(100%-1.5rem)] sm:rounded-[30px] sm:border"
      >
        <div className="flex items-center justify-between border-b border-white/60 bg-white/15 px-4 py-4 sm:px-6 sm:py-5">
          <p id="cart-drawer-title" className="text-sm font-semibold text-[#111111]">
            Cart ({hasHydrated ? items.length : 0})
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#111111]/40 transition-colors hover:bg-white/30 hover:text-[#111111]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
          {!hasHydrated ? (
            <p className="mt-12 text-center text-sm text-[#111111]/40" role="status">
              Loading cart…
            </p>
          ) : items.length === 0 ? (
            <p className="mt-12 text-center text-sm text-[#111111]/40">Your cart is empty</p>
          ) : (
            items.map(item => (
              <div key={`${item.id}-${item.size}`} className="liquid-glass-panel flex flex-wrap items-start gap-3 rounded-2xl border p-3 min-[360px]:flex-nowrap min-[360px]:gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-cream-soft)]">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="text-[10px] text-[#111111]/20">IMG</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-[#111111]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[#111111]/50">Size: {item.size}</p>
                  <p className="mt-1 text-xs font-bold">&#8377;{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                      aria-label={`Decrease ${item.name} quantity`}
                      className="liquid-glass-control flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors hover:text-[var(--color-teal)]"
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-xs">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                      disabled={item.quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                      aria-label={`Increase ${item.name} quantity`}
                      className="liquid-glass-control flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors hover:text-[var(--color-teal)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-inherit"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.size)}
                    className="text-xs text-[#111111]/30 transition-colors hover:text-[#111111]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {hasHydrated && items.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-white/60 bg-white/15 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-5">
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>&#8377;{cartTotal.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-[#111111]/40">Shipping calculated at checkout</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="w-full rounded-full bg-[var(--color-teal)] py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-teal-dark)]"
            >
              Proceed to checkout
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
