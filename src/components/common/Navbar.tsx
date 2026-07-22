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
    <header className={`w-full bg-white sticky top-0 z-50 transition-shadow duration-200 ${scrolled ? 'shadow-sm' : 'border-b border-[#E5E5E5]'}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center shrink-0">
          <Image src="/logo3.png" alt="Garmops" width={180} height={48}
            className="h-5 w-auto object-contain" priority />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm flex-1 justify-center">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`transition-colors text-xs tracking-wide ${
                pathname === l.href || pathname.startsWith(l.href + '/')
                  ? 'text-[#111111] font-semibold'
                  : 'text-[#444444] hover:text-[#111111]'
              }`}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <Link href="/cart" className="relative text-xs text-[#444444] hover:text-[#111111] transition-colors">
            Cart
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-[#111111] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {itemCount}
              </span>
            )}
          </Link>
          <Link href="/configurator"
            className="bg-[#111111] text-white text-xs px-5 py-2.5 hover:bg-black transition-colors tracking-wide">
            Start designing
          </Link>
        </div>

        {/* Mobile right */}
        <div className="md:hidden flex items-center gap-4">
          <Link href="/cart" className="relative text-xs text-[#111111]/50">
            Cart
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-[#111111] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
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
        <div className="md:hidden px-6 pb-6 flex flex-col gap-1 border-t border-[#E5E5E5] pt-4 bg-white">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              onClick={() => setOpen(false)}
              className={`py-2.5 text-sm border-b border-[#F7F7F7] ${
                pathname === l.href ? 'text-[#111111] font-semibold' : 'text-[#111111]/60'
              }`}>
              {l.label}
            </Link>
          ))}
          <Link href="/configurator"
            onClick={() => setOpen(false)}
            className="mt-3 bg-[#111111] text-white px-5 py-3 text-center text-sm font-medium">
            Start designing
          </Link>
        </div>
      )}
    </header>
  )
}
