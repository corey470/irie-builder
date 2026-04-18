'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/app/_auth/AuthShell'
import { PasswordInput } from '@/app/_auth/PasswordInput'
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
  // in the email link. Two possibilities:
  //  1. PKCE:     ?code=...           → exchangeCodeForSession
  //  2. Implicit: #access_token=...   → setSession from hash params
  //
  // A pre-existing session alone is NOT sufficient — otherwise anyone who
  // bookmarks this page could change their password without the email round-
  // trip. We require real proof of recovery intent (code or recovery hash).
  useEffect(() => {
    const supabase = createClient()

    async function bootstrap() {
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
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (setErr) {
            setStatus('invalid')
            return
          }
          window.history.replaceState(null, '', '/auth/reset-password')
          setStatus('ready')
          return
        }
      }

      // No recovery code and no recovery hash — do not consume whatever
      // session might already be in the browser as proof of intent.
      setStatus('invalid')
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
      <AuthShell
        eyebrow="One moment"
        title="Confirming your link…"
        subtitle="Just a second."
      >
        <div style={{ minHeight: '2rem' }} />
      </AuthShell>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell
        eyebrow="Link expired"
        title="This link is no longer valid."
        subtitle="Request a new reset email to continue."
      >
        <div className="auth-links">
          <Link href="/forgot-password" className="auth-link">
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
    <AuthShell
      eyebrow="Reset"
      title="Set a new password"
      subtitle="Make it a good one — we'll sign you in after."
    >
      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="auth-alert" role="alert">
            {error}
          </div>
        ) : null}
        <PasswordInput
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          helper="At least 8 characters."
        />
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
          {loading ? 'Setting new password…' : 'Save new password'}
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
