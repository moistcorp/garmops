import type { LandingPageFaq } from '@/lib/landingPages'

export default function FaqSection({ faqs }: { faqs: LandingPageFaq[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-primary)]/45">FAQ</p>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">Questions buyers ask before approval</h2>
      </div>
      <dl className="mt-8 grid gap-4">
        {faqs.map(faq => (
          <div key={faq.question} className="techpack-panel grid gap-3 rounded-[4px] border p-5 sm:p-6 md:grid-cols-2 md:gap-8">
            <dt className="text-sm font-semibold leading-6 text-[var(--text-primary)]">{faq.question}</dt>
            <dd className="text-sm leading-6 text-[#3f3f3f]">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
