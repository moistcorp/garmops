import Link from 'next/link'
import GarmopsLogo from '@/components/common/GarmopsLogo'

const productLinks = [
  { label: 'Bulk Custom T-Shirts', href: '/custom-t-shirt-printing' },
  { label: 'Custom Polo T-Shirts', href: '/custom-polo-t-shirts' },
  { label: 'Custom Hoodies', href: '/custom-hoodies' },
  { label: 'Custom Tote Bags', href: '/custom-tote-bags' },
  { label: 'Product Samples', href: '/products' },
  { label: 'Pricing', href: '/pricing' },
]

const solutionLinks = [
  { label: 'Industries Overview', href: '/industries' },
  { label: 'Companies & Teams', href: '/corporate-merchandise' },
  { label: 'Cafés & Hospitality', href: '/industries/hospitality' },
  { label: 'Events & Entertainment', href: '/industries/events' },
  { label: 'Sports & Fitness', href: '/industries#sports-fitness' },
  { label: 'Creative Teams', href: '/industries#creative-teams' },
  { label: 'Arts & Culture', href: '/industries#arts-culture' },
  { label: 'Case Studies', href: '/work' },
  { label: 'Guides', href: '/journal' },
]

const linkClass = 'py-1 transition-colors hover:text-(--color-accent)'

function PaymentMarks() {
  return (
    <section aria-label="Accepted payment methods" className="mx-auto mt-8 max-w-7xl border-t border-[#ECE7DF] pt-6 sm:mt-10 sm:pt-8">
      <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.16em] text-(--text-primary)/40">Secure payments accepted</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14" aria-hidden="true">
        <span className="-skew-x-6 font-sans text-[2.2rem] font-black italic leading-none tracking-[-0.1em] text-[#1434CB]">VISA</span>
        <span className="relative block h-8 w-[52px]" title="Mastercard">
          <span className="absolute left-0 top-0 size-8 rounded-full bg-[#EB001B]" />
          <span className="absolute right-0 top-0 size-8 rounded-full bg-[#F79E1B]" />
          <span className="absolute left-[13px] top-0 h-8 w-6 bg-[#FF5F00]" />
        </span>
        <span className="flex items-end gap-1 font-sans text-2xl font-black italic tracking-[-0.12em] text-[#5A5A5A]">
          UPI
          <span className="mb-0.5 flex gap-0.5" aria-hidden="true"><i className="block h-4 w-1 -skew-x-[28deg] bg-[#E07A23]" /><i className="block h-4 w-1 -skew-x-[28deg] bg-[#2B9C64]" /></span>
        </span>
      </div>
      <span className="sr-only">Visa, Mastercard, and UPI</span>
    </section>
  )
}

export default function Footer() {
  return (
    <footer className="bg-transparent px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 text-sm text-(--text-primary)/55 md:grid-cols-[1.25fr_1fr_1fr_1.1fr] md:gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" aria-label="Garmops home">
            <GarmopsLogo className="mb-3 h-8 w-auto" />
          </Link>
          <p className="max-w-xs text-sm leading-6 text-(--text-primary)/55">
            Bulk custom apparel and branded merchandise made in India from 50 pieces per style.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-sm border border-[#ECE7DF] bg-white px-3 py-1 text-xs text-(--text-primary)/50">GST Compliant</span>
            <span className="rounded-sm border border-[#ECE7DF] bg-white px-3 py-1 text-xs text-(--text-primary)/50">Udyam Registered MSME</span>
            <span className="rounded-sm border border-[#ECE7DF] bg-white px-3 py-1 text-xs text-(--text-primary)/50">Export Registered (IEC)</span>
          </div>
        </div>

        <nav aria-label="Product links" className="flex flex-col gap-1">
          <span className="mb-1 text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">Products</span>
          {productLinks.map(link => (
            <Link key={link.href} href={link.href} className={linkClass}>{link.label}</Link>
          ))}
        </nav>

        <nav aria-label="Solution links" className="flex flex-col gap-1">
          <span className="mb-1 text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">Industries</span>
          {solutionLinks.map(link => (
            <Link key={link.href} href={link.href} className={linkClass}>{link.label}</Link>
          ))}
        </nav>

        <div className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
          <span className="mb-1 text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">Company & help</span>
          <Link href="/about" className={linkClass}>About Garmops</Link>
          <Link href="/contact" className={linkClass}>Help</Link>
          <Link href="/terms" className={linkClass}>Terms of Service</Link>
          <Link href="/privacy" className={linkClass}>Privacy Policy</Link>
          <a href="mailto:hello@garmops.com" className={`${linkClass} break-all sm:break-normal`}>hello@garmops.com</a>
          <a href="tel:+918800711169" className={linkClass}>+91-8800711169</a>
          <a href="https://moistcorp.com" target="_blank" rel="noopener noreferrer" className={linkClass}>Moist Corp</a>
          <a
            href="https://wa.me/918800711169?text=Hi%2C%20I%20found%20Garmops%20and%20would%20like%20to%20know%20more%20about%20custom%20apparel."
            target="_blank"
            rel="noopener noreferrer"
            className="py-1 text-(--color-accent-dark) transition-colors hover:text-(--color-accent) sm:hidden"
          >
            WhatsApp us
          </a>
          <div className="mt-3 flex items-center gap-3">
            <a
              href="https://www.instagram.com/garmops/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Garmops on Instagram"
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#ECE7DF] bg-white transition-colors hover:border-(--color-accent) hover:text-(--color-accent)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/garmops"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Garmops on LinkedIn"
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#ECE7DF] bg-white transition-colors hover:border-(--color-accent) hover:text-(--color-accent)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.48 1s2.5 1.12 2.5 2.5zM.5 8h4V23h-4V8zM8.5 8h3.83v2.05h.05c.53-1 1.84-2.05 3.79-2.05 4.06 0 4.81 2.67 4.81 6.14V23h-4v-6.75c0-1.61-.03-3.68-2.24-3.68-2.24 0-2.58 1.75-2.58 3.56V23h-4V8z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <PaymentMarks />

      <div className="mx-auto mt-6 max-w-7xl border-t border-[#ECE7DF] pt-6 text-xs text-(--text-primary)/40 sm:mt-8">
        © {new Date().getFullYear()} Garmops. All rights reserved.
      </div>
    </footer>
  )
}
