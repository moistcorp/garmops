import Link from 'next/link'
import type { LandingPageLink } from '@/lib/landingPages'

function LinkGroup({ title, links }: { title: string; links: LandingPageLink[] }) {
  return (
    <div className="techpack-panel rounded-[4px] border p-6 sm:p-8">
      <h3 className="text-lg font-semibold text-[#111111]">{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm leading-6 text-[var(--color-accent-dark)] underline decoration-[var(--color-accent)]/35 underline-offset-4 hover:decoration-current"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RelatedGuides({
  guides,
  pages,
}: {
  guides: LandingPageLink[]
  pages: LandingPageLink[]
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <h2 className="text-3xl font-bold tracking-tight text-[#111111] sm:text-4xl">Continue planning</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <LinkGroup title="Buyer and production guides" links={guides} />
        <LinkGroup title="Related products and solutions" links={pages} />
      </div>
    </section>
  )
}
