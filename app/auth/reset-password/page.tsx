'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { createClient } from '@/lib/supabase/client'

type BootstrapStatus = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<BootstrapStatus>('checking')

  // On mount: establish a recovery session from whichever format Supabase used
  // in the email link. Three possibilities:
  //  1. PKCE:     ?code=...           → exchangeCodeForSession
  //  2. Implicit: #access_token=...   → setSession from hash params
  //  3. Session already present       → proceed directly
  useEffect(() => {
    const supabase = createClient()

    async function bootstrap() {
      // 1. PKCE code exchange
      const search = new URLSearchParams(window.location.search)
      const code = search.get('code')
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setStatus('invalid')
          return
        }
        window.history.replaceState(null, '', '/auth/reset-password')
        setStatus('ready')
        return
      }

      // 2. Implicit-flow hash fragment
      if (window.location.hash && window.location.hash.length > 1) {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const access_token = hash.get('access_token')
        const refresh_token = hash.get('refresh_token')
        const hashError = hash.get('error_description') || hash.get('error')
        if (hashError) {
          setStatus('invalid')
          return
        }
        if (access_token && refresh_token) {
          const { error: setError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (setError) {
            setStatus('invalid')
            return
          }
          window.history.replaceState(null, '', '/auth/reset-password')
          setStatus('ready')
          return
        }
      }

      // 3. Already have a user (rare — e.g. returning after a partial flow)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setStatus(user ? 'ready' : 'invalid')
    }

    bootstrap().catch(() => setStatus('invalid'))
  }, [])

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
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError("Couldn't update your password. The link may have expired.")
      return
    }
    router.push('/login?reset=1')
  }

  if (status === 'checking') {
    return (
      <AuthShell title="One moment." subtitle="Confirming your reset link…">
        <div style={{ minHeight: '2rem' }} />
      </AuthShell>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell
        title="This link expired."
        subtitle="Reset links are good for a short window."
      >
        <div className="auth-links">
          <Link href="/auth/forgot-password" className="auth-link">
            Send a new reset link
          </Link>
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="auth-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="auth-field">
          <label htmlFor="password" className="auth-label">
            New password
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
          {loading ? 'Saving…' : 'Save new password'}
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
