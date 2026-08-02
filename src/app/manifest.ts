import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Garmops — Custom Apparel & Bulk Merchandise',
    short_name: 'Garmops',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#1d49b4',
    icons: [
      {
        src: '/icon.png',
        sizes: '256x256',
        type: 'image/png',
      },
    ],
  }
}
