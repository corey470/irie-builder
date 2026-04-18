'use client'

import { useState } from 'react'

interface PasswordInputProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: 'current-password' | 'new-password'
  required?: boolean
  minLength?: number
  helper?: string
}

/** Eye / eye-off SVG — inline, no icon library. */
function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 9s2.5-5 7-5c1.5 0 2.7.4 3.7 1M16 9s-1 2-2.7 3.4M9 13.5c-4.5 0-7-4.5-7-4.5" />
        <circle cx="9" cy="9" r="2.2" />
        <path d="M2.5 2.5l13 13" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="9" cy="9" r="2.2" />
    </svg>
  )
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  helper,
}: PasswordInputProps) {
  const [shown, setShown] = useState(false)
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="auth-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          tabIndex={-1}
        >
          <EyeIcon off={shown} />
        </button>
      </div>
      {helper ? <p className="auth-helper">{helper}</p> : null}
    </div>
  )
}
