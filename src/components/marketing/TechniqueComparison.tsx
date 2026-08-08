const techniques = {
  'screen-printing': {
    title: 'Screen printing',
    description: 'A strong starting point for repeat bulk artwork with controlled solid colours. Each colour and position adds setup.',
  },
  dtf: {
    title: 'DTF',
    description: 'Supports detailed multi-colour transfers across compatible fabrics, with a transfer layer that changes the hand feel.',
  },
  'reflective-print': {
    title: 'Reflective Print',
    description: 'A light-reactive speciality finish for artwork that needs a high-visibility visual effect.',
  },
} as const

export default function TechniqueComparison({
  techniqueKeys,
}: {
  techniqueKeys: Array<keyof typeof techniques>
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-primary)]/45">Decoration</p>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Print technique choices
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">
          The right method depends on the artwork, colour count, physical size, order quantity, garment fabric and colour, desired finish and budget.
        </p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {techniqueKeys.map(key => (
          <article key={key} className="techpack-panel rounded-[4px] border p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{techniques[key].title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#3f3f3f]">{techniques[key].description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
