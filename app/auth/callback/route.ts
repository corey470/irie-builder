import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Generic Supabase auth callback — PKCE code exchange for OAuth providers
 * and magic links. Redirects to ?next=... on success, /login on failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
