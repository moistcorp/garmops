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
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) {
        event.preventDefault()
        drawerRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === drawerRef.current)
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
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
      <div className="fixed inset-0 z-50 bg-[var(--color-navy)]/25" onClick={onClose} aria-hidden="true" />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[var(--color-rule)] bg-[var(--color-cream)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-4 py-4 sm:px-6 sm:py-5">
          <p id="cart-drawer-title" className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-navy)]">
            CART · {hasHydrated ? items.length : 0}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-transparent text-[var(--text-primary)]/40 transition-colors hover:border-[var(--color-rule)] hover:bg-[var(--color-cream-soft)] hover:text-[var(--text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
          {!hasHydrated ? (
            <p className="mt-12 text-center text-sm text-[var(--text-primary)]/40" role="status">
              Loading cart…
            </p>
          ) : items.length === 0 ? (
            <p className="mt-12 text-center text-sm text-[var(--text-primary)]/40">Your cart is empty</p>
          ) : (
            items.map(item => (
              <div key={`${item.id}-${item.size}`} className="flex flex-wrap items-start gap-3 border border-[var(--color-rule)] bg-white p-3 min-[360px]:flex-nowrap min-[360px]:gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-[var(--color-rule)] bg-[var(--color-cream-soft)]">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="text-[10px] text-[var(--text-primary)]/20">IMG</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-[var(--text-primary)]">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-primary)]/50">SIZE: {item.size}</p>
                  <p className="mt-1 font-mono text-xs font-bold">&#8377;{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                      aria-label={`Decrease ${item.name} quantity`}
                      className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream)] font-mono text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-mono text-xs">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                      disabled={item.quantity >= MAX_SAMPLE_ITEM_QUANTITY}
                      aria-label={`Increase ${item.name} quantity`}
                      className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream)] font-mono text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-inherit"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.size)}
                    className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-primary)]/30 transition-colors hover:text-[var(--text-primary)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {hasHydrated && items.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[var(--color-rule)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-5">
            <div className="flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span className="font-mono">&#8377;{cartTotal.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-[var(--text-primary)]/40">Shipping calculated at checkout</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="w-full rounded-[4px] bg-[var(--color-accent)] py-3.5 text-center font-mono text-xs uppercase tracking-[0.06em] text-[var(--color-cream)] transition-colors hover:bg-[var(--color-accent-dark)]"
            >
              Proceed to checkout
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
