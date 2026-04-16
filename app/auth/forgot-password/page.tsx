'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    )
    setLoading(false)
    if (resetError) {
      setError("We couldn't send the reset link. Try again?")
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox.">
        <p className="auth-success">
          We sent a reset link to <strong>{email}</strong>. Check your inbox.
        </p>
        <div className="auth-links">
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Your email. We'll send a link."
    >
      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="auth-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <div className="auth-links">
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
