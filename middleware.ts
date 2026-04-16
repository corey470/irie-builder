import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/brief',
  '/generate',
  '/edit',
  '/publish',
  '/api/generate',
  '/api/clone',
]

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const gatingOn = process.env.NEXT_PUBLIC_AUTH_GATING === 'on'
  const pathname = request.nextUrl.pathname

  if (gatingOn && isProtected(pathname) && !user) {
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
