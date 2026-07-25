export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div aria-hidden="true" className="w-6 h-6 border-2 border-[#111111]/20 border-t-[var(--color-teal)] rounded-full animate-spin" />
        <p className="text-xs text-[#111111]/40 uppercase tracking-widest">Loading</p>
      </div>
    </div>
  )
}
