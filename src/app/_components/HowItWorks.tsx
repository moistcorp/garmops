'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

const STEP_DURATION = 5000

const steps = [
  {
    number: '1',
    title: 'Select a product',
    body: 'Made in India in the same factories as leading fashion brands, our garments and accessories have unmatched quality and fit.',
    image: '/images/how-it-works-1.webp',
  },
  {
    number: '2',
    title: 'Customise it',
    body: 'Explore the Garmops, a real-time merch platform that allows you to choose from +2500 colours, numerous embellishments and printing techniques. Top it off with your brands woven label.',
    image: '/images/how-it-works-2.webp',
  },
  {
    number: '3',
    title: 'Place your order',
    body: 'Review the order details and place your order. Our team will review it and given the OK, your new merch will arrive at your doorstep in 18 Days.',
    image: '/images/how-it-works-3.webp',
  },
]

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const isUserScrolling = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTimeRef.current = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const pct = Math.min((elapsed / STEP_DURATION) * 100, 100)
      setProgress(pct)

      if (elapsed >= STEP_DURATION) {
        startTimeRef.current = Date.now()
        setProgress(0)
        setActive(prev => (prev + 1) % steps.length)
      }
    }, 16)
  }, [])

  useEffect(() => {
    startTimer()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [startTimer])

  useEffect(() => {
    if (!isMobile || isUserScrolling.current) return
    const card = cardRefs.current[active]
    const container = scrollRef.current
    if (!card || !container) return
    container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
  }, [active, isMobile])

  const handleScrollEnd = () => {
    const container = scrollRef.current
    if (!container) return
    isUserScrolling.current = false
    const scrollLeft = container.scrollLeft
    let closest = 0
    let minDist = Infinity
    cardRefs.current.forEach((card, i) => {
      if (!card) return
      const dist = Math.abs(card.offsetLeft - scrollLeft)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    if (closest !== active) {
      setActive(closest)
      setProgress(0)
      startTimer()
    }
  }

  return (
    <section className="py-20 bg-white">

      {/* Header — always inside max-w container */}
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <p className="text-xs text-[#595959] font-medium mb-4 tracking-widest uppercase">How it works</p>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h2 className="text-4xl font-bold text-[#111111] tracking-tight leading-tight">
            Launch your merch<br />project today.
          </h2>
          <Link
            href="/configurator"
            className="text-sm font-medium text-[#111111] underline underline-offset-4 hover:opacity-50 transition-opacity whitespace-nowrap"
          >
            Start designing →
          </Link>
        </div>
      </div>

      {/* MOBILE — outside max-w, goes full viewport width */}
      {isMobile && (
        <div
          ref={scrollRef}
          onScrollCapture={() => { isUserScrolling.current = true }}
          onScrollEnd={handleScrollEnd}
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            paddingLeft: '24px',
            paddingBottom: '16px',
            width: '100vw',
            scrollPaddingLeft: '24px',
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              ref={el => { cardRefs.current[i] = el }}
              style={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                width: '85vw',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Text */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#666666' }}>{step.number}.</span>
                  <span style={{ fontSize: '19px', fontWeight: 700, color: '#111111', lineHeight: 1.2 }}>{step.title}</span>
                </div>
                <div style={{ height: '1px', background: '#E5E5E5', marginBottom: '10px', overflow: 'hidden' }}>
                  {active === i && (
                    <div style={{ height: '100%', background: 'var(--color-teal)', width: `${progress}%` }} />
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#4a4a4a', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
              </div>
              {/* Image */}
              <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#F7F7F7',
                flexShrink: 0,
              }}>
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="85vw"
                  priority={i === 0}
                />
              </div>
            </div>
          ))}
          {/* Trailing spacer so last card doesn't sit flush right */}
          <div style={{ flexShrink: 0, width: '24px' }} />
        </div>
      )}

      {/* DESKTOP — inside max-w container */}
      {!isMobile && (
        <div className="max-w-7xl mx-auto px-6">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
            <div>
              {steps.map((step, i) => {
                const isActive = active === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActive(i); setProgress(0); startTimer() }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '28px 0',
                      display: 'block',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? 'var(--color-teal)' : '#666666' }}>
                        {step.number}.
                      </span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: isActive ? 'var(--color-teal)' : '#555555', lineHeight: 1.2 }}>
                        {step.title}
                      </span>
                    </div>
                    <div style={{ overflow: 'hidden', maxHeight: isActive ? '160px' : '0px', opacity: isActive ? 1 : 0, transition: 'max-height 0.3s ease, opacity 0.3s ease' }}>
                      <p style={{ fontSize: '14px', color: '#4a4a4a', lineHeight: 1.6, paddingLeft: '20px', paddingBottom: '16px' }}>
                        {step.body}
                      </p>
                    </div>
                    <div style={{ height: '1px', background: '#E5E5E5', marginTop: '4px', overflow: 'hidden' }}>
                      {isActive && <div style={{ height: '100%', background: 'var(--color-teal)', width: `${progress}%` }} />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: '16px', overflow: 'hidden' }}>
              {steps.map((step, i) => (
                <div key={i} style={{ position: 'absolute', inset: 0, opacity: active === i ? 1 : 0, transition: 'opacity 0.7s ease' }}>
                  <Image src={step.image} alt={step.title} fill style={{ objectFit: 'cover' }} sizes="50vw" priority={i === 0} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </section>
  )
}