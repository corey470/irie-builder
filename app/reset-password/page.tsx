import { redirect } from 'next/navigation'

/**
 * Root-level alias — Supabase recovery emails are configured to send users
 * here, while the implementation lives at /auth/reset-password. This keeps
 * both paths working without duplicating the token-handling logic.
 *
 * NOTE: token query params (?code=…) and hash fragments (#access_token=…)
 * are preserved by next/navigation's redirect because the hash is client-side
 * only and the search string is appended below.
 */
export default function ResetPasswordRoot({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const params = new URLSearchParams()
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === 'string') params.set(k, v)
      else if (Array.isArray(v) && v.length > 0) params.set(k, v[0])
    }
  }
  const qs = params.toString()
  redirect(qs ? `/auth/reset-password?${qs}` : '/auth/reset-password')
}
