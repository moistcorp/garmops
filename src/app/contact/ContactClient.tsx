import { Mail, MapPin, Phone, Plus } from 'lucide-react'

const helpOptions = [
  {
    title: 'Call us for queries',
    icon: Phone,
    content: (
      <>
        <a href="tel:+918800711169" className="transition-colors hover:text-[var(--color-accent)]">Helpdesk: +91 88007 11169</a>
        <p className="mt-2">Mon – Sat: 10:00 AM – 7:00 PM</p>
      </>
    ),
  },
  {
    title: 'Email us',
    icon: Mail,
    content: (
      <>
        <p>Sales enquiries and customer support:</p>
        <a href="mailto:hello@garmops.com" className="mt-2 inline-block transition-colors hover:text-[var(--color-accent)]">hello@garmops.com</a>
      </>
    ),
  },
  {
    title: 'Postal address',
    icon: MapPin,
    content: (
      <>
        <p>Moist Corp</p>
        <address className="mt-2 not-italic">Q5, Surajpur Industrial Area, Site-5, Kasna, Greater Noida, UP, India</address>
      </>
    ),
  },
]

const faqs = [
  {
    question: 'How do I place an order?',
    answer: 'Start with the configurator, choose your garment and add your design. Once you submit the order details, we will guide you through the next steps.',
  },
  {
    question: 'What is the minimum order quantity?',
    answer: 'Our usual minimum is 50 pieces per style. The final quantity can depend on the garment and decoration technique you choose.',
  },
  {
    question: 'Will I see my design before production?',
    answer: 'For custom orders, artwork and production details are reviewed before production begins. Any action needed from you will appear with your order updates.',
  },
  {
    question: 'How can I check my order status?',
    answer: 'Sign in and open My orders to see the latest status, payment information, delivery details, files, and messages for your order.',
  },
  {
    question: 'When will my order be delivered?',
    answer: 'Delivery timing depends on the product, quantity, artwork, and your requested date. Your order page will show the relevant delivery updates when available.',
  },
  {
    question: 'Can I get an invoice for my order?',
    answer: 'Yes. When your invoice is ready, it will be available to download from the relevant order in My orders.',
  },
]

export default function ContactClient() {
  return (
    <main className="techpack-canvas">
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">Help</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--color-navy)] sm:text-5xl">How can we help?</h1>
          <p className="mt-4 text-base leading-relaxed text-[#111111]/55 sm:text-lg">Get in touch with the Garmops team for sales enquiries and order support.</p>
        </div>

        <div className="mt-14 grid gap-10 border-y border-[#ECE7DF] py-10 text-center sm:mt-16 sm:py-14 md:grid-cols-3 md:gap-8">
          {helpOptions.map(({ title, icon: Icon, content }) => (
            <section key={title} className="mx-auto flex max-w-sm flex-col items-center">
              <span className="flex size-12 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-white text-[var(--color-accent)]">
                <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-[var(--color-navy)]">{title}</h2>
              <div className="mt-3 text-base leading-relaxed text-[#111111]/55">{content}</div>
            </section>
          ))}
        </div>

        <section className="mt-16 sm:mt-20" aria-labelledby="help-faq-heading">
          <div className="text-center">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">FAQ</p>
            <h2 id="help-faq-heading" className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-navy)] sm:text-4xl">Frequently asked questions</h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2 md:gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group border border-[#ECE7DF] bg-white">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-[var(--color-navy)] marker:content-none sm:px-6">
                  {faq.question}
                  <Plus size={20} className="shrink-0 text-[var(--color-accent)] transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="border-t border-[#ECE7DF] px-5 py-4 text-sm leading-relaxed text-[#111111]/55 sm:px-6">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
