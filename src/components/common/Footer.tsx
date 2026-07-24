import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-[#E5E5E5] px-6 py-12 bg-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-10 text-sm text-[#111111]/50">
        <div>
          <Link href="/">
            <Image src="/logo3.png" alt="Garmops" width={120} height={36} className="h-8 w-auto object-contain mb-3" />
          </Link>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-[#111111]/40">
            <span>GST Compliant</span>
            <span>&middot;</span>
            <span>Udyam Registered MSME</span>
            <span>&middot;</span>
            <span>Export Registered (IEC)</span>
          </div>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-1">Links</span>
          <Link href="/products" className="hover:text-[#111111] transition-colors">Products</Link>
          <Link href="/how-it-works" className="hover:text-[#111111] transition-colors">How it works</Link>
          <Link href="/pricing" className="hover:text-[#111111] transition-colors">Pricing</Link>
          <Link href="/journal" className="hover:text-[#111111] transition-colors">Journal</Link>
          <Link href="/work" className="hover:text-[#111111] transition-colors">Work</Link>
          <Link href="/contact" className="hover:text-[#111111] transition-colors">Contact</Link>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-1">Contact</span>
          <a href="https://moistcorp.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#111111] transition-colors"> Moist Corp</a>
          <a href="mailto:hello@garmops.com" className="hover:text-[#111111] transition-colors">hello@garmops.com</a>
          <a href="tel:+918800711169" className="hover:text-[#111111] transition-colors">+91-8800711169</a>
          <div className="flex items-center gap-4 mt-1">
            <a href="https://www.instagram.com/garmops/" target="_blank" rel="noopener noreferrer" aria-label="Garmops on Instagram" className="hover:text-[#111111] transition-colors">
              Instagram
            </a>
            <a href="https://www.linkedin.com/company/garmops" target="_blank" rel="noopener noreferrer" aria-label="Garmops on LinkedIn" className="hover:text-[#111111] transition-colors">
              LinkedIn
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-[#E5E5E5] text-xs text-[#111111]/40">
        © {new Date().getFullYear()} Garmops. All rights reserved.
      </div>
    </footer>
  )
}