import Link from 'next/link'
import { ArrowRight, CircleDollarSign, Mail, MessageCircle, PackageSearch, Phone, Plus, Shirt } from 'lucide-react'
import type { ReactNode } from 'react'

import { CUSTOM_DYE_MOQ_UNITS } from '@/lib/configurator/colourRules'
import { formatGstRate } from '@/lib/tax'
import { products } from '@/lib/products'
import { siteConfig } from '@/lib/seo'

const phoneNumber = siteConfig.phone.replace(/[\s-]/g, '')
const whatsappNumber = siteConfig.phone.replace(/\D/g, '')
const whatsappHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I found Garmops and would like help with a custom apparel order.')}`
  : null
const catalogueMinimum = Math.min(...products.map((product) => product.minimumOrderQuantity))

const intentOptions = [
  {
    number: '01',
    icon: Shirt,
    title: 'Choose a product',
    description: 'Compare garments, fit, fabric weight and intended use.',
    label: 'Explore products',
    href: '/products',
  },
  {
    number: '02',
    icon: CircleDollarSign,
    title: 'Understand pricing',
    description: 'See how garment, quantity and customisation affect your order.',
    label: 'View pricing',
    href: '/pricing',
  },
  {
    number: '03',
    icon: PackageSearch,
    title: 'Track an existing order',
    description: 'View order status, payment and delivery details.',
    label: 'View my orders',
    href: '/account/orders',
  },
  {
    number: '04',
    icon: MessageCircle,
    title: 'Talk to us',
    description: 'Contact Garmops for a requirement that needs human help.',
    label: 'Contact Garmops',
    href: '#contact-garmops',
  },
]

const contactMethods = [
  ...(whatsappHref
    ? [{
        icon: MessageCircle,
        title: 'WhatsApp',
        description: 'Best for quick questions about products, artwork or an existing order.',
        label: 'Chat on WhatsApp',
        href: whatsappHref,
        external: true,
      }]
    : []),
  {
    icon: Phone,
    title: 'Call',
    description: 'Speak with us about a custom requirement or production question.',
    label: `Call ${siteConfig.name}`,
    href: `tel:${phoneNumber}`,
    external: false,
  },
  {
    icon: Mail,
    title: 'Email',
    description: 'Useful for artwork, specifications and detailed requirements.',
    label: 'Email us',
    href: `mailto:${siteConfig.email}`,
    external: false,
  },
]

type FaqItem = {
  question: string
  answer: ReactNode
}

type FaqGroup = {
  title: string
  items: FaqItem[]
}

const faqLinkClass = 'font-semibold text-(--color-accent-dark) underline decoration-(--color-accent)/35 underline-offset-2 transition-colors hover:text-(--color-accent)'

