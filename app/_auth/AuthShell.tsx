'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface AuthShellProps {
  title: string
  subtitle?: string
  eyebrow?: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, eyebrow, children }: AuthShellProps) {
  return (
    <div className="auth-page">
      <style dangerouslySetInnerHTML={{ __html: authCss }} />
      <div className="auth-grain" aria-hidden="true" />
      <div className="auth-orbs" aria-hidden="true">
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-orb auth-orb--3" />
      </div>
      <header className="auth-header">
        <Link href="/" className="auth-wordmark">
          Irie Builder
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-card">
          {eyebrow ? <p className="auth-eyebrow">{eyebrow}</p> : null}
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-sub">{subtitle}</p> : null}
          <div className="auth-form-wrap">{children}</div>
        </div>
      </main>
      <AuthCursor />
    </div>
  )
}

/**
 * Custom gold cursor for marketing surfaces (DESIGN.md §1, §4).
 * Disabled on coarse pointers and prefers-reduced-motion.
 */
function AuthCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return
    setEnabled(true)
    document.documentElement.classList.add('auth-has-cursor')

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
        !!target.closest('a, button, input, select, textarea')
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
      document.documentElement.classList.remove('auth-has-cursor')
    }
  }, [])

  if (!enabled) return null
  return (
    <>
      <div ref={dotRef} className="auth-cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="auth-cursor-ring" aria-hidden="true" />
    </>
  )
}

