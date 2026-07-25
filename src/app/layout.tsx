import type { Metadata } from 'next'
import './globals.css'
import AppChrome from '@/components/common/AppChrome'

export const metadata: Metadata = {
  title: {
    default: 'Garmops — Custom Apparel, Made to Order',
    template: '%s — Garmops',
  },
  description: 'Small batch custom apparel for brands, cafes, and companies. MOQ 50 pieces. Ships in 35 days. Manufactured in India.',
  metadataBase: new URL('https://garmops.com'),
  openGraph: {
    siteName: 'Garmops',
    locale: 'en_IN',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-[#111111] antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  )
}
