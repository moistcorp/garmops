'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function HomeMobileCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('homepage-hero')
    const finalCta = document.getElementById('homepage-final-cta')
    if (!hero || !finalCta) return

    let frame: number | null = null
    const updateVisibility = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        const heroPast = hero.getBoundingClientRect().bottom <= 0
        const finalReached = finalCta.getBoundingClientRect().top <= window.innerHeight
        setVisible(heroPast && !finalReached)
      })
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)

    return () => {
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      data-testid="mobile-home-cta"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-(--color-rule) bg-(--color-cream)/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-[opacity,transform] duration-200 sm:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-(--text-muted)">From 50 pieces</p>
          <p className="mt-0.5 text-xs text-(--text-primary)/70">Build your order online</p>
        </div>
        <Link
          href="/configurator"
          tabIndex={visible ? 0 : -1}
          className="shrink-0 rounded-sm bg-(--color-accent) px-5 py-3 text-sm font-medium text-white hover:bg-(--color-accent-dark)"
        >
          Start designing
        </Link>
      </div>
    </div>
  )
}
