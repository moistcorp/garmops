'use client'
import Link from 'next/link'
import { useState } from 'react'
import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from '@/lib/pricing'
import TurnstileWidget from '@/components/auth/TurnstileWidget'

export default function ContactClient() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const protectedContactEnabled =
    process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true'
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', type: '', message: '' })

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          company: form.company,
          email: form.email,
          phone: form.phone,
          type: 'contact',
          enquiryType: form.type,
          message: form.message,
          turnstileToken: protectedContactEnabled ? turnstileToken : undefined,
        })
      })
      if (!response.ok) throw new Error('Request failed')
      let sourcePage = 'direct'
      try {
        sourcePage = document.referrer ? new URL(document.referrer).pathname : 'direct'
      } catch {
        sourcePage = 'unknown'
      }
      const analyticsPayload = {
        event: 'contact_submission',
        source_page: sourcePage,
      }
      window.dataLayer = window.dataLayer ?? []
      window.dataLayer.push(analyticsPayload)
      window.dispatchEvent(new CustomEvent('garmops:analytics', { detail: analyticsPayload }))
      setSubmitted(true)
    } catch {
      setSubmitError('We could not send your request. Please try again or email hello@garmops.com.')
      setTurnstileReset(Date.now())
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "liquid-glass-control border px-4 py-3 rounded-xl text-sm focus:outline-none focus:!border-[var(--color-teal)] transition-colors"

  return (
    <div className="app-liquid-bg">
      <section className="max-w-7xl mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-16 sm:pt-20">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Get in touch</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">
          Tell us about your custom apparel project
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-[#111111]/50 sm:text-lg">
          Fill in the form and we&apos;ll get back to you with a quote within 24 hours.
        </p>
      </section>

      <section className="max-w-7xl mx-auto grid gap-10 px-4 pb-16 sm:px-6 sm:pb-24 md:grid-cols-2 md:gap-16">
        <div>
          {submitted ? (
            <div role="status" className="liquid-glass-dark rounded-3xl border p-6 text-white sm:p-10">
              <h2 className="text-2xl font-bold mb-2">We&apos;ve got your request.</h2>
              <p className="text-white/50 text-sm">Our team will reach out within 24 hours with a detailed quote.</p>
            </div>
          ) : (
            <form onSubmit={submit} aria-busy={submitting} className="liquid-glass-surface flex flex-col gap-4 rounded-[30px] border p-5 sm:p-7">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-name" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Full name *</label>
                  <input id="contact-name" name="name" autoComplete="name" maxLength={120} required onChange={handle} className={inputClass} placeholder="Rahul Sharma" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-company" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Company *</label>
                  <input id="contact-company" name="company" autoComplete="organization" maxLength={120} required onChange={handle} className={inputClass} placeholder="Your Brand" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-email" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Email *</label>
                  <input id="contact-email" name="email" type="email" autoComplete="email" maxLength={320} required onChange={handle} className={inputClass} placeholder="you@company.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-phone" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Phone</label>
                  <input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} onChange={handle} className={inputClass} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-type" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">What are you looking for? *</label>
                <select id="contact-type" name="type" required onChange={handle} className={inputClass}>
                  <option value="">Select an option</option>
                  <option>T-shirts</option>
                  <option>Hoodies / Sweatshirts</option>
                  <option>Longsleeves</option>
                  <option>Tote bags</option>
                  <option>Mixed / Multiple products</option>
                  <option>Not sure yet</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-message" className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Tell us more</label>
                <textarea id="contact-message" name="message" rows={5} maxLength={2000} onChange={handle} className={`${inputClass} resize-none`}
                  placeholder="Quantity, timeline, any specific requirements..." />
              </div>
              {protectedContactEnabled && (
                <TurnstileWidget
                  action="contact"
                  resetToken={turnstileReset}
                  onToken={setTurnstileToken}
                />
              )}
              {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
              <button type="submit" disabled={submitting || (protectedContactEnabled && !turnstileToken)} className="bg-[var(--color-teal)] text-white px-6 py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Sending…' : 'Submit request'}
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-2 sm:gap-6 md:gap-10">
          {[
            { label: 'Location', content: 'Moist Corp\nGreater Noida, Uttar Pradesh\nIndia' },
            { label: 'Email', content: 'hello@garmops.com', isEmail: true },
            { label: 'MOQ & Turnaround', content: `50 pieces minimum. ${DELIVERY_DAYS}-day standard production. ${RUSH_DELIVERY_DAYS}-day rush production available.` },
          ].map(item => (
            <div key={item.label} className="liquid-glass-panel rounded-2xl border p-5">
              <p className="text-xs font-medium text-[#111111]/40 mb-2 uppercase tracking-widest">{item.label}</p>
              {item.isEmail ? (
                <a href={`mailto:${item.content}`} className="text-sm text-[#111111] hover:underline">{item.content}</a>
              ) : (
                <p className="text-sm text-[#111111]/60 leading-relaxed whitespace-pre-line">{item.content}</p>
              )}
            </div>
          ))}
          <div className="liquid-glass-panel rounded-2xl border p-5">
            <p className="text-xs font-medium text-[#111111]/40 mb-2 uppercase tracking-widest">Or start directly</p>
            <Link href="/configurator" className="inline-block border border-[var(--color-teal)] text-[var(--color-teal)] px-5 py-2.5 rounded-full text-sm hover:bg-[var(--color-teal)] hover:text-white transition-colors">
              Open the configurator
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
