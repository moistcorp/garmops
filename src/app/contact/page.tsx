import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import ContactClient from './ContactClient'

export const metadata: Metadata = generateMeta({
  title: 'Get a Custom Apparel Quote',
  description: 'Tell Garmops about your custom T-shirt, hoodie, polo or merchandise project. Get a production-ready quote within 24 hours. MOQ 50 pieces.',
  path: '/contact',
  keywords: [
    'custom apparel quote India',
    'bulk T-shirt quote',
    'custom merchandise supplier contact',
  ],
})

export default function ContactPage() {
  return <ContactClient />
}