const faqGroups: FaqGroup[] = [
  {
    title: 'Ordering',
    items: [
      {
        question: 'How do I place a custom order?',
        answer: (
          <>
            Choose a product, configure the garment and artwork, add quantities and sizes, review the order, then pay the full merchandise amount through secure PayU checkout. After payment, track progress from{' '}
            <Link href="/account/orders" className={faqLinkClass}>My orders</Link>.
          </>
        ),
      },
      {
        question: 'What is the minimum order quantity?',
        answer: (
          <>
            The current catalogue starts at {catalogueMinimum} pieces per product configuration. The applicable MOQ is checked independently for each cart line, so two separate configurations of the same product must each meet its own minimum. Custom-dye runs currently require {CUSTOM_DYE_MOQ_UNITS} units per colour.
          </>
        ),
      },
      {
        question: 'Can I split my order across sizes?',
        answer: (
          <>
            Yes. Use the size quantity grid in the cart to distribute each configured product line across its available sizes. The line total still needs to meet that product’s MOQ.
          </>
        ),
      },
      {
        question: 'Can I order more than one product in the same order?',
        answer: (
          <>
            Yes. Add multiple configured product lines to the cart, such as T-shirts, hoodies or tote bags. Each line keeps its own configuration, quantity and applicable MOQ.
          </>
        ),
      },
      {
        question: 'Can I order a sample before bulk production?',
        answer: (
          <>
            Yes. Browse the catalogue and order a product sample to check the garment, fabric, construction and fit before starting a custom production order.{' '}
            <Link href="/products" className={faqLinkClass}>Browse products</Link>.
          </>
        ),
      },
    ],
  },
  {
    title: 'Artwork & printing',
    items: [
      {
        question: 'Which print methods do you offer?',
        answer: 'Garmops currently offers Screen Print for solid, repeatable bulk artwork, DTF for detailed multi-colour transfers, and Reflective Print for a light-reactive finish. Suitability depends on the garment, artwork and quantity.',
      },
      {
        question: 'What artwork files can I upload?',
        answer: (
          <>
            The configurator accepts .jpg, .jpeg, .png, .svg and .ai artwork files up to 4.5 MB. It also guides you through print position, size and artwork checks as you configure the product.
          </>
        ),
      },
      {
        question: 'How do I know which print method to choose?',
        answer: (
          <>
            Consider artwork detail, print size and position, garment fabric and colour, quantity, desired finish and budget. Start with the product guidance or{' '}
            <Link href="/configurator" className={faqLinkClass}>open the configurator</Link>; final suitability is reviewed against the complete specification.
          </>
        ),
      },
    ],
  },
  {
    title: 'Payment & pricing',
    items: [
      {
        question: 'How is my order price calculated?',
        answer: (
          <>
            Pricing combines the garment, quantity and volume discount with the choices you make, including artwork positions and technique, colour, custom labels and delivery speed. The{' '}
            <Link href="/pricing" className={faqLinkClass}>pricing page</Link> shows the starting estimate before configuration.
          </>
        ),
      },
      {
        question: 'Is GST included?',
        answer: `Yes. Configurator checkout includes ${formatGstRate()} GST on the configured merchandise and applicable production charges. Shipping is free and included at no additional charge.`,
      },
      {
        question: 'What happens if my payment fails?',
        answer: 'If PayU reports a failed payment, no order is created and you can safely try again. If PayU is still verifying the payment, wait and recheck the status before starting another payment attempt.',
      },
    ],
  },
  {
    title: 'Existing orders',
    items: [
      {
        question: 'Where can I track my order?',
        answer: (
          <>
            Sign in when prompted and open{' '}
            <Link href="/account/orders" className={faqLinkClass}>My orders</Link> to see status, payment, delivery details, files and available order messages.
          </>
        ),
      },
      {
        question: 'Can I change my order after payment?',
        answer: (
          <>
            Contact support as soon as possible. Changes may depend on whether production has started and need to be checked against the order specification.
          </>
        ),
      },
    ],
  },
]

function DirectContactLink({
  href,
  label,
  external,
}: {
  href: string
  label: string
  external: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm border border-(--color-accent) px-3.5 py-2.5 text-sm font-semibold text-(--color-accent-dark) transition-colors hover:bg-(--color-accent)/5"
    >
      {label} <ArrowRight size={15} aria-hidden="true" />
    </a>
  )
}

