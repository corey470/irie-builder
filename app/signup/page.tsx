'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { PasswordInput } from '@/app/_auth/PasswordInput'
import { createClient } from '@/lib/supabase/client'

/** Cheap visual strength estimate. NOT a security gate — purely cosmetic. */
function strength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  const labels = ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong']
  return { score: s as 0 | 1 | 2 | 3 | 4, label: pw ? labels[s] : '' }
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { score, label: strengthLabel } = strength(password)

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
    const { data, error: signUpError } = await supabase.auth.signUp({
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
    // Supabase returns a user with identities: [] when the email is already
    // registered but email-confirmations are enabled — do NOT show the
    // "check your email" screen in that case, it's misleading.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('An account with that email already exists. Try signing in?')
      return
    }
    // If a session was returned, email confirmation is OFF — go straight to dashboard.
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Almost in"
        title="Check your email."
        subtitle="We sent you a confirmation link."
      >
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
      eyebrow="One account, every Irie"
      title="Start building"
      subtitle="Free while we're in beta."
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
        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          helper="At least 8 characters."
        />
        {password ? (
          <>
            <div className="auth-strength" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`auth-strength-seg${i < score ? ' is-on' : ''}`} />
              ))}
            </div>
            <p className="auth-strength-label">{strengthLabel}</p>
          </>
        ) : null}
        <PasswordInput
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={8}
        />
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {loading ? 'Creating account…' : 'Create your account'}
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
