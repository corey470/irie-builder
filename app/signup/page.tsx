'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Pick a password at least 8 characters long.')
      return
    }
    if (password !== confirm) {
      setError("Those passwords don't match.")
      return
    }
    setLoading(true)
    const supabase = createClient()
    const emailRedirectTo = `${window.location.origin}/auth/confirm`
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    })
    setLoading(false)
    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      setError(
        msg.includes('already') || msg.includes('registered')
          ? 'An account with that email already exists. Try signing in?'
          : 'Something tripped us up. Try again in a moment?',
      )
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email." subtitle="You're almost in.">
        <p className="auth-success">
          We just sent a confirmation link to <strong>{email}</strong>. Click it
          to finish creating your account.
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
      title="Start building"
      subtitle="One account. Every Irie you'll ever make."
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
        <div className="auth-field">
          <label htmlFor="password" className="auth-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="confirm" className="auth-label">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            className="auth-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create your account'}
        </button>
        <div className="auth-links">
          <span>
            Already have an account?{' '}
            <Link href="/login" className="auth-link">
              Log in
            </Link>
          </span>
        </div>
      </form>
    </AuthShell>
  )
}
