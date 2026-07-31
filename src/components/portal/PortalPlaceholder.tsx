export default function PortalPlaceholder({
  title,
  description,
  metrics,
}: {
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-6">
      {metrics?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="techpack-panel rounded-[4px] border p-5">
              <p className="text-xs uppercase tracking-widest text-black/35">{metric.label}</p>
              <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="techpack-surface rounded-[4px] border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/50">{description}</p>
        <div className="mt-8 rounded-[4px] border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/35">
          The secure workspace is ready. Operational data arrives in its scheduled integration phase.
        </div>
      </div>
    </div>
  );
}
