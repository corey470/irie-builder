'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Custom gold cursor (DESIGN.md §1, §4).
 * 12px dot + 40px 1px ring (expands to 60px on interactive elements).
 * Disabled on coarse pointers and prefers-reduced-motion via tuner.css.
 */
export function TunerCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return
    setEnabled(true)

    const rootEl = document.querySelector<HTMLElement>('.tuner-root')
    rootEl?.classList.add('has-cursor')

    let mouseX = -100
    let mouseY = -100
    let ringX = -100
    let ringY = -100
    let raf = 0
    let lastHover = false

    function onMove(event: MouseEvent) {
      mouseX = event.clientX
      mouseY = event.clientY
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }
      const target = event.target as Element | null
      const hover =
        !!target &&
        !!target.closest('a, button, input, select, textarea, [role="radio"], [role="switch"], [data-hover="interactive"]')
      if (hover !== lastHover && ringRef.current) {
        ringRef.current.classList.toggle('is-interactive', hover)
        lastHover = hover
      }
    }

    function loop() {
      ringX += (mouseX - ringX) * 0.15
      ringY += (mouseY - ringY) * 0.15
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`
      }
      raf = window.requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf = window.requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.cancelAnimationFrame(raf)
      rootEl?.classList.remove('has-cursor')
    }
  }, [])

  if (!enabled) return null
  return (
    <>
      <div ref={dotRef} className="tuner-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="tuner-cursor-ring" aria-hidden="true" />
    </>
  )
}
