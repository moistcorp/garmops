export default function TrustStrip({ points }: { points: string[] }) {
  return (
    <section aria-label="Order facts" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
      <div className="techpack-surface grid overflow-hidden rounded-[4px] border sm:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => (
          <p
            key={point}
            className="border-b border-white/70 px-5 py-4 text-sm font-medium text-[#111111]/65 last:border-b-0 sm:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0"
          >
            {point}
          </p>
        ))}
      </div>
    </section>
  )
}
