import type { Metadata } from 'next'
import { generateMeta } from '@/lib/seo'

export const metadata: Metadata = generateMeta({
  title: 'Privacy Policy',
  description: 'How Garmops collects, uses and protects information from customer accounts and orders.',
  path: '/privacy',
})

const sections = [
  {
    title: '1. Who we are',
    paragraphs: [
      'This Privacy Policy explains how Garmops, operated by Moist Corp from Greater Noida, Uttar Pradesh, India, handles information collected through garmops.com, customer accounts, quote requests, configurator activity and orders.',
      'For privacy questions or requests, contact us at hello@garmops.com.',
    ],
  },
  {
    title: '2. Information we collect',
    paragraphs: [
      'When you create an account, we collect information such as your name, company name, email address, phone number and password credentials. We do not store your plain-text password.',
      'When you use our services, we collect order and quote details, private artwork and other files you submit, delivery and billing/GST information, payment and invoice references, account activity, and limited operational and security logs.',
      'We may receive limited information from service providers that help us authenticate accounts, prevent abuse, deliver email, process payments or provide hosting and storage.',
    ],
  },
  {
    title: '3. How we use information',
    paragraphs: [
      'We use information to create and secure accounts, respond to enquiries, prepare quotes, process and deliver orders, provide customer support, send service messages, maintain records, prevent fraud and abuse, improve our products and platform, and meet legal or accounting obligations.',
      'We use Cloudflare Turnstile and similar security measures on selected forms to help distinguish legitimate users from automated abuse. These services may process technical information according to their own privacy terms.',
    ],
  },
  {
    title: '4. Sharing and service providers',
    paragraphs: [
      'We use service-provider categories including application hosting, Medusa commerce and authentication, private file storage managed by the commerce backend, PayU payments, and—only after your choice—PostHog product analytics. Optional analytics does not include artwork filenames, contact details, addresses, GSTIN, or payment payloads, and session replay is disabled.',
      'We may also disclose information where necessary to comply with law, respond to lawful requests, protect our rights or safety, investigate abuse, or support a business transfer. We do not sell customer personal information.',
    ],
  },
  {
    title: '5. Retention and security',
    paragraphs: [
      'We keep information for as long as needed for the purposes described here, including account support, order records, dispute handling, tax and accounting requirements, and security. When information is no longer needed, we delete it or retain it only in a de-identified or legally required form.',
      'We use access controls, encryption in transit and other reasonable safeguards. No online service can guarantee absolute security, so please protect your credentials and contact us promptly about suspected unauthorised access.',
    ],
  },
  {
    title: '6. Your choices and requests',
    paragraphs: [
      'You may ask us to access, correct or delete personal information associated with your account, subject to legal and operational limits. You may also ask us to explain how information is used or withdraw consent where processing depends on consent.',
      'Send a request to hello@garmops.com from the email address associated with your account. We may need to verify your identity before completing a request.',
    ],
  },
  {
    title: '7. Cookies and updates',
    paragraphs: [
      'Garmops uses essential storage to keep the site working, remember selected preferences and support ordering. Optional product analytics is off until accepted and can be withdrawn at any time through the Cookie settings link in the site footer.',
      'We may update this policy as our services or legal obligations change. The current version and effective date will always be published on this page.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="techpack-canvas">
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-(--text-primary)/40">Legal</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-(--text-primary) sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-(--text-primary)/50">Effective 29 July 2026</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-(--text-primary)/65 sm:mt-14">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-xl font-bold tracking-tight text-(--text-primary)">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-(--color-rule) pt-6 text-sm leading-7 text-(--text-primary)/65">
          Privacy questions or requests? Contact <a href="mailto:hello@garmops.com" className="text-(--color-accent) hover:underline">hello@garmops.com</a>.
        </p>
      </section>
    </div>
  )
}
