'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="auth-page">
      <style dangerouslySetInnerHTML={{ __html: authCss }} />
      <div className="auth-orbs" aria-hidden="true">
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
      </div>
      <header className="auth-header">
        <Link href="/" className="auth-wordmark">
          Irie Builder
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-sub">{subtitle}</p> : null}
          {children}
        </div>
      </main>
    </div>
  )
}

const authCss = `
  .auth-page {
    --black: #080808;
    --gold: #C9A84C;
    --gold-light: #E8C96A;
    --gold-dim: rgba(201, 168, 76, 0.15);
    --cream: #F2EDE4;
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

  .auth-orbs {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .auth-orb {
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--gold-dim) 0%, transparent 70%);
    filter: blur(60px);
    animation: authOrbFloat 14s ease-in-out infinite;
  }

  .auth-orb--1 { top: -120px; left: -100px; }
  .auth-orb--2 { bottom: -120px; right: -100px; animation-delay: -7s; }

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
    z-index: 1;
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
    z-index: 1;
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
  }

  .auth-submit:hover:not(:disabled) { background: var(--gold-light); }
  .auth-submit:active:not(:disabled) { transform: scale(0.99); }
  .auth-submit:disabled { opacity: 0.55; cursor: not-allowed; }

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

  @media (max-width: 640px) {
    .auth-card { padding: 1.75rem 1.25rem; border-radius: 6px; }
    .auth-orb { width: 240px; height: 240px; }
  }
`
