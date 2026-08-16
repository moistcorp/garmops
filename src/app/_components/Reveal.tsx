'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'

/**
 * Wraps content and fades/slides it up into view the first time it
 * scrolls into the viewport. Disconnects after firing once.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const bounds = el.getBoundingClientRect()
    if (bounds.top <= window.innerHeight * 0.92) {
      setVisible(true)
      return
    }

    setVisible(false)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -48px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
