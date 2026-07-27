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
      <section className="grid lg:grid-cols-2 min-h-[90vh]">
        <div className="flex flex-col justify-center bg-white px-8 py-20 md:px-16 lg:py-0">
          <p className="text-xs text-[#595959] font-medium mb-6 tracking-widest uppercase">
            Custom apparel for businesses
          </p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#111111] leading-[1.05] tracking-tight mb-6">
            Custom merch<br />for your<br /><span className="text-[var(--color-teal)]">business</span>
          </h1>
          <p className="text-base text-[#4a4a4a] max-w-sm mb-10 leading-relaxed">
            From design to delivery: premium custom merch, made in India. Create, customise and place your order in just a few simple steps.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 mb-10">
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-[#111111]">50</p>
              <p className="text-[10px] sm:text-xs text-[#595959] uppercase tracking-normal sm:tracking-wide leading-tight">Min. pieces</p>
            </div>
            <div className="border-l border-[#E5E5E5] pl-3 sm:border-0 sm:pl-0 sm:contents">
              <div className="hidden sm:block w-px bg-[#E5E5E5]" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-[#111111]">{RUSH_DELIVERY_DAYS}</p>
                <p className="text-[10px] sm:text-xs text-[#595959] uppercase tracking-normal sm:tracking-wide leading-tight">Day delivery</p>
              </div>
            </div>
            <div className="border-l border-[#E5E5E5] pl-3 sm:border-0 sm:pl-0 sm:contents">
              <div className="hidden sm:block w-px bg-[#E5E5E5]" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-[#111111]">100%</p>
                <p className="text-[10px] sm:text-xs text-[#595959] uppercase tracking-normal sm:tracking-wide leading-tight">Made in India</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/configurator" className="bg-[var(--color-teal)] text-white px-8 py-4 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors">
              Start designing
            </Link>
            <Link href="/products" className="border border-[#111111]/20 text-[#111111] px-8 py-4 rounded-full text-sm font-medium hover:border-[#111111] transition-colors">
              View catalogue
            </Link>
          </div>
        </div>

        <div className="relative bg-[var(--color-cream-soft)] flex items-center justify-center min-h-64 lg:min-h-full overflow-hidden">
          <Image
            src="/products/boxy-fit-tee-260gsm.jpg"
            alt="Custom merch made in India"
            fill
            className="object-cover"
            sizes="(max-width: 1023px) 100vw, 50vw"
            priority
          />
          <div className="absolute bottom-8 left-8 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-[0_8px_30px_rgba(22,33,43,0.12)] z-10">
            <p className="text-xs text-[#595959] uppercase tracking-widest mb-1">Starting from</p>
            <p className="text-2xl font-bold text-[#111111]">&#8377;350</p>
            <p className="text-xs text-[#4a4a4a]">per piece &middot; MOQ 50</p>
          </div>
        </div>
      </section>

      {useSimpleMedia ? (
        <section className="relative mx-4 my-4 aspect-[4/5] overflow-hidden rounded-3xl bg-black sm:aspect-video" aria-label="Garmops production showcase">
          <Image
            src="/hero.jpg"
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
                src="/hero.jpg"
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
                poster="/hero.jpg"
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
