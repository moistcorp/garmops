import type { Metadata } from 'next'
import './globals.css'
import AppChrome from '@/components/common/AppChrome'
import SatoshiFontResources from '@/components/common/SatoshiFontResources'
import { googleSiteVerification, siteConfig } from '@/lib/seo'
import AnalyticsPreferences from '@/components/privacy/AnalyticsPreferences'
import { isStaffSurface } from '@/lib/config/appSurface'

const googleVerification = googleSiteVerification()

export const metadata: Metadata = {
  title: {
    default: 'Garmops — Custom Apparel & Bulk Merchandise India',
    template: '%s — Garmops',
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  authors: [{ name: 'Garmops Production Team', url: `${siteConfig.url}/about` }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: 'Custom apparel manufacturing',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
  },
  openGraph: {
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: 'website',
    url: siteConfig.url,
  },
  verification: googleVerification
    ? { google: googleVerification }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const staffSurface = isStaffSurface()

  return (
    <html lang={siteConfig.language} className="font-sans">
      <head>
        <SatoshiFontResources />
      </head>
      <body className="font-sans bg-white text-(--text-primary) antialiased">
        <AppChrome staffSurface={staffSurface}>{children}</AppChrome>
        <AnalyticsPreferences />
      </body>
    </html>
  )
}
