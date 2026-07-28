export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="app-liquid-bg flex min-h-[60vh] items-center justify-center px-4 sm:px-6">
      <div className="liquid-glass-surface flex flex-col items-center gap-4 rounded-[24px] border px-8 py-7 sm:rounded-[28px] sm:px-10 sm:py-8">
        <div aria-hidden="true" className="w-6 h-6 border-2 border-[#111111]/20 border-t-[var(--color-teal)] rounded-full animate-spin" />
        <p className="text-xs text-[#111111]/40 uppercase tracking-widest">Loading</p>
      </div>
    </div>
  )
}
