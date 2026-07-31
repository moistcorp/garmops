'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { RUSH_DELIVERY_DAYS } from '@/lib/pricing'

export default function HeroScrollVideo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasStarted = useRef(false)
  const [videoReady, setVideoReady] = useState(false)
  const [useSimpleMedia, setUseSimpleMedia] = useState(false)

  useEffect(() => {
    const updateMediaMode = () => {
      const smallScreen = window.matchMedia('(max-width: 767px)').matches
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setUseSimpleMedia(smallScreen || reducedMotion)
    }

    updateMediaMode()
    window.addEventListener('resize', updateMediaMode)
    return () => window.removeEventListener('resize', updateMediaMode)
  }, [])

  useEffect(() => {
    if (useSimpleMedia) return

    const container = containerRef.current
    const videoWrap = videoWrapRef.current
    const video = videoRef.current
    if (!container || !videoWrap || !video) return

    const handleScroll = () => {
      const rect = container.getBoundingClientRect()
      const scrolled = Math.max(0, -rect.top)
      const scrollable = container.offsetHeight - window.innerHeight
      if (scrollable <= 0) return
      const progress = Math.min(scrolled / scrollable, 1)

      const inset = Math.max(0, 20 * (1 - progress))
      const radius = Math.max(0, 20 * (1 - progress))

      videoWrap.style.inset = `${inset}px`
      videoWrap.style.borderRadius = `${radius}px`

      if (!hasStarted.current && progress > 0.01) {
        hasStarted.current = true
        video.play().catch(() => {})
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [useSimpleMedia])

  return (
    <>
      <section className="app-liquid-bg grid lg:min-h-[90vh] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-12 min-[360px]:px-5 sm:px-8 sm:py-16 md:px-16 lg:py-0">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#595959] sm:mb-6 sm:text-xs sm:tracking-widest">
            Custom apparel manufacturer in India
          </p>
          <h1 className="mb-5 text-[2.5rem] font-bold leading-[1.02] tracking-tight text-[#111111] min-[360px]:text-5xl md:text-6xl lg:text-7xl">
            Custom apparel<br />for your<br /><span className="text-[var(--color-accent)]">business</span>
          </h1>
          <p className="mb-8 max-w-sm text-[15px] leading-relaxed text-[#4a4a4a] sm:mb-10 sm:text-base">
            Premium custom T-shirts, hoodies, polos and branded merchandise, made in India. Design online and order from 50 pieces.
          </p>
          <div className="mb-8 grid grid-cols-3 gap-0 sm:mb-10 sm:flex sm:gap-6">
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-[#111111]">50</p>
              <p className="text-[9px] uppercase leading-tight tracking-normal text-[#595959] min-[360px]:text-[10px] sm:text-xs sm:tracking-wide">Min. pieces</p>
            </div>
            <div className="min-w-0 border-l border-[#E5E5E5] pl-3 sm:contents sm:border-0 sm:pl-0">
              <div className="hidden sm:block w-px bg-[#E5E5E5]" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-[#111111]">{RUSH_DELIVERY_DAYS}</p>
                <p className="text-[9px] uppercase leading-tight tracking-normal text-[#595959] min-[360px]:text-[10px] sm:text-xs sm:tracking-wide">Day delivery</p>
              </div>
            </div>
            <div className="min-w-0 border-l border-[#E5E5E5] pl-3 sm:contents sm:border-0 sm:pl-0">
              <div className="hidden sm:block w-px bg-[#E5E5E5]" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-[#111111]">100%</p>
                <p className="text-[9px] uppercase leading-tight tracking-normal text-[#595959] min-[360px]:text-[10px] sm:text-xs sm:tracking-wide">Made in India</p>
              </div>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap">
            <Link href="/configurator" className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] sm:px-8 sm:py-4">
              Start designing
            </Link>
            <Link href="/products" className="rounded-[4px] border border-[#111111]/20 px-5 py-3.5 text-center text-sm font-medium text-[#111111] transition-colors hover:border-[#111111] sm:px-8 sm:py-4">
              View catalogue
            </Link>
          </div>
        </div>

        <div className="relative bg-[var(--color-cream-soft)] flex items-center justify-center min-h-64 lg:min-h-full overflow-hidden">
          <Image
            src="/products/boxy-fit-tee-260gsm.webp"
            alt="Heavyweight custom T-shirt manufactured and printed in India by Garmops"
            fill
            className="object-cover"
            sizes="(max-width: 1023px) 100vw, 50vw"
            priority
          />
          <div className="liquid-glass-surface absolute bottom-4 left-4 z-10 rounded-[4px] border px-4 py-3 sm:bottom-8 sm:left-8 sm:px-5 sm:py-4">
            <p className="text-xs text-[#595959] uppercase tracking-widest mb-1">Starting from</p>
            <p className="text-2xl font-bold text-[#111111]">&#8377;350</p>
            <p className="text-xs text-[#4a4a4a]">per piece &middot; MOQ 50</p>
          </div>
        </div>
      </section>

      {useSimpleMedia ? (
        <section className="relative mx-3 my-3 aspect-[4/3] overflow-hidden rounded-[4px] bg-black sm:mx-4 sm:my-4 sm:aspect-video sm:rounded-[4px]" aria-label="Garmops production showcase">
          <Image
            src="/hero.webp"
            alt="Garmops custom apparel production"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </section>
      ) : (
        <div ref={containerRef} className="relative h-[130vh]" style={{ contain: 'paint' }}>
          <div className="sticky top-0 h-screen w-full" style={{ contain: 'paint' }}>
            <div
              ref={videoWrapRef}
              className="absolute bg-black"
              style={{ inset: '20px', borderRadius: '20px', overflow: 'hidden' }}
            >
              <Image
                src="/hero.webp"
                alt=""
                aria-hidden="true"
                fill
                sizes="100vw"
                className="object-cover"
              />
              <video
                ref={videoRef}
                className={`relative z-10 h-full w-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
                src="/videos/homepage-reel.mp4"
                poster="/hero.webp"
                muted
                loop
                playsInline
                preload="metadata"
                onCanPlay={() => setVideoReady(true)}
                onError={() => setVideoReady(false)}
                webkit-playsinline="true"
                aria-label="Garmops production showcase"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
