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
    if (!email) {
      setError('Enter your email and we will send you a reset link.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset-password`
    // Always show success — never reveal whether the email is registered.
    // Errors that aren't "user not found" are still surfaced.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    )
    setLoading(false)
    if (resetError) {
      // Enumeration defense: "user not found" must look identical to
      // success, so we only swallow that specific class of error. The old
      // `includes('email')` check swallowed rate-limit and delivery errors
      // too ("Email rate limit exceeded", "Error sending recovery email",
      // …) and lied to the user. Match narrowly.
      const msg = resetError.message
      const looksLikeUnknownUser =
        /user.*(not.*found|does.*not.*exist)/i.test(msg) ||
        /not.*registered/i.test(msg)
      if (looksLikeUnknownUser) {
        setSent(true)
        return
      }
      setError(
        "Couldn't send the reset right now — try again in a few minutes.",
      )
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Reset link sent"
        title="Check your inbox."
        subtitle="If an account exists for that email, a reset link is on the way."
      >
        <p className="auth-success">
          The link expires in about an hour. Didn&apos;t get it? Check your
          spam folder, or send a new one.
        </p>
        <div className="auth-links">
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
            style={{ background: 'transparent', border: 0, font: 'inherit', cursor: 'pointer' }}
          >
            Send another
          </button>
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Forgot password"
      title="Reset your password"
      subtitle="Enter your email. We'll send you a link."
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
          {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {loading ? 'Sending link…' : 'Send reset link'}
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
