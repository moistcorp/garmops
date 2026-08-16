import type { LandingPageStep } from '@/lib/landingPages'

export default function ProcessSteps({
  title,
  introduction,
  steps,
}: {
  title: string
  introduction?: string
  steps: LandingPageStep[]
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-(--text-muted)">Process</p>
        <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">{title}</h2>
        {introduction && <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">{introduction}</p>}
      </div>
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="techpack-panel grid grid-cols-[auto_1fr] gap-4 rounded-sm border p-5 sm:p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-(--color-accent) text-xs font-semibold text-white">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-base font-semibold text-(--text-primary)">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
