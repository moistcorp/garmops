'use client'
import { useState, FormEvent } from 'react'

// Replace with your Formspree form ID after creating a free form at https://formspree.io
// Example: 'https://formspree.io/f/xyzabc12'
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mnqvkwqj'

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
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-xl mx-auto flex flex-col items-center text-center gap-5">
          <p className="text-xs text-[#595959] font-medium tracking-widest uppercase">Stay in the loop</p>
          <h2 className="text-3xl font-bold text-[#111111] tracking-tight">Get updates in your inbox</h2>
          <p className="text-[#4a4a4a] text-sm leading-relaxed max-w-sm">
            Occasional notes on new products, pricing changes, and case studies. No spam.
          </p>

          <div className="w-full mt-2">
            {status === 'success' ? (
              <p className="text-sm font-medium text-[#111111] border-b border-[#111111] pb-3 inline-block">
                Thanks — you're on the list.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center gap-4 border-b border-[#111111] pb-3 max-w-sm mx-auto">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-label="Email address"
                  className="flex-1 bg-transparent text-base font-medium text-[#111111] placeholder:text-[#B5B5B5] focus:outline-none py-1 min-w-0 text-center"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="text-sm font-medium text-[#111111] underline underline-offset-4 hover:text-[#595959] transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {status === 'loading' ? 'Submitting…' : 'Subscribe'}
                </button>
              </form>
            )}
            {status === 'error' && (
              <p className="text-xs text-red-600 mt-3">Something went wrong — please try again.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}