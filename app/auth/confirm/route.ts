import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectOr } from '@/lib/auth/safe-redirect'

/**
 * Email confirmation callback.
 * Supabase email templates send users here with ?token_hash=&type=.
 * We verify the OTP, which establishes a session cookie, then redirect.
 *
 * `type` is validated against the known EmailOtpType set — an unknown value
 * would otherwise be cast straight through to `verifyOtp`. `next` is
 * validated through `safeRedirectOr` so the freshly-minted session cookie
 * can't ride an open redirect off-origin.
 */
const ALLOWED_OTP_TYPES: ReadonlySet<EmailOtpType> = new Set<EmailOtpType>([
  'signup',
  'email',
  'recovery',
  'email_change',
  'invite',
])

function parseOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null
  if (ALLOWED_OTP_TYPES.has(raw as EmailOtpType)) return raw as EmailOtpType
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = parseOtpType(searchParams.get('type'))
  const next = safeRedirectOr(searchParams.get('next'), '/dashboard')

  if (!type && searchParams.get('type')) {
    // Explicitly bad input — return 400 rather than a silent redirect.
    return new Response('Invalid confirmation link.', { status: 400 })
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const fallback = new URL('/login', request.url)
  fallback.searchParams.set('error', 'confirm_failed')
  return NextResponse.redirect(fallback)
}
