import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import ContactClient from './ContactClient'

export const metadata: Metadata = generateMeta({
  title: 'Contact Us',
  description: 'Get in touch with Garmops for premium merch for your brand. Final quote within 24 hours. MOQ 50 pieces.',
  path: '/contact',
})

export default function ContactPage() {
  return <ContactClient />
}