export default function ContactClient() {
  return (
    <main className="techpack-canvas">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-(--color-accent)">Help</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-(--color-navy) sm:text-5xl">Need a hand?</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-(--text-primary)/60 sm:text-lg">Find the right place to start, or contact us directly.</p>
        </div>

        <section className="mt-12 border-t border-(--color-rule) pt-10 sm:mt-16" aria-labelledby="help-intents-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">Start here</p>
              <h2 id="help-intents-heading" className="mt-2 text-2xl font-bold tracking-tight text-(--color-navy) sm:text-3xl">What do you need help with?</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-(--text-muted)">Choose a product → configure → add quantities and sizes → review → pay → track your order.</p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {intentOptions.map(({ number, icon: Icon, title, description, label, href }) => (
              <article key={title} className="flex min-h-56 flex-col rounded-sm border border-(--color-rule) bg-white p-5 transition-colors hover:border-(--color-accent)/55 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-(--color-accent)">{number}</span>
                  <Icon size={19} strokeWidth={1.8} className="text-(--color-accent)" aria-hidden="true" />
                </div>
                <h3 className="mt-8 text-lg font-semibold tracking-tight text-(--color-navy)">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-(--text-muted)">{description}</p>
                <Link href={href} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-(--color-accent-dark) transition-colors hover:text-(--color-accent)">
                  {label} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="contact-garmops" className="mt-16 scroll-mt-24 border-t border-(--color-rule) pt-10 sm:mt-20" aria-labelledby="contact-heading">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--color-accent)">Direct support</p>
            <h2 id="contact-heading" className="mt-2 text-2xl font-bold tracking-tight text-(--color-navy) sm:text-3xl">Contact Garmops</h2>
            <p className="mt-3 text-sm leading-6 text-(--text-muted)">Choose the channel that suits the question. We are available Monday to Saturday, 10:00 AM–7:00 PM.</p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {contactMethods.map(({ icon: Icon, title, description, label, href, external }) => (
              <article key={title} className="flex min-h-52 flex-col rounded-sm border border-(--color-rule) bg-white p-5 sm:p-6">
                <Icon size={20} strokeWidth={1.8} className="text-(--color-accent)" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-(--color-navy)">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-(--text-muted)">{description}</p>
                <DirectContactLink href={href} label={label} external={external} />
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-(--color-rule) pt-10 sm:mt-20" aria-labelledby="help-faq-heading">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--color-accent)">FAQ</p>
            <h2 id="help-faq-heading" className="mt-2 text-2xl font-bold tracking-tight text-(--color-navy) sm:text-3xl">Frequently asked questions</h2>
            <p className="mt-3 text-sm leading-6 text-(--text-muted)">Short answers for choosing, configuring, paying for and following a Garmops order.</p>
          </div>

          <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-2">
            {faqGroups.map((group) => (
              <section key={group.title} aria-labelledby={`faq-group-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                <h3 id={`faq-group-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="border-b border-(--color-rule) pb-3 text-lg font-semibold tracking-tight text-(--color-navy)">{group.title}</h3>
                <div className="mt-3 divide-y divide-(--color-rule) border-y border-(--color-rule)">
                  {group.items.map((faq) => (
                    <details key={faq.question} className="group">
                      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-semibold text-(--color-navy) marker:content-none">
                        <span>{faq.question}</span>
                        <Plus size={18} className="shrink-0 text-(--color-accent) transition-transform group-open:rotate-45" aria-hidden="true" />
                      </summary>
                      <div className="pb-5 pr-8 text-sm leading-6 text-(--text-primary)/60">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-(--color-rule) pt-10 sm:mt-20" aria-labelledby="business-details-heading">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--color-accent)">Company information</p>
              <h2 id="business-details-heading" className="mt-2 text-2xl font-bold tracking-tight text-(--color-navy) sm:text-3xl">Business details</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-(--text-muted)">Garmops is operated by Moist Corp from Greater Noida, India.</p>
            </div>

            <dl className="grid gap-x-8 gap-y-6 border-t border-(--color-rule) pt-6 sm:grid-cols-2 lg:border-t-0 lg:pt-0">
              <div>
              <dt className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">Legal / business name</dt>
                <dd className="mt-2 text-sm font-semibold text-(--color-navy)">Moist Corp</dd>
              </div>
              <div>
              <dt className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">Address</dt>
                <dd className="mt-2 text-sm leading-6 text-(--text-primary)/65">Q5, Surajpur Industrial Area, Site-5, Kasna, Greater Noida, UP, India</dd>
              </div>
              <div>
              <dt className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">Support email</dt>
                <dd className="mt-2 text-sm"><a href={`mailto:${siteConfig.email}`} className={faqLinkClass}>{siteConfig.email}</a></dd>
              </div>
              <div>
              <dt className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">Phone</dt>
                <dd className="mt-2 text-sm"><a href={`tel:${phoneNumber}`} className={faqLinkClass}>{siteConfig.phone}</a></dd>
              </div>
            </dl>
          </div>
        </section>
      </section>
    </main>
  )
}
