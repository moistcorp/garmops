import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="app-liquid-bg flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="liquid-glass-surface max-w-md rounded-[26px] border p-6 text-center sm:rounded-[30px] sm:p-10">
        <p className="mb-6 text-7xl font-bold leading-none text-[#111111]/8 sm:text-8xl">404</p>
        <h1 className="text-3xl font-bold text-[#111111] mb-3 tracking-tight">Page not found</h1>
        <p className="text-[#111111]/50 text-sm mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col justify-center gap-3 min-[360px]:flex-row">
          <Link href="/" className="rounded-full bg-[var(--color-teal)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-teal-dark)]">
            Back to home
          </Link>
          <Link href="/products" className="rounded-full border border-[var(--color-teal)] px-6 py-3 text-sm font-medium text-[var(--color-teal)] transition-colors hover:bg-[var(--color-teal)] hover:text-white">
            View products
          </Link>
        </div>
      </div>
    </div>
  )
}
