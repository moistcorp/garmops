import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppChrome from '@/components/common/AppChrome'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Moist Foundry — Custom Apparel, Made to Order',
    template: '%s — Moist Foundry',
  },
  description: 'Small batch custom apparel for brands, cafes, and companies. MOQ 50 pieces. Ships in 35 days. Manufactured in India.',
  metadataBase: new URL('https://moistfoundry.com'),
  openGraph: {
    siteName: 'Moist Foundry',
    locale: 'en_IN',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-[#111111]`}>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  )
}
