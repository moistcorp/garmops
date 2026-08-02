import Link from 'next/link'
import type { LandingPageFeature, LandingPageLink } from '@/lib/landingPages'

export default function FeatureGrid({
  eyebrow,
  title,
  introduction,
  features,
  links,
}: {
  eyebrow?: string
  title: string
  introduction?: string
  features: LandingPageFeature[]
  links?: LandingPageLink[]
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-primary)]/45">
            {eyebrow}
          </p>
        )}
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">{title}</h2>
        {introduction && (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
            {introduction}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="techpack-panel rounded-[4px] border p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{feature.description}</p>
            {feature.link && (
              <Link
                href={feature.link.href}
                className="mt-4 inline-flex text-sm font-medium text-[var(--color-accent-dark)] underline-offset-4 hover:underline"
              >
                {feature.link.label}
              </Link>
            )}
          </article>
        ))}
      </div>

      {links && links.length > 0 && (
        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--color-accent-dark)] underline decoration-[var(--color-accent)]/35 underline-offset-4 hover:decoration-current"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
