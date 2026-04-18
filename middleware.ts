import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Auth boundary.
 *
 * - Anything under PROTECTED_PREFIXES requires a Supabase session when
 *   NEXT_PUBLIC_AUTH_GATING === 'on'.
 * - Auth pages (PUBLIC_AUTH_PATHS) are always reachable without a session,
 *   and a signed-in user visiting them is sent to the dashboard so we never
 *   loop them through "log in" when they already are.
 * - Everything else (the marketing surface — /, /privacy, etc.) is open.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/brief',
  '/generate',
  '/edit',
  '/publish',
  '/api/generate',
  '/api/clone',
]

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/logout',
])

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

/**
 * Validate a `redirect` query value before bouncing the user there.
 * Mirrors the client-side check in app/_auth/safeRedirect.ts.
 */
function safeRedirectPath(input: string | null): string | null {
  if (!input) return null
  if (!input.startsWith('/')) return null
  if (input.startsWith('//') || input.startsWith('/\\') || input.startsWith('/%2f')) return null
  if (/^\/[a-z]+:/i.test(input)) return null
  if (input.toLowerCase().includes('javascript:')) return null
  if (input.length > 512) return null
  return input
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const gatingOn = process.env.NEXT_PUBLIC_AUTH_GATING === 'on'
  const pathname = request.nextUrl.pathname

  // Signed-in users visiting login/signup → send them to where they wanted
  // to go (or /dashboard). Never redirect /logout — that would loop.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const requested = safeRedirectPath(request.nextUrl.searchParams.get('redirect'))
    const dest = request.nextUrl.clone()
    dest.pathname = requested ?? '/dashboard'
    dest.search = ''
    return NextResponse.redirect(dest)
  }

  if (gatingOn && isProtected(pathname) && !user) {
    // Sanity guard: never redirect from an auth page (would loop).
    if (PUBLIC_AUTH_PATHS.has(pathname)) return supabaseResponse
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  // Skip static assets and the marketing landing rewrite target.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.svg|og\\.svg|index\\.html).*)',
  ],
}
