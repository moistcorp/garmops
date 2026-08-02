import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="techpack-surface max-w-md rounded-[4px] border p-6 text-center sm:rounded-[4px] sm:p-10">
        <p className="mb-6 text-7xl font-bold leading-none text-[var(--text-primary)]/8 sm:text-8xl">404</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">Page not found</h1>
        <p className="text-[var(--text-primary)]/50 text-sm mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col justify-center gap-3 min-[360px]:flex-row">
          <Link href="/" className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)]">
            Back to home
          </Link>
          <Link href="/products" className="rounded-[4px] border border-[var(--color-accent)] px-6 py-3 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-white">
            View products
          </Link>
        </div>
      </div>
    </div>
  )
}
