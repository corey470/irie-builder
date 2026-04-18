/**
 * Validate a `redirect` param so we never bounce a user to an absolute URL,
 * a protocol-relative URL, or anything outside our origin's path space.
 *
 * Allowed shapes:  /dashboard, /edit, /brief?foo=bar
 * Rejected:        https://evil.com, //evil.com, /\\evil.com, javascript:…
 */
export function safeRedirect(input: string | null, fallback = '/dashboard'): string {
  if (!input) return fallback
  // Must start with a single slash
  if (!input.startsWith('/')) return fallback
  // Reject protocol-relative or backslash trickery
  if (input.startsWith('//') || input.startsWith('/\\') || input.startsWith('/%2f')) {
    return fallback
  }
  // Reject anything containing scheme markers
  if (/^\/[a-z]+:/i.test(input)) return fallback
  if (input.toLowerCase().includes('javascript:')) return fallback
  // Sanity cap
  if (input.length > 512) return fallback
  return input
}
