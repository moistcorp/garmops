'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

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
    body: 'Use the Garmops real-time merch platform to choose from ready-stock colours, custom dye references, and multiple decoration techniques. Top it off with your brand’s woven label.',
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
  const [isMobile, setIsMobile] = useState(false)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [animationVersion, setAnimationVersion] = useState(0)

  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerStartedAtRef = useRef(0)
  const remainingTimeRef = useRef(STEP_DURATION)

  const isSectionVisibleRef = useRef(false)
  const isPageVisibleRef = useRef(true)
  const isUserScrolling = useRef(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => {
      window.removeEventListener('resize', checkScreenSize)
    }
  }, [])

  const pauseTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      const elapsed = performance.now() - timerStartedAtRef.current

      remainingTimeRef.current = Math.max(
        0,
        remainingTimeRef.current - elapsed,
      )

      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setIsTimerRunning(false)
  }, [])

  const scheduleTimer = useCallback(function schedule() {
    const canRun =
      isSectionVisibleRef.current &&
      isPageVisibleRef.current

    if (!canRun || timeoutRef.current !== null) {
      return
    }

    const remainingTime = Math.max(
      0,
      remainingTimeRef.current,
    )

    timerStartedAtRef.current = performance.now()
    setIsTimerRunning(true)

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      remainingTimeRef.current = STEP_DURATION

      setActive(previousActive => {
        return (previousActive + 1) % steps.length
      })

      setAnimationVersion(version => version + 1)

      schedule()
    }, remainingTime)
  }, [])

  const restartTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    remainingTimeRef.current = STEP_DURATION
    setAnimationVersion(version => version + 1)

    if (
      isSectionVisibleRef.current &&
      isPageVisibleRef.current
    ) {
      scheduleTimer()
    } else {
      setIsTimerRunning(false)
    }
  }, [scheduleTimer])

  useEffect(() => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        const isVisible = entry.isIntersecting

        isSectionVisibleRef.current = isVisible

        if (isVisible && isPageVisibleRef.current) {
          scheduleTimer()
        } else {
          pauseTimer()
        }
      },
      {
        threshold: 0.05,
      },
    )

    observer.observe(section)

    return () => {
      observer.disconnect()
    }
  }, [pauseTimer, scheduleTimer])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'

      isPageVisibleRef.current = isVisible

      if (isVisible && isSectionVisibleRef.current) {
        scheduleTimer()
      } else {
        pauseTimer()
      }
    }

    handleVisibilityChange()

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [pauseTimer, scheduleTimer])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isMobile || isUserScrolling.current) {
      return
    }

    const card = cardRefs.current[active]
    const container = scrollRef.current

    if (!card || !container) {
      return
    }

    container.scrollTo({
      left: card.offsetLeft,
      behavior: 'smooth',
    })
  }, [active, isMobile])

  const selectStep = useCallback(
    (stepIndex: number) => {
      setActive(stepIndex)
      restartTimer()
    },
    [restartTimer],
  )

  const handleScrollEnd = () => {
    const container = scrollRef.current

    if (!container) {
      return
    }

    isUserScrolling.current = false

    const scrollLeft = container.scrollLeft
    let closest = 0
    let minimumDistance = Infinity

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        return
      }

      const distance = Math.abs(
        card.offsetLeft - scrollLeft,
      )

      if (distance < minimumDistance) {
        minimumDistance = distance
        closest = index
      }
    })

    if (closest !== active) {
      selectStep(closest)
    }
  }

  const renderProgressBar = (stepIndex: number) => {
    if (active !== stepIndex) {
      return null
    }

    return (
      <div
        key={`${stepIndex}-${animationVersion}`}
        className="how-it-works-progress"
        style={{
          height: '100%',
          background: 'var(--color-accent)',
          animationDuration: `${STEP_DURATION}ms`,
          animationPlayState: isTimerRunning
            ? 'running'
            : 'paused',
        }}
      />
    )
  }

  return (
    <section
      ref={sectionRef}
      className="techpack-section py-14 sm:py-20"
    >
      <div className="mx-auto mb-8 max-w-7xl px-4 sm:mb-10 sm:px-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-[#595959]">
          How it works
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#111111] sm:text-4xl">
            Launch your merch
            <br />
            project today.
          </h2>

          <Link
            href="/configurator"
            className="whitespace-nowrap text-sm font-medium text-[#111111] underline underline-offset-4 transition-opacity hover:opacity-50"
          >
            Start designing →
          </Link>
        </div>
      </div>

      {isMobile && (
        <div
          ref={scrollRef}
          onScrollCapture={() => {
            isUserScrolling.current = true
          }}
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
            paddingLeft: '16px',
            paddingBottom: '16px',
            width: '100vw',
            scrollPaddingLeft: '16px',
          }}
        >
          {steps.map((step, index) => (
            <div
              key={step.number}
              ref={element => {
                cardRefs.current[index] = element
              }}
              className="techpack-panel rounded-[4px] border p-4"
              style={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                width: '85vw',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#666666',
                    }}
                  >
                    {step.number}.
                  </span>

                  <span
                    style={{
                      fontSize: '19px',
                      fontWeight: 700,
                      color: '#111111',
                      lineHeight: 1.2,
                    }}
                  >
                    {step.title}
                  </span>
                </div>

                <div
                  style={{
                    height: '1px',
                    background: '#E5E5E5',
                    marginBottom: '10px',
                    overflow: 'hidden',
                  }}
                >
                  {renderProgressBar(index)}
                </div>

                <p
                  style={{
                    fontSize: '13px',
                    color: '#4a4a4a',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {step.body}
                </p>
              </div>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4/3',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  background: '#F7F7F7',
                  flexShrink: 0,
                }}
              >
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="85vw"
                  priority={index === 0}
                />
              </div>
            </div>
          ))}

          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: '16px',
            }}
          />
        </div>
      )}

      {!isMobile && (
        <div className="mx-auto max-w-7xl px-6">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '64px',
              alignItems: 'center',
            }}
          >
            <div>
              {steps.map((step, index) => {
                const isActive = active === index

                return (
                  <button
                    key={step.number}
                    type="button"
                    onClick={() => selectStep(index)}
                    className={isActive ? 'techpack-panel rounded-[4px] border' : ''}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '28px 20px',
                      display: 'block',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '12px',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isActive
                            ? 'var(--color-accent)'
                            : '#666666',
                        }}
                      >
                        {step.number}.
                      </span>

                      <span
                        style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: isActive
                            ? 'var(--color-accent)'
                            : '#555555',
                          lineHeight: 1.2,
                        }}
                      >
                        {step.title}
                      </span>
                    </div>

                    <div
                      style={{
                        overflow: 'hidden',
                        maxHeight: isActive
                          ? '160px'
                          : '0px',
                        opacity: isActive ? 1 : 0,
                        transition:
                          'max-height 0.3s ease, opacity 0.3s ease',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#4a4a4a',
                          lineHeight: 1.6,
                          paddingLeft: '20px',
                          paddingBottom: '16px',
                        }}
                      >
                        {step.body}
                      </p>
                    </div>

                    <div
                      style={{
                        height: '1px',
                        background: '#E5E5E5',
                        marginTop: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      {renderProgressBar(index)}
                    </div>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                background: '#F7F7F7',
                border: '1px solid #E5E5E5',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: active === index ? 1 : 0,
                    transition: 'opacity 0.7s ease',
                  }}
                >
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="50vw"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .how-it-works-progress {
          width: 100%;
          transform: scaleX(0);
          transform-origin: left center;
          animation-name: how-it-works-progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          will-change: transform;
        }

        @keyframes how-it-works-progress {
          from {
            transform: scaleX(0);
          }

          to {
            transform: scaleX(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .how-it-works-progress {
            animation: none;
            transform: scaleX(1);
          }
        }
      `}</style>
    </section>
  )
}
