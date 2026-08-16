const techniques = [
  {
    key: 'screen-printing' as const,
    name: 'Screen Print',
    description: 'Best suited to bold artwork and repeat bulk production where controlled solid colours are important.',
    goodFor: 'Logos · Typography · Larger graphics',
  },
  {
    key: 'dtf' as const,
    name: 'DTF',
    description: 'Useful for detailed, multi-colour artwork where screen separations are less practical.',
    goodFor: 'Detailed graphics · Multi-colour artwork',
  },
  {
    key: 'reflective-print' as const,
    name: 'Reflective Print',
    description: 'A speciality finish designed to reflect direct light and create a high-visibility visual effect.',
    goodFor: 'Statement graphics · Night-time effects',
  },
]

export default function IndustryPrintTechniques({
  introduction,
  notes,
}: {
  introduction: string
  notes: Partial<Record<(typeof techniques)[number]['key'], string>>
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-3xl">
        <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-(--text-muted)">
          Print finish
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-(--text-primary) sm:text-4xl">Choose your print finish</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3f3f3f] sm:text-base">{introduction}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {techniques.map(technique => (
          <article key={technique.key} className="techpack-panel rounded-sm border p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-(--text-primary)">{technique.name}</h3>
            <p className="mt-3 text-sm leading-6 text-[#3f3f3f]">{technique.description}</p>
            <p className="mt-4 border-t border-(--color-rule) pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-muted)">
              Good for
            </p>
            <p className="mt-1 text-sm font-medium text-(--text-primary)">{technique.goodFor}</p>
            {notes[technique.key] && (
              <p className="mt-4 rounded-sm bg-(--color-cream-soft) px-4 py-3 text-xs leading-5 text-(--text-primary)/65">
                {notes[technique.key]}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
