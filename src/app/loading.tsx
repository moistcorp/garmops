export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="techpack-canvas flex min-h-[60vh] items-center justify-center px-4 sm:px-6">
      <div className="techpack-surface flex flex-col items-center gap-4 rounded-[4px] border px-8 py-7 sm:rounded-[4px] sm:px-10 sm:py-8">
        <div aria-hidden="true" className="w-6 h-6 border-2 border-[#111111]/20 border-t-[var(--color-accent)] rounded-[4px] animate-spin" />
        <p className="text-xs text-[#111111]/40 uppercase tracking-widest">Loading</p>
      </div>
    </div>
  )
}
