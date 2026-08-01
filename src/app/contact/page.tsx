import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'
import ContactClient from './ContactClient'

export const metadata: Metadata = generateMeta({
  title: 'Help & Support',
  description: 'Contact Garmops for sales enquiries and customer support.',
  path: '/contact',
  keywords: [
    'Garmops help',
    'custom apparel customer support',
    'Garmops contact',
  ],
})

export default function ContactPage() {
  return <ContactClient />
}
