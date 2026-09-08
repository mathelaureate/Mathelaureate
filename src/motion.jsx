import { useEffect, useRef, useState } from 'react'

const KONCEPTS_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Reveal({
  as: Tag = 'div',
  className = '',
  delay = 0,
  children,
  ...props
}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (prefersReducedMotion()) {
      setShown(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        observer.disconnect()
      },
      { threshold: 0.14, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`k-reveal${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--k-delay': `${delay}ms`, '--k-ease': KONCEPTS_EASE }}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CountUp({ value, className = '' }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(value)
  const visible = useRef(false)
  const frame = useRef(0)

  useEffect(() => {
    const parsed = String(value).match(/^([0-9,]+)(.*)$/)
    const target = parsed ? Number(parsed[1].replaceAll(',', '')) : NaN
    const suffix = parsed?.[2] || ''
    if (!Number.isFinite(target)) {
      setDisplay(value)
      return undefined
    }

    const run = () => {
      if (prefersReducedMotion()) {
        setDisplay(value)
        return
      }
      cancelAnimationFrame(frame.current)
      const duration = 900
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - (1 - t) ** 3
        const current = Math.round(target * eased)
        setDisplay(`${current.toLocaleString('en-US')}${suffix}`)
        if (t < 1) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }

    if (visible.current) {
      run()
      return () => cancelAnimationFrame(frame.current)
    }

    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        visible.current = true
        run()
        observer.disconnect()
      },
      { threshold: 0.2 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [value])

  return (
    <strong ref={ref} className={className}>
      {display}
    </strong>
  )
}

export function Marquee({ items }) {
  const loop = [...items, ...items]
  return (
    <div className="k-marquee" aria-hidden="true">
      <div className="k-marquee-track">
        {loop.map((item, index) => (
          <span key={`${item}-${index}`} className="k-marquee-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
