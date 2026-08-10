'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { captureAnalyticsException } from '@/lib/analytics/client'

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    captureAnalyticsException(error)
    console.error(error)
  }, [error])

  return (
    <div className="techpack-canvas flex min-h-[70vh] items-center justify-center px-4 py-12 sm:px-6">
      <section className="techpack-surface w-full max-w-md rounded-[4px] border p-6 text-center sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
          Unexpected error
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          This page could not be loaded
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          Your saved information has not been intentionally changed. Try the
          request again, or return home if the problem continues.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 min-[360px]:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-dark)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-[4px] border border-[var(--color-rule)] px-6 py-3 text-sm font-semibold text-black/65"
          >
            Back to home
          </Link>
        </div>
      </section>
    </div>
  )
}
