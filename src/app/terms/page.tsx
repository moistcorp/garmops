import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Terms of Service',
  description: 'Terms that apply when you use Garmops customer accounts, quotes and ordering tools.',
  path: '/terms',
})

const sections = [
  {
    title: '1. About these terms',
    paragraphs: [
      'These Terms of Service apply to your use of the Garmops website, customer account, product catalogue, configurator, quote requests and ordering tools. Garmops is operated by Moist Corp from Greater Noida, Uttar Pradesh, India.',
      'By creating an account or using these services, you agree to these terms. If you use Garmops on behalf of a business, you confirm that you have authority to bind that business.',
    ],
  },
  {
    title: '2. Customer accounts',
    paragraphs: [
      'You must provide accurate information and keep your account credentials secure. You are responsible for activity carried out through your account and must tell us promptly if you believe it has been accessed without permission.',
      'Accounts are intended for business customers and their authorised representatives. We may suspend or close an account if information is materially inaccurate, the account is misused, or continued access creates a security or legal risk.',
    ],
  },
  {
    title: '3. Products, quotes and orders',
    paragraphs: [
      'Product images, colours, measurements, production times and prices shown online are provided for guidance and may change. A quote is an estimate until Garmops confirms the final specification, price, taxes, delivery details and payment terms in writing.',
      'An order becomes binding when the final commercial terms are accepted and any required payment or reservation amount is received. The applicable order confirmation and terms for that order take priority over general website information.',
      'Production depends on the approved artwork, garment specification, quantities and delivery information supplied by you. You are responsible for checking those details before approval.',
    ],
  },
  {
    title: '4. Customer materials',
    paragraphs: [
      'You retain ownership of artwork, logos, names and other materials you submit. You give Garmops permission to use those materials only as needed to quote, prepare, manufacture, deliver and support your order.',
      'You confirm that you have the rights and permissions needed for submitted materials and that they do not infringe another person’s rights or violate applicable law. You must not upload unlawful, harmful or malicious content.',
    ],
  },
  {
    title: '5. Website use and intellectual property',
    paragraphs: [
      'Garmops and its licensors own the website, software, design, text, branding and other platform content. You may use the platform for its intended business purpose, but must not copy, scrape, reverse engineer, interfere with, or attempt to gain unauthorised access to it.',
    ],
  },
  {
    title: '6. Disclaimers and liability',
    paragraphs: [
      'We work to keep the platform accurate and available, but do not promise that it will always be uninterrupted, error-free or suitable for every purpose. Nothing in these terms excludes a responsibility that cannot legally be excluded.',
      'To the extent permitted by law, Garmops is not liable for indirect, incidental or consequential loss arising from use of the platform. Our total liability relating to a particular order is limited to the amount paid for that order, except where applicable law requires otherwise.',
    ],
  },
  {
    title: '7. Changes and governing law',
    paragraphs: [
      'We may update these terms when our services or legal obligations change. We will publish the updated version on this page and update the effective date. Continued use after an update means you accept the revised terms.',
      'These terms are governed by the laws of India. Subject to applicable law, courts in Uttar Pradesh will have jurisdiction over disputes relating to these terms.',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="techpack-canvas">
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#111111]/40">Legal</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#111111] sm:text-5xl">Terms of Service</h1>
        <p className="mt-4 text-sm text-[#111111]/50">Effective 29 July 2026</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[#111111]/65 sm:mt-14">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-xl font-bold tracking-tight text-[#111111]">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-[var(--color-rule)] pt-6 text-sm leading-7 text-[#111111]/65">
          Questions about these terms? Contact <a href="mailto:hello@garmops.com" className="text-[var(--color-accent)] hover:underline">hello@garmops.com</a>.
        </p>
      </section>
    </div>
  )
}
