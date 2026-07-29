'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export default function LandingTrackedLink({
  href,
  page,
  event,
  label,
  className,
  children,
}: {
  href: string
  page: string
  event: 'seo_landing_cta_click' | 'seo_landing_product_click'
  label: string
  className?: string
  children: ReactNode
}) {
  function trackClick() {
    const payload = {
      event,
      page,
      cta: label,
      destination: href,
    }

    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push(payload)
    window.dispatchEvent(new CustomEvent('garmops:analytics', { detail: payload }))
  }

  return (
    <Link href={href} className={className} onClick={trackClick}>
      {children}
    </Link>
  )
}
