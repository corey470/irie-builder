/**
 * Shared redirect validator used by the middleware and by every auth-cookie-
 * minting route (/auth/callback, /auth/confirm, …). Rejects:
 *
 *   - absolute URLs (`https://evil.com/…`)
 *   - protocol-relative (`//evil.com`)
 *   - encoded-slash or backslash trickery (`/\\evil.com`, `/%2fevil.com`)
 *   - `javascript:` and other scheme markers
 *   - paths that bounce back to an auth page (would loop with a fresh session)
 *   - overlong input
 *
 * Returns the cleaned path, or `null` if the input was unsafe. Callers fall
 * back to `/dashboard` (or whatever default makes sense).
 */

const AUTH_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/logout',
]

export function safeRedirectPath(input: string | null | undefined): string | null {
  if (!input) return null
  if (typeof input !== 'string') return null
  if (!input.startsWith('/')) return null
  if (
    input.startsWith('//') ||
    input.startsWith('/\\') ||
    input.toLowerCase().startsWith('/%2f') ||
    input.toLowerCase().startsWith('/%5c')
  ) {
    return null
  }
  if (/^\/[a-z]+:/i.test(input)) return null
  if (input.toLowerCase().includes('javascript:')) return null
  if (input.length > 512) return null

  // Strip query/hash for the auth-page check (we still return the full input).
  const pathOnly = input.split(/[?#]/)[0].toLowerCase()
  for (const prefix of AUTH_PATH_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) {
      return null
    }
    // Exact-match forms like /login (no trailing slash in the prefix itself).
    if (!prefix.endsWith('/') && pathOnly === prefix) return null
  }

  return input
}

/**
 * Convenience wrapper that returns a safe path or the supplied fallback.
 */
export function safeRedirectOr(input: string | null | undefined, fallback = '/dashboard'): string {
  return safeRedirectPath(input) ?? fallback
}
