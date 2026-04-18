import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectOr } from '@/lib/auth/safe-redirect'

/**
 * Generic Supabase auth callback — PKCE code exchange for OAuth providers
 * and magic links. Redirects to ?next=... on success, /login on failure.
 *
 * `next` is validated through `safeRedirectOr` — raw values would otherwise
 * let an attacker mint a session and bounce the user off-origin carrying the
 * fresh cookie. Anything that isn't a same-origin non-auth path falls back
 * to `/dashboard`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeRedirectOr(searchParams.get('next'), '/dashboard')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const fallback = new URL('/login', request.url)
  fallback.searchParams.set('error', 'callback_failed')
  return NextResponse.redirect(fallback)
}
