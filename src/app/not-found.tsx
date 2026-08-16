import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="techpack-surface max-w-md rounded-sm border p-6 text-center sm:rounded-sm sm:p-10">
        <p className="mb-6 text-7xl font-bold leading-none text-(--text-primary)/8 sm:text-8xl">404</p>
        <h1 className="text-3xl font-bold text-(--text-primary) mb-3 tracking-tight">Page not found</h1>
        <p className="text-(--text-muted) text-sm mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col justify-center gap-3 min-[360px]:flex-row">
          <Link href="/" className="rounded-sm bg-(--color-accent) px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-(--color-accent-dark)">
            Back to home
          </Link>
          <Link href="/products" className="rounded-sm border border-(--color-accent) px-6 py-3 text-sm font-medium text-(--color-accent) transition-colors hover:bg-(--color-accent) hover:text-white">
            View products
          </Link>
        </div>
      </div>
    </div>
  )
}
