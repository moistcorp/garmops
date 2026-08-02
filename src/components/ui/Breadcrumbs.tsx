import Link from 'next/link'

type Crumb = { label: string; href?: string }

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="scrollbar-hide mb-6 flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 text-xs text-[var(--text-primary)]/40 sm:mb-8">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-[var(--text-primary)] transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-[var(--text-primary)]">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
