import type { LandingPageUseCase } from '@/lib/landingPages'

export default function UseCaseGrid({
  title,
  introduction,
  useCases,
}: {
  title: string
  introduction?: string
  useCases: LandingPageUseCase[]
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#111111]/45">Applications</p>
          <h2 className="text-3xl font-bold tracking-tight text-[#111111] sm:text-4xl">{title}</h2>
          {introduction && <p className="mt-4 text-sm leading-7 text-[#3f3f3f] sm:text-base">{introduction}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {useCases.map(useCase => (
            <article key={useCase.title} className="liquid-glass-panel rounded-[4px] border p-5">
              <h3 className="text-sm font-semibold text-[#111111]">{useCase.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{useCase.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
