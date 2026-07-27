'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCartStore } from '@/lib/store'

const links = [
  { label: 'Products', href: '/products' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Work', href: '/work' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Journal', href: '/journal' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [openPathname, setOpenPathname] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const open = openPathname === pathname
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const itemCount = useCartStore(state => state.items.reduce((total, item) => total + item.quantity, 0))

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstMenuLinkRef.current?.focus()

    const handleMenuKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPathname(null)
        requestAnimationFrame(() => menuButtonRef.current?.focus())
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        mobileNavRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter(element => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleMenuKeys)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleMenuKeys)
    }
  }, [open])

  const closeMenu = () => setOpenPathname(null)

  return (
    <header className="sticky top-0 z-50 w-full px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-4">
      <div
        className={`relative z-50 mx-auto max-w-7xl rounded-full border border-[#ECE7DF] bg-white/95 backdrop-blur-md transition-shadow duration-200 ${
          scrolled
            ? 'shadow-[0_8px_24px_rgba(22,33,43,0.08)]'
            : 'shadow-[0_2px_10px_rgba(22,33,43,0.04)]'
        }`}
      >
        <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-2.5 sm:px-6 sm:py-3">
          <Link href="/" className="flex min-w-0 shrink items-center" aria-label="Garmops home">
            <Image
              src="/logo3.png"
              alt="Garmops"
              width={908}
              height={114}
              className="h-[18px] w-auto max-w-[180px] object-contain sm:h-5"
              priority
            />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-6 text-sm md:flex" aria-label="Primary navigation">
            {links.map(link => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-xs tracking-wide transition-colors ${
                    isActive
                      ? 'font-semibold text-[var(--color-teal)]'
                      : 'text-[#444444] hover:text-[var(--color-teal)]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-4 md:flex">
            <Link
              href="/cart"
              className="relative text-xs text-[#444444] transition-colors hover:text-[var(--color-teal)]"
            >
              Cart
              {itemCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-teal)] px-1 text-[10px] leading-none text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
            <Link
              href="/configurator"
              className="rounded-full bg-[var(--color-teal)] px-5 py-2.5 text-xs tracking-wide text-white transition-colors hover:bg-[var(--color-teal-dark)]"
            >
              Start designing
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-4 md:hidden">
            <Link href="/cart" className="relative text-sm text-[#111111]/60">
              Cart
              {itemCount > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-teal)] px-1 text-[10px] leading-none text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#111111] transition-colors hover:bg-black/5"
              onClick={() => setOpenPathname(open ? null : pathname)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 bg-current transition-transform duration-200 ${
                  open ? 'rotate-45' : '-translate-y-[6px]'
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 bg-current transition-opacity duration-200 ${open ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                aria-hidden="true"
                className={`absolute h-0.5 w-5 bg-current transition-transform duration-200 ${
                  open ? '-rotate-45' : 'translate-y-[6px]'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={closeMenu}
          className={`absolute inset-0 bg-[#111111]/20 backdrop-blur-[2px] transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <nav
          ref={mobileNavRef}
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className={`absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)] max-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-[28px] border border-[#ECE7DF] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_18px_50px_rgba(22,33,43,0.16)] transition-all duration-200 sm:inset-x-4 ${
            open ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
          }`}
        >
          <div className="flex flex-col">
            {links.map((link, index) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  ref={index === 0 ? firstMenuLinkRef : undefined}
                  key={link.href}
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenu}
                  className={`border-b border-[#ECE7DF] px-1 py-4 text-[17px] leading-none transition-colors ${
                    isActive ? 'font-semibold text-[var(--color-teal)]' : 'text-[#111111]/65'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <Link
            href="/configurator"
            tabIndex={open ? 0 : -1}
            onClick={closeMenu}
            className="mt-5 block rounded-full bg-[var(--color-teal)] px-5 py-3.5 text-center text-base font-medium text-white transition-colors hover:bg-[var(--color-teal-dark)]"
          >
            Start designing
          </Link>
        </nav>
      </div>
    </header>
  )
}
