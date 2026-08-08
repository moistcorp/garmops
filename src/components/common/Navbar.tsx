'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCartStore } from '@/lib/store'
import { CircleHelp, ShoppingCart } from 'lucide-react'
import CustomerAccountControl from '@/components/auth/CustomerAccountControl'
import CustomerAuthDialog from '@/components/auth/CustomerAuthDialog'
import { useCustomerSession } from '@/components/auth/useCustomerSession'
import GarmopsLogo from '@/components/common/GarmopsLogo'

const links = [
  { label: 'Products', href: '/products' },
  { label: 'Industries', href: '/industries' },
  { label: 'Case Studies', href: '/work' },
  { label: 'Pricing', href: '/pricing' },
]

const mobileGroups = [
  {
    label: 'Products',
    links: [
      { label: 'Bulk Custom T-Shirts', href: '/custom-t-shirt-printing' },
      { label: 'Custom Polo T-Shirts', href: '/custom-polo-t-shirts' },
      { label: 'Custom Hoodies', href: '/custom-hoodies' },
      { label: 'Custom Tote Bags', href: '/custom-tote-bags' },
    ],
  },
  {
    label: 'Industries',
    links: [
      { label: 'Industries Overview', href: '/industries' },
      { label: 'Companies & Teams', href: '/corporate-merchandise' },
      { label: 'Cafés & Hospitality', href: '/industries/hospitality' },
      { label: 'Events & Entertainment', href: '/industries/events' },
      { label: 'Sports & Fitness', href: '/industries#sports-fitness' },
      { label: 'Creative Teams', href: '/industries#creative-teams' },
      { label: 'Arts & Culture', href: '/industries#arts-culture' },
    ],
  },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openPathname, setOpenPathname] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const open = openPathname === pathname
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const itemCount = useCartStore(state => state.items.reduce((total, item) => total + item.quantity, 0))
  const accountsEnabled =
    process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true'
  const customerSession = useCustomerSession(accountsEnabled)
  const [authOpen, setAuthOpen] = useState(false)

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
    <header
      className={`sticky top-0 z-50 w-full border-b bg-[var(--color-cream)] transition-colors duration-200 ${
        scrolled ? 'border-[rgba(22,33,43,0.36)]' : 'border-[var(--color-rule)]'
      }`}
    >
      <div className="relative z-50 mx-auto w-full">
        <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 sm:gap-4 sm:px-6 sm:py-3 xl:grid-cols-[auto_auto_minmax(24px,1fr)_auto] xl:gap-8 xl:px-16">
          <Link href="/" className="flex min-w-0 shrink items-center xl:justify-self-start" aria-label="Garmops home">
            <GarmopsLogo
              className="h-4 w-auto max-w-[132px] object-contain min-[360px]:h-[18px] min-[360px]:max-w-[160px] sm:h-5 sm:max-w-[180px]"
              preload
            />
          </Link>

          <nav className="hidden items-center justify-center gap-6 text-sm xl:justify-self-start xl:flex" aria-label="Primary navigation">
            {links.map(link => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`) || (link.href === '/industries' && pathname === '/corporate-merchandise')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center border-b-2 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors ${
                    isActive
                      ? 'border-[var(--color-accent)] text-[var(--color-navy)]'
                      : 'border-transparent text-[#444444] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-5 xl:justify-self-end xl:flex">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#444444] transition-colors hover:text-[var(--color-accent)]"
            >
              <CircleHelp size={15} aria-hidden="true" />
              Help
            </Link>
            {accountsEnabled && <CustomerAccountControl session={customerSession} onOpenAuth={() => setAuthOpen(true)} />}
            <Link
              href="/cart"
                className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#444444] transition-colors hover:text-[var(--color-accent)]"
              >
              <ShoppingCart size={15} aria-hidden="true" />
              CART{itemCount > 0 ? ` · ${itemCount > 99 ? '99+' : itemCount}` : ''}
            </Link>
            <Link
              href="/configurator"
              className="inline-flex min-h-11 items-center justify-center rounded-[4px] bg-[var(--color-accent)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-cream)] transition-colors hover:bg-[var(--color-accent-dark)]"
            >
              START DESIGNING
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 min-[360px]:gap-4 xl:hidden">
            <Link href="/cart" className="flex min-h-11 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/60">
              <ShoppingCart size={15} aria-hidden="true" />
              CART{itemCount > 0 ? ` · ${itemCount > 99 ? '99+' : itemCount}` : ''}
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-[4px] border border-transparent text-[var(--text-primary)] transition-colors hover:border-[var(--color-rule)] hover:bg-[var(--color-cream-soft)]"
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
        className={`fixed inset-0 z-40 xl:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={closeMenu}
          className={`absolute inset-0 bg-[var(--color-navy)]/20 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <nav
          ref={mobileNavRef}
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className={`absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] overflow-y-auto border-b border-[var(--color-rule)] bg-[var(--color-cream)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-all duration-200 sm:px-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-4 ${
            open ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
          }`}
        >
          <div className="flex flex-col">
            {links.map((link, index) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`) || (link.href === '/industries' && pathname === '/corporate-merchandise')
              return (
                <Link
                  ref={index === 0 ? firstMenuLinkRef : undefined}
                  key={link.href}
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenu}
                  className={`border-b-2 px-1 py-3.5 font-mono text-[11px] uppercase tracking-[0.06em] leading-none transition-colors sm:py-4 sm:text-xs ${
                    isActive ? 'border-[var(--color-accent)] text-[var(--color-navy)]' : 'border-transparent text-[var(--text-primary)]/65'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="mt-5 grid gap-5 border-t border-[var(--color-rule)] pt-5 sm:grid-cols-2">
            {mobileGroups.map(group => (
              <div key={group.label}>
                <p className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]/40">
                  {group.label}
                </p>
                <div className="mt-2 flex flex-col">
                  {group.links.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      tabIndex={open ? 0 : -1}
                      onClick={closeMenu}
                      className="px-1 py-2.5 text-sm text-[var(--text-primary)]/65 transition-colors hover:text-[var(--color-accent)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/configurator"
            tabIndex={open ? 0 : -1}
            onClick={closeMenu}
            className="mt-5 block rounded-[4px] bg-[var(--color-accent)] px-5 py-3.5 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-cream)] transition-colors hover:bg-[var(--color-accent-dark)]"
          >
            START DESIGNING
          </Link>
          {accountsEnabled && <CustomerAccountControl session={customerSession} mobile onOpenAuth={() => setAuthOpen(true)} onNavigate={closeMenu} />}
          <a
            href="https://wa.me/918800711169?text=Hi%2C%20I%20found%20Garmops%20and%20would%20like%20to%20know%20more%20about%20custom%20apparel."
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              const payload = {
                event: 'whatsapp_click',
                source_page: pathname,
                destination: 'whatsapp',
              }
              window.dataLayer = window.dataLayer ?? []
              window.dataLayer.push(payload)
              window.dispatchEvent(new CustomEvent('garmops:analytics', { detail: payload }))
              closeMenu()
            }}
            className="mt-2 block rounded-[4px] border border-[var(--color-accent)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent-dark)]"
          >
            Chat on WhatsApp
          </a>
        </nav>
      </div>
      {accountsEnabled ? <CustomerAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} next={pathname} onAuthenticated={(destination) => { setAuthOpen(false); void customerSession.refresh(); router.refresh(); if (destination !== pathname) router.push(destination); }} /> : null}
    </header>
  )
}
