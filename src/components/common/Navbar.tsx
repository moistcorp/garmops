'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const itemCount = useCartStore(s => s.items.reduce((a, i) => a + i.quantity, 0))

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="w-full sticky top-0 z-50 px-4 pt-4 pb-3">
      <div
        className={`max-w-7xl mx-auto rounded-full bg-white/90 backdrop-blur-md border border-[#ECE7DF] transition-shadow duration-200 ${
          scrolled ? 'shadow-[0_8px_24px_rgba(22,33,43,0.08)]' : 'shadow-[0_2px_10px_rgba(22,33,43,0.04)]'
        }`}
      >
        <div className="px-6 py-3 flex items-center justify-between gap-8">
          <Link href="/" className="flex items-center shrink-0">
            <Image src="/logo3.png" alt="Garmops" width={180} height={48}
              className="h-5 w-auto object-contain" priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm flex-1 justify-center">
            {links.map(l => {
              const isActive = pathname === l.href || pathname.startsWith(l.href + '/')
              return (
                <Link key={l.href} href={l.href}
                  className={`transition-colors text-xs tracking-wide ${
                    isActive
                      ? 'text-[var(--color-teal)] font-semibold'
                      : 'text-[#444444] hover:text-[var(--color-teal)]'
                  }`}>
                  {l.label}
                </Link>
              )
            })}
          </nav>

          {/* Right side actions */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <Link href="/cart" className="relative text-xs text-[#444444] hover:text-[var(--color-teal)] transition-colors">
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-[var(--color-teal)] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {itemCount}
                </span>
              )}
            </Link>
            <Link href="/configurator"
              className="bg-[var(--color-teal)] text-white text-xs px-5 py-2.5 rounded-full hover:bg-[var(--color-teal-dark)] transition-colors tracking-wide">
              Start designing
            </Link>
          </div>

          {/* Mobile right */}
          <div className="md:hidden flex items-center gap-4">
            <Link href="/cart" className="relative text-xs text-[#111111]/50">
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-[var(--color-teal)] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {itemCount}
                </span>
              )}
            </Link>
            <button className="flex flex-col gap-1.5 p-1" onClick={() => setOpen(!open)} aria-label="Menu">
              <span className={`block w-5 h-0.5 bg-[#111111] transition-transform ${open ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#111111] transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#111111] transition-transform ${open ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden px-6 pb-6 flex flex-col gap-1 border-t border-[#ECE7DF] pt-4">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                onClick={() => setOpen(false)}
                className={`py-2.5 text-sm border-b border-[var(--color-cream-soft)] ${
                  pathname === l.href ? 'text-[var(--color-teal)] font-semibold' : 'text-[#111111]/60'
                }`}>
                {l.label}
              </Link>
            ))}
            <Link href="/configurator"
              onClick={() => setOpen(false)}
              className="mt-3 bg-[var(--color-teal)] text-white px-5 py-3 rounded-full text-center text-sm font-medium">
              Start designing
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}