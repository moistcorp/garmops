'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function PaymentFailurePage() {
  const searchParams = useSearchParams()
  const txnid = searchParams.get('txnid') ?? ''
  const error = searchParams.get('error') ?? ''

  // Read from localStorage only on client to avoid hydration mismatch
  const [name, setName] = useState('')
  const [retryHref, setRetryHref] = useState('/configurator')
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mf_pending_order')
      if (raw) {
        const o = JSON.parse(raw)
        if (o.name) queueMicrotask(() => setName(o.name.split(' ')[0]))
        if (o.retryHref) queueMicrotask(() => setRetryHref(o.retryHref))
        // Restore configurator to review screen so retry works
        const progress = sessionStorage.getItem('mf_configurator_v2')
        if (progress) {
          const p = JSON.parse(progress)
          p.screen = 'review'
          p.savedAt = Date.now()
          sessionStorage.setItem('mf_configurator_v2', JSON.stringify(p))
        }
      }
    } catch {/* ignore */}
  }, [])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-[#111111] mb-3 tracking-tight">Payment failed</h1>
        <p className="text-[#111111]/60 mb-6 text-sm">
          {name ? `Hi ${name}, we` : 'We'} could not complete your payment.
          {error && <span className="block mt-1 text-xs text-red-500">{error}</span>}
        </p>

        {txnid && (
          <p className="text-xs text-[#111111]/40 mb-6">
            Transaction reference: <span className="font-mono">{txnid}</span>
          </p>
        )}

        {/* Important notice */}
        <div className="bg-[var(--color-cream)] border border-[#ECE7DF] rounded-2xl p-4 text-xs text-[#111111]/70 text-left leading-relaxed mb-6">
          <p className="font-semibold mb-1">Important — please read before retrying</p>
          <p>
            If an amount was deducted from your bank account, <strong>do not retry payment</strong>.
            Bank transactions can take up to <strong>6 hours</strong> to sync with our records.
            If the deduction does not reflect as a successful booking within 6 hours, contact us at{' '}
            <a href="mailto:hello@garmops.com" className="underline font-medium">hello@garmops.com</a>
            {' '}and we will resolve it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href={retryHref}
            className="w-full bg-[var(--color-teal)] text-white py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Retry payment
          </Link>

          <Link href="/"
            className="w-full border border-[var(--color-teal)] text-[var(--color-teal)] py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal)] hover:text-white transition-colors flex items-center justify-center">
            Back to home
          </Link>

          <a href="mailto:hello@garmops.com"
            className="text-xs text-[#111111]/40 hover:text-[#111111] transition-colors mt-1">
            Need help? Email us →
          </a>
        </div>
      </div>
    </div>
  )
}
