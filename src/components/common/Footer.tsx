import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-[#E5E5E5] mt-24 px-6 py-12 bg-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-10 text-sm text-[#111111]/50">
        <div>
          <Image src="/logo3.png" alt="Garmops" width={120} height={36} className="h-8 w-auto object-contain mb-3" />
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/products" className="hover:text-[#111111] transition-colors">Products</Link>
          <Link href="/how-it-works" className="hover:text-[#111111] transition-colors">How it works</Link>
          <Link href="/pricing" className="hover:text-[#111111] transition-colors">Pricing</Link>
          <Link href="/journal" className="hover:text-[#111111] transition-colors">Journal</Link>
          <Link href="/work" className="hover:text-[#111111] transition-colors">Work</Link>
          <Link href="/contact" className="hover:text-[#111111] transition-colors">Contact</Link>
        
        </div>
        <div className="flex flex-col gap-2">
          <a href="https://corp.com" target="_blank" className="hover:text-[#111111] transition-colors"> Corp</a>
          <a href="mailto:Garmops@corp.com" className="hover:text-[#111111] transition-colors">Garmops@corp.com</a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-[#E5E5E5] text-xs text-[#111111]/30">
        © {new Date().getFullYear()} Garmops. All rights reserved.
      </div>
    </footer>
  )
}