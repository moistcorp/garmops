'use client'
import { useState, FormEvent } from 'react'

const FORMSPREE_ENDPOINT =
  process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT ?? 'https://formspree.io/f/mnqvkwqj'

export default function EmailCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || status === 'loading') return

    setStatus('loading')
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStatus('success')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="techpack-section">
      <div className="max-w-7xl mx-auto px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-xl mx-auto flex flex-col items-center text-center gap-5">
          <p className="text-xs text-[#595959] font-medium tracking-widest uppercase">Stay in the loop</p>
          <h2 className="text-2xl font-bold tracking-tight text-[#111111] sm:text-3xl">Get updates in your inbox</h2>
          <p className="text-[#4a4a4a] text-sm leading-relaxed max-w-sm">
            Occasional notes on new products, pricing changes, and case studies. No spam.
          </p>

          <div className="w-full mt-2">
            {status === 'success' ? (
              <p
                role="status"
                className="text-sm font-medium text-[var(--color-accent)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 rounded-[4px] px-5 py-3 inline-block"
              >
                Thanks — you&apos;re on the list.
              </p>
            ) : (
              <form
                onSubmit={handleSubmit}
                aria-busy={status === 'loading'}
                className="techpack-surface mx-auto flex max-w-sm items-center gap-2 rounded-[4px] border py-2 pl-4 pr-2 sm:pl-6"
              >
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={320}
                  required
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (status === 'error') setStatus('idle')
                  }}
                  placeholder="you@company.com"
                  aria-label="Email address"
                  className="flex-1 bg-transparent text-sm font-medium text-[#111111] placeholder:text-[#B5B5B5] focus:outline-none py-1.5 min-w-0"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="whitespace-nowrap rounded-[4px] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] disabled:opacity-50 sm:px-5"
                >
                  {status === 'loading' ? 'Submitting…' : 'Subscribe'}
                </button>
              </form>
            )}
            {status === 'error' && (
              <p role="alert" className="text-xs text-red-600 mt-3">
                Something went wrong — please try again.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
