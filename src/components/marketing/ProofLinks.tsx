import Image from 'next/image'
import Link from 'next/link'
import type { CaseStudy } from '@/lib/casestudies'
import { formatCaseStudyProducts, getCaseStudyIndustry } from '@/lib/casestudies'

export default function ProofLinks({ caseStudies }: { caseStudies: CaseStudy[] }) {
  if (caseStudies.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="techpack-panel rounded-sm border p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-(--text-primary) sm:text-3xl">Review relevant production work</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#3f3f3f]">
            Browse documented Garmops projects for product, quantity, decoration and delivery context.
          </p>
          <Link href="/work" className="mt-5 inline-flex text-sm font-medium text-(--color-accent-dark) underline underline-offset-4">
            View all case studies
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-(--text-primary)/45">Documented work</p>
          <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Relevant case studies</h2>
        </div>
        <Link href="/work" className="text-sm font-medium text-(--color-accent-dark) underline underline-offset-4">
          View all work
        </Link>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {caseStudies.map(study => (
          <Link
            key={study.slug}
            href={`/work/${study.slug}`}
            className="techpack-panel group grid overflow-hidden rounded-sm border sm:grid-cols-[0.42fr_0.58fr]"
          >
            <div className="relative aspect-[4/3] min-h-48 overflow-hidden bg-(--color-cream-soft) sm:aspect-auto">
              {study.coverImage && (
                <Image
                  src={study.coverImage}
                  alt={study.gallery?.[0]?.alt ?? `${study.client} project image`}
                  fill
                  sizes="(max-width: 768px) 100vw, 22vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              )}
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-(--text-primary)/45">{getCaseStudyIndustry(study.industryId)?.name ?? study.industryId}</p>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-(--text-primary) group-hover:underline">{study.client}</h3>
              <p className="mt-3 text-sm leading-6 text-[#3f3f3f]">{study.summary}</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-primary)/45">
                {formatCaseStudyProducts(study)} · {study.printTechniques.join(' · ')}{study.totalQuantity ? ` · ${study.totalQuantity} pieces` : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