const authCss = `
  .auth-page {
    --black: #080808;
    --gold: #C9A84C;
    --gold-light: #E8C96A;
    --gold-dim: rgba(201, 168, 76, 0.15);
    --cream: #F2EDE4;
    --white: #FAFAF7;
    --muted: rgba(242, 237, 228, 0.45);
    --border: rgba(201, 168, 76, 0.18);
    --pad: clamp(1.25rem, 5vw, 3rem);

    min-height: 100vh;
    background: var(--black);
    color: var(--cream);
    font-family: 'Syne', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  /* Grain overlay — DESIGN.md §1 */
  .auth-grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.5;
    mix-blend-mode: overlay;
    background-image:
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    background-size: 160px 160px;
  }

  .auth-orbs {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .auth-orb {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, var(--gold-dim) 0%, transparent 70%);
    filter: blur(60px);
    will-change: transform;
    animation: authOrbFloat 14s ease-in-out infinite;
  }

  .auth-orb--1 { width: 320px; height: 320px; top: -120px; left: -100px; }
  .auth-orb--2 { width: 360px; height: 360px; bottom: -140px; right: -100px; animation-delay: -7s; }
  .auth-orb--3 { width: 220px; height: 220px; top: 40%; right: 18%; animation-delay: -3s; animation-duration: 16s; opacity: 0.7; }

  @keyframes authOrbFloat {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(28px, 28px) scale(1.05); }
  }

  @media (prefers-reduced-motion: reduce) {
    .auth-orb { animation: none; }
  }

  .auth-header {
    padding: 1.5rem var(--pad);
    position: relative;
    z-index: 2;
  }

  .auth-wordmark {
    font-family: 'Playfair Display', serif;
    font-weight: 900;
    font-style: italic;
    font-size: 1.35rem;
    color: var(--gold);
    text-decoration: none;
    letter-spacing: -0.01em;
  }

  .auth-wordmark:hover { color: var(--gold-light); }

  .auth-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem var(--pad) 3rem;
    position: relative;
    z-index: 2;
  }

  .auth-card {
    width: 100%;
    max-width: 440px;
    padding: 2.5rem 2rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(8, 8, 8, 0.55);
    backdrop-filter: blur(10px);
  }

  /* Stagger entrance — DESIGN.md §4 */
  .auth-eyebrow,
  .auth-title,
  .auth-sub,
  .auth-form-wrap {
    opacity: 0;
    transform: translateY(12px);
    animation: authFadeUp 0.8s ease forwards;
  }
  .auth-eyebrow { animation-delay: 0.3s; }
  .auth-title   { animation-delay: 0.5s; }
  .auth-sub     { animation-delay: 0.65s; }
  .auth-form-wrap { animation-delay: 0.8s; }

  @keyframes authFadeUp {
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .auth-eyebrow, .auth-title, .auth-sub, .auth-form-wrap {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }

  .auth-eyebrow {
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 0 0.85rem;
  }

  .auth-title {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    line-height: 1.1;
    letter-spacing: -0.01em;
    margin: 0 0 0.5rem;
    color: var(--cream);
  }

  .auth-sub {
    font-family: 'Syne', sans-serif;
    font-weight: 300;
    font-size: clamp(0.95rem, 2vw, 1.05rem);
    color: var(--muted);
    margin: 0 0 1.75rem;
    line-height: 1.55;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.1rem;
  }

  .auth-label {
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cream);
  }

  .auth-input {
    width: 100%;
    padding: 0.9rem 1.25rem;
    font-family: 'Syne', sans-serif;
    font-size: max(16px, 1rem);
    font-weight: 400;
    color: var(--cream);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    min-height: 44px;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .auth-input::placeholder { color: var(--muted); }

  .auth-input:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.18);
  }

  .auth-password-wrap {
    position: relative;
  }
  .auth-password-wrap .auth-input {
    padding-right: 3rem;
  }
  .auth-password-toggle {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--muted);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .auth-password-toggle:hover { color: var(--gold); }
  .auth-password-toggle:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 1px;
  }

  .auth-helper {
    font-size: 12px;
    color: var(--muted);
    margin: 0;
    line-height: 1.45;
  }

  .auth-submit {
    width: 100%;
    padding: 0.95rem 1.5rem;
    margin-top: 0.25rem;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--black);
    background: var(--gold);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    min-height: 48px;
    transition: background 0.2s, transform 0.08s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .auth-submit:hover:not(:disabled) { background: var(--gold-light); }
  .auth-submit:active:not(:disabled) { transform: scale(0.99); }
  .auth-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  .auth-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(8, 8, 8, 0.25);
    border-top-color: var(--black);
    border-radius: 50%;
    animation: authSpin 0.7s linear infinite;
  }
  @keyframes authSpin {
    to { transform: rotate(360deg); }
  }

  .auth-links {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    color: var(--muted);
    text-align: center;
  }

  .auth-link {
    color: var(--cream);
    text-decoration: none;
    padding: 0.35rem 0.5rem;
    border-radius: 2px;
    display: inline-block;
  }

  .auth-link:hover { color: var(--gold); }
  .auth-link:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .auth-alert {
    padding: 0.8rem 1rem;
    border: 1px solid rgba(232, 162, 106, 0.35);
    background: rgba(232, 162, 106, 0.08);
    border-radius: 4px;
    margin-bottom: 1.1rem;
    font-size: 14px;
    color: #E8A26A;
    line-height: 1.5;
  }

  .auth-success {
    padding: 1rem 1.1rem;
    border: 1px solid var(--border);
    background: var(--gold-dim);
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 15px;
    color: var(--cream);
    line-height: 1.55;
  }

  .auth-success strong { color: var(--gold); font-weight: 500; }

  /* Password strength bar — DESIGN.md gold scale */
  .auth-strength {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }
  .auth-strength-seg {
    flex: 1;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    transition: background 0.2s;
  }
  .auth-strength-seg.is-on { background: var(--gold); }
  .auth-strength-label {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
    letter-spacing: 0.04em;
  }

  /* Custom gold cursor — DESIGN.md §4 */
  @media (pointer: fine) {
    .auth-cursor-dot,
    .auth-cursor-ring {
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10000;
      will-change: transform;
    }
    .auth-cursor-dot {
      width: 12px;
      height: 12px;
      margin: -6px 0 0 -6px;
      border-radius: 50%;
      background: var(--gold);
    }
    .auth-cursor-ring {
      width: 40px;
      height: 40px;
      margin: -20px 0 0 -20px;
      border-radius: 50%;
      border: 1px solid var(--gold);
      transition: width 220ms ease, height 220ms ease, margin 220ms ease;
    }
    .auth-cursor-ring.is-interactive {
      width: 60px;
      height: 60px;
      margin: -30px 0 0 -30px;
    }
    html.auth-has-cursor,
    html.auth-has-cursor body,
    html.auth-has-cursor .auth-page,
    html.auth-has-cursor .auth-page * {
      cursor: none !important;
    }
  }
  @media (pointer: coarse), (prefers-reduced-motion: reduce) {
    .auth-cursor-dot,
    .auth-cursor-ring { display: none !important; }
  }

  @media (max-width: 640px) {
    .auth-card { padding: 1.75rem 1.25rem; border-radius: 6px; }
    .auth-orb { width: 240px; height: 240px; }
    .auth-grain { opacity: 0.3; }
  }
`
