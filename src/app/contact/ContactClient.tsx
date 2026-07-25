'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function ContactClient() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', type: '', message: '' })

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, type: 'contact' })
    })
    setSubmitted(true)
  }

  const inputClass = "border border-[#E5E5E5] bg-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"

  return (
    <>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs text-[#111111]/40 font-medium mb-4 tracking-widest uppercase">Get in touch</p>
        <h1 className="text-5xl font-bold text-[#111111] max-w-xl leading-tight mb-6 tracking-tight">
          Tell us about your project
        </h1>
        <p className="text-[#111111]/50 max-w-lg text-lg">
          Fill in the form and we&apos;ll get back to you with a quote within 24 hours.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24 grid md:grid-cols-2 gap-16">
        <div>
          {submitted ? (
            <div className="bg-[var(--color-navy)] text-white rounded-3xl p-10">
              <h2 className="text-2xl font-bold mb-2">We&apos;ve got your request.</h2>
              <p className="text-white/50 text-sm">Our team will reach out within 24 hours with a detailed quote.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Full name *</label>
                  <input name="name" required onChange={handle} className={inputClass} placeholder="Rahul Sharma" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Company *</label>
                  <input name="company" required onChange={handle} className={inputClass} placeholder="Your Brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Email *</label>
                  <input name="email" type="email" required onChange={handle} className={inputClass} placeholder="you@company.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Phone</label>
                  <input name="phone" onChange={handle} className={inputClass} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">What are you looking for? *</label>
                <select name="type" required onChange={handle} className={inputClass}>
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
                <label className="text-xs font-medium text-[#111111]/60 uppercase tracking-wide">Tell us more</label>
                <textarea name="message" rows={5} onChange={handle} className={`${inputClass} resize-none`}
                  placeholder="Quantity, timeline, any specific requirements..." />
              </div>
              <button type="submit" className="bg-[var(--color-teal)] text-white px-6 py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors">
                Submit request
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-10 pt-2">
          {[
            { label: 'Location', content: ' Moist Corp\nGreater Noida, Uttar Pradesh\nIndia' },
            { label: 'Email', content: 'hello@garmops.com', isEmail: true },
            { label: 'MOQ & Turnaround', content: '50 pieces minimum. 35-day standard production. Rush available on request.' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs font-medium text-[#111111]/40 mb-2 uppercase tracking-widest">{item.label}</p>
              {item.isEmail ? (
                <a href={`mailto:${item.content}`} className="text-sm text-[#111111] hover:underline">{item.content}</a>
              ) : (
                <p className="text-sm text-[#111111]/60 leading-relaxed whitespace-pre-line">{item.content}</p>
              )}
            </div>
          ))}
          <div>
            <p className="text-xs font-medium text-[#111111]/40 mb-2 uppercase tracking-widest">Or start directly</p>
            <Link href="/configurator" className="inline-block border border-[var(--color-teal)] text-[var(--color-teal)] px-5 py-2.5 rounded-full text-sm hover:bg-[var(--color-teal)] hover:text-white transition-colors">
              Open the configurator
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
