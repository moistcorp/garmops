import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-[#ECE7DF] bg-white px-6 py-14">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-10 text-sm text-[#111111]/50">
        <div>
          <Link href="/">
            <Image src="/logo3.png" alt="Garmops" width={908} height={114} className="h-8 w-auto object-contain mb-3" />
          </Link>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-[#111111]/50 bg-white border border-[#ECE7DF] rounded-full px-3 py-1">GST Compliant</span>
            <span className="text-xs text-[#111111]/50 bg-white border border-[#ECE7DF] rounded-full px-3 py-1">Udyam Registered MSME</span>
            <span className="text-xs text-[#111111]/50 bg-white border border-[#ECE7DF] rounded-full px-3 py-1">Export Registered (IEC)</span>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-1">Links</span>
          <Link href="/products" className="hover:text-[var(--color-teal)] transition-colors">Products</Link>
          <Link href="/how-it-works" className="hover:text-[var(--color-teal)] transition-colors">How it works</Link>
          <Link href="/pricing" className="hover:text-[var(--color-teal)] transition-colors">Pricing</Link>
          <Link href="/journal" className="hover:text-[var(--color-teal)] transition-colors">Journal</Link>
          <Link href="/work" className="hover:text-[var(--color-teal)] transition-colors">Work</Link>
          <Link href="/contact" className="hover:text-[var(--color-teal)] transition-colors">Contact</Link>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-1">Contact</span>
          <a href="https://moistcorp.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-teal)] transition-colors">Moist Corp</a>
          <a href="mailto:hello@garmops.com" className="hover:text-[var(--color-teal)] transition-colors">hello@garmops.com</a>
          <a href="tel:+918800711169" className="hover:text-[var(--color-teal)] transition-colors">+91-8800711169</a>
          <div className="flex items-center gap-3 mt-2">
            <a href="https://www.instagram.com/garmops/" target="_blank" rel="noopener noreferrer" aria-label="Garmops on Instagram"
              className="w-8 h-8 rounded-full border border-[#ECE7DF] bg-white flex items-center justify-center hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="https://www.linkedin.com/company/garmops" target="_blank" rel="noopener noreferrer" aria-label="Garmops on LinkedIn"
              className="w-8 h-8 rounded-full border border-[#ECE7DF] bg-white flex items-center justify-center hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.48 1s2.5 1.12 2.5 2.5zM.5 8h4V23h-4V8zM8.5 8h3.83v2.05h.05c.53-1 1.84-2.05 3.79-2.05 4.06 0 4.81 2.67 4.81 6.14V23h-4v-6.75c0-1.61-.03-3.68-2.24-3.68-2.24 0-2.58 1.75-2.58 3.56V23h-4V8z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-[#ECE7DF] text-xs text-[#111111]/40">
        © {new Date().getFullYear()} Garmops. All rights reserved.
      </div>
    </footer>
  )
}
