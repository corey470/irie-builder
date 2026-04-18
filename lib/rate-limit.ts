/**
 * Lightweight in-memory rate limiter — a sliding fixed-window counter keyed
 * by user id (or IP fallback for anon traffic). No new dependencies, no env
 * vars, just a Map + timestamps.
 *
 * CAVEAT: state is per-process, which on Vercel serverless means each cold
 * container has its own counter. This still catches tight loops from a
 * single client (the dominant abuse vector — a malicious script draining
 * the Anthropic / Firecrawl budget), but it's not a substitute for durable
 * rate limiting.
 *
 * TODO(corey): move to Vercel KV or Upstash Redis for cross-instance
 * accuracy once the project grows past single-region traffic.
 */

type Bucket = {
  // Monotonic millisecond timestamps of events that still fall inside
  // `windowMs`. Oldest first. Pruned on every check.
  events: number[]
}

const BUCKETS = new Map<string, Bucket>()

export type RateLimitBudget = {
  /** Max events inside `windowMs`. */
  max: number
  /** Window size in milliseconds. */
  windowMs: number
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number }

/**
 * Check the bucket for `key` and, if under budget, atomically record the
 * event. Returns `{ ok: false, retryAfterSeconds }` when the caller should
 * 429. `retryAfterSeconds` is >= 1.
 */
export function checkAndIncrement(key: string, budget: RateLimitBudget): RateLimitResult {
  const now = Date.now()
  const cutoff = now - budget.windowMs
  let bucket = BUCKETS.get(key)
  if (!bucket) {
    bucket = { events: [] }
    BUCKETS.set(key, bucket)
  }
  // Prune events outside the window.
  while (bucket.events.length > 0 && bucket.events[0] <= cutoff) {
    bucket.events.shift()
  }
  if (bucket.events.length >= budget.max) {
    const oldest = bucket.events[0]
    const retry = Math.max(1, Math.ceil((oldest + budget.windowMs - now) / 1000))
    return { ok: false, retryAfterSeconds: retry }
  }
  bucket.events.push(now)
  return { ok: true, remaining: budget.max - bucket.events.length }
}

/**
 * Pick a stable key for a request. Prefers the authenticated user id (most
 * accurate). Falls back to the first forwarded-for IP octet set, then a
 * weak UA-derived hash, then the generic bucket.
 */
export function deriveRateKey(opts: {
  userId?: string | null
  request: Request
}): string {
  if (opts.userId) return `user:${opts.userId}`
  const fwd = opts.request.headers.get('x-forwarded-for') ?? ''
  const firstIp = fwd.split(',')[0]?.trim()
  if (firstIp) return `ip:${firstIp}`
  const real = opts.request.headers.get('x-real-ip')?.trim()
  if (real) return `ip:${real}`
  const ua = opts.request.headers.get('user-agent') ?? ''
  if (ua) {
    // Cheap djb2-ish hash so we don't store the full UA.
    let hash = 5381
    for (let i = 0; i < ua.length; i++) {
      hash = ((hash << 5) + hash + ua.charCodeAt(i)) | 0
    }
    return `ua:${(hash >>> 0).toString(36)}`
  }
  return 'anon:shared'
}

/**
 * Convenience 429 response builder.
 */
export function rateLimitResponse(retryAfterSeconds: number, label: string): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message: `Rate limit exceeded for ${label}. Try again in ${retryAfterSeconds}s.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
