'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { PasswordInput } from '@/app/_auth/PasswordInput'
import { safeRedirect } from '@/app/_auth/safeRedirect'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const reset = searchParams.get('reset') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setError("That email and password don't match. Try again?")
      setLoading(false)
      return
    }
    router.push(redirect)
    router.refresh()
  }

  return (
    <AuthShell
      eyebrow="Pick up where you left off"
      title="Welcome back"
      subtitle="Sign in to keep building."
    >
      <form onSubmit={onSubmit} noValidate>
        {reset && !error ? (
          <div className="auth-success" role="status">
            Password updated. Sign in with your new one.
          </div>
        ) : null}
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
          autoComplete="current-password"
        />
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="auth-links">
          <Link href="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
          <span>
            New here?{' '}
            <Link href="/signup" className="auth-link">
              Create an account
            </Link>
          </span>
        </div>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
