import { runOrchestrator } from '@/lib/agents/orchestrator'
import { initStatus, clearStatus } from '@/lib/agents/status-store'
import { logError } from '@/lib/logging'
import type { BriefInput, StreamEvent } from '@/lib/agents/types'

const MAX_BODY_BYTES = 50 * 1024
const MAX_BRIEF_LENGTH = 2000
const MAX_STYLE_BLEND_LENGTH = 500
const MAX_REQUEST_ID_LENGTH = 36
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Streaming generation endpoint.
 *
 * The body of the response is newline-delimited JSON events:
 *   {"type":"status","agent":"creative-director","state":"working","at":...}
 *   {"type":"status","agent":"creative-director","state":"done","at":...}
 *   ...
 *   {"type":"complete","at":...,"payload":{...}}
 *
 * The dashboard reads the stream in real time so agent status lights up
 * as each stage completes — no polling needed.
 *
 * A separate GET /api/generate/status?requestId=xxx endpoint still
 * exposes the in-memory status-store for spec compliance; it's
 * best-effort because serverless invocations don't share memory.
 */

interface RawRequest {
  requestId?: string
  brandName?: string
  headline?: string
  heroImageUrl?: string
  heroImageDescription?: string
  ctaText?: string
  vibe?: string
  audience?: string
  colors?: { primary?: string; accent?: string; background?: string }
  mood?: 'light' | 'dark' | 'warm'
  pageType?: 'landing' | 'store' | 'portfolio' | 'event'
  designDirection?: string
  styleBlend?: string
  referenceStyles?: string[]
  emotionalControls?: {
    authority: number
    desire: number
    warmth: number
    tension: number
    spectacle: number
  }
  sectionFocus?: string
  revisionDirective?: string
  carryForwardLocks?: string[]
  userFeedback?: string
  rawBrief?: string
}

export async function POST(request: Request) {
  let rawBuffer: ArrayBuffer
  try {
    rawBuffer = await request.arrayBuffer()
  } catch {
    return jsonError('Unable to read request body', 400)
  }

  if (rawBuffer.byteLength > MAX_BODY_BYTES) {
    return jsonError('Request payload exceeds 50KB limit', 413)
  }

  let bodyText: string
  try {
    bodyText = new TextDecoder().decode(rawBuffer)
  } catch {
    return jsonError('Unable to decode request body', 400)
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(bodyText)
  } catch {
    return jsonError('Invalid JSON in request body', 400)
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return jsonError('Invalid JSON in request body', 400)
  }

  const body = parsedBody as RawRequest
  const rawBriefError = validateTextLength('rawBrief', body.rawBrief, MAX_BRIEF_LENGTH)
  if (rawBriefError) return rawBriefError
  const vibeError = validateTextLength('vibe', body.vibe, MAX_BRIEF_LENGTH)
  if (vibeError) return vibeError
  const styleBlendError = validateTextLength('styleBlend', body.styleBlend, MAX_STYLE_BLEND_LENGTH)
  if (styleBlendError) return styleBlendError

  const sanitizedRawBrief = normalizeOptionalString(body.rawBrief)
  const sanitizedVibe = normalizeOptionalString(body.vibe)
  const sanitizedStyleBlend = normalizeOptionalString(body.styleBlend)
  const hasRawBrief = Boolean(sanitizedRawBrief && sanitizedRawBrief.trim())
  const hasVibe = Boolean(sanitizedVibe && sanitizedVibe.trim())
  if (!hasRawBrief && !hasVibe) {
    return jsonError('Please provide a vibe or raw brief', 400)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError('ANTHROPIC_API_KEY not configured on server', 500)
  }

  const requestId = sanitizeRequestId(body.requestId)
  initStatus(requestId)

  // Build the typed brief the agents consume
  const vibeText = (sanitizedRawBrief || sanitizedVibe || '').toLowerCase()
  const category = detectCategory(
    vibeText + ' ' + (body.heroImageDescription || '') + ' ' + (body.pageType || ''),
  )
  const resolvedDirection = body.designDirection === 'auto' || !body.designDirection
    ? inferDesignDirection(
        `${sanitizedRawBrief || ''} ${sanitizedVibe || ''} ${body.audience || ''}`,
        body.pageType || 'landing',
      )
    : body.designDirection

  const heroImage = body.heroImageUrl && /^https?:\/\//i.test(body.heroImageUrl)
    ? body.heroImageUrl
    : selectHeroImage(sanitizedVibe || sanitizedRawBrief || '', body.heroImageDescription || '', body.pageType || 'landing', body.mood || 'dark', body.brandName || sanitizedRawBrief || '')

  const contentImages = getContentImageUrls(category)

  const brief: BriefInput = {
    brandName: body.brandName,
    headline: body.headline,
    ctaText: body.ctaText,
    vibe: sanitizedVibe,
    audience: body.audience,
    rawBrief: sanitizedRawBrief,
    colors: {
      primary: body.colors?.primary || '#111111',
      accent: body.colors?.accent || '#C9A84C',
      background: body.colors?.background || '#080808',
    },
    mood: body.mood || 'dark',
    pageType: body.pageType || 'landing',
    designDirection: resolvedDirection,
    referenceStyles: Array.isArray(body.referenceStyles) ? body.referenceStyles : [],
    styleBlend: sanitizedStyleBlend,
    emotionalControls: body.emotionalControls,
    heroImageUrl: heroImage,
    heroImageDescription: body.heroImageDescription,
    contentImages,
    userFeedback: body.userFeedback,
    sectionFocus: body.sectionFocus,
    revisionDirective: body.revisionDirective,
    carryForwardLocks: body.carryForwardLocks,
  }

  const bootEvents: StreamEvent[] = []
  let liveWrite: ((event: StreamEvent) => void) | null = null
  const onEvent = (event: StreamEvent) => {
    if (liveWrite) {
      liveWrite(event)
      return
    }
    bootEvents.push(event)
  }

  let startupError: unknown = null
  const orchestratorPromise = runOrchestrator({
    requestId,
    brief,
    onEvent,
  }).catch(err => {
    startupError = err
    throw err
  })

  await Promise.resolve()
  if (startupError && bootEvents.length === 0) {
    clearStatus(requestId)
    const message = startupError instanceof Error ? startupError.message : 'Unknown error'
    logError('generate orchestrator crashed before streaming began', {
      requestId,
      errorMessage: message,
      errorStack: startupError instanceof Error ? startupError.stack : undefined,
    })
    return jsonError(message, 500)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wroteAnyEvent = false
      const write = (obj: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
          wroteAnyEvent = true
        } catch {
          // stream may be closed; ignore
        }
      }

      liveWrite = write
      for (const event of bootEvents) write(event)

      try {
        const { payload } = await orchestratorPromise
        write({ type: 'complete', at: Date.now(), payload })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        logError('generate orchestrator crashed', {
          requestId,
          wroteAnyEvent,
          errorMessage: message,
          errorStack: err instanceof Error ? err.stack : undefined,
        })
        if (wroteAnyEvent) {
          write({ type: 'error', at: Date.now(), message })
        } else {
          try {
            controller.error(err instanceof Error ? err : new Error(message))
          } catch {
            // ignore if controller already errored
          }
        }
      } finally {
        liveWrite = null
        clearStatus(requestId)
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Request-Id': requestId,
    },
  })
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: true, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cryptoRandomId(): string {
  // Prefer Web Crypto; fall back to a time-based pseudo-id if unavailable
  try {
    return (globalThis.crypto as Crypto).randomUUID()
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function sanitizeRequestId(candidate: unknown): string {
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim()
    const normalized = trimmed.toLowerCase()
    if (normalized && normalized.length <= MAX_REQUEST_ID_LENGTH && UUID_V4_REGEX.test(normalized)) {
      return normalized
    }
  }
  return cryptoRandomId()
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
}

function validateTextLength(name: string, value: unknown, limit: number): Response | null {
  if (typeof value !== 'string') return null
  if (value.length <= limit) return null
  return jsonError(`${name} exceeds ${limit} characters`, 413)
}

/* ── image selection (ported from the old route) ── */
const IMAGE_MAP: Record<string, string[]> = {
  dj: ['photo-1470229722913', 'photo-1493225457124', 'photo-1501386761578'],
  fashion: ['photo-1558618666-fcd25c85cd64', 'photo-1529139574466-a303027c1d8b', 'photo-1515886657613-9f3515b0c78f'],
  luxury: ['photo-1441986300917-64674bd600d8', 'photo-1524253482453-3fed8d2fe12b', 'photo-1507003211169-0a1dd7228f2d'],
  food: ['photo-1414235077428', 'photo-1504674900247-0877df9cc836', 'photo-1466637574441-749b8f19452f'],
  cannabis: ['photo-1506905925637', 'photo-1518531933037-91b2f5f229cc', 'photo-1464822759023-fed622ff2c3b'],
  creative: ['photo-1499781350541', 'photo-1542831371-29b0f74f9713', 'photo-1558591710-4b4a1ae0f435'],
  event: ['photo-1492684223066-81342ee5ff30', 'photo-1540575467063-178a50c2df87', 'photo-1429962714451-bb934ecdc4ec'],
  beach: ['photo-1507525428034-b723cf961d3e', 'photo-1506905925637', 'photo-1519046904884-53103b34b206'],
}

const CONTENT_IMAGES: Record<string, string[]> = {
  dj: ['photo-1598488035467', 'photo-1571266752482', 'photo-1516450360452', 'photo-1429962714451'],
  fashion: ['photo-1469334031218-e382a71b716b', 'photo-1558618666-fcd25c85cd64', 'photo-1529139574466-a303027c1d8b'],
  luxury: ['photo-1524253482453-3fed8d2fe12b', 'photo-1441986300917-64674bd600d8', 'photo-1507003211169-0a1dd7228f2d'],
  food: ['photo-1424847651672-bf20a4b0982b', 'photo-1414235077428', 'photo-1504674900247-0877df9cc836'],
  cannabis: ['photo-1464822759023-fed622ff2c3b', 'photo-1506905925637', 'photo-1518531933037-91b2f5f229cc'],
  creative: ['photo-1558591710-4b4a1ae0f435', 'photo-1499781350541', 'photo-1542831371-29b0f74f9713'],
  event: ['photo-1429962714451-bb934ecdc4ec', 'photo-1492684223066-81342ee5ff30', 'photo-1540575467063-178a50c2df87'],
  beach: ['photo-1519046904884-53103b34b206', 'photo-1507525428034-b723cf961d3e'],
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  dj: ['dj', 'music', 'concert', 'festival', 'nightlife', 'electronic', 'beats', 'bokeh', 'crowd', 'stage', 'golden hour'],
  fashion: ['fashion', 'streetwear', 'clothing', 'apparel', 'style', 'brand', 'wear', 'outfit', 'threads', 'drip', 'artist', 'wearable', 'culture'],
  luxury: ['luxury', 'premium', 'high-end', 'refined', 'minimal', 'elegant', 'sophisticated', 'candle'],
  food: ['restaurant', 'food', 'dining', 'cafe', 'kitchen', 'chef', 'cook', 'dish', 'menu', 'table', 'farm'],
  cannabis: ['cannabis', 'wellness', 'nature', 'organic', 'plant', 'herb', 'holistic', 'healing', 'zen'],
  creative: ['creative', 'portfolio', 'art', 'design', 'photography', 'agency', 'studio', 'work'],
  event: ['event', 'party', 'celebration', 'experience', 'exclusive', 'ticket', 'night', 'launch'],
  beach: ['beach', 'coastal', 'surf', 'ocean', 'outdoor', 'tropical', 'island', 'sea', 'wave'],
}

const DEFAULT_IMAGE = 'photo-1493225457124'

function detectCategory(text: string): string {
  let bestCategory = ''
  let bestScore = 0
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) { if (text.includes(kw)) score++ }
    if (score > bestScore) { bestScore = score; bestCategory = category }
  }
  return bestCategory || 'creative'
}

function selectHeroImage(vibe: string, heroImageDescription: string, pageType: string, mood: string, brandName: string): string {
  const text = `${heroImageDescription} ${vibe} ${pageType} ${mood}`.toLowerCase()
  const category = detectCategory(text)
  const photos = IMAGE_MAP[category] || [DEFAULT_IMAGE]
  const index = (brandName || '').length % photos.length
  return `https://images.unsplash.com/${photos[index]}?auto=format&fit=crop&w=1920&q=80`
}

function getContentImageUrls(category: string): string[] {
  const ids = CONTENT_IMAGES[category] || CONTENT_IMAGES.creative
  return ids.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`)
}

function inferDesignDirection(input: string, pageType: string): string {
  const text = `${input} ${pageType}`.toLowerCase()
  if (/(streetwear|drop|culture|sneaker|athletic|sport|wearable|artist)/.test(text)) return 'nike'
  if (/(premium|luxury|minimal|refined|timeless|product launch)/.test(text)) return 'apple'
  if (/(developer|technical|saas|platform|api|infrastructure)/.test(text)) return 'vercel'
  if (/(conversion|fintech|payments|polished saas|startup)/.test(text)) return 'stripe'
  if (/(creative|agency|portfolio|motion|immersive|experimental)/.test(text)) return 'framer'
  if (/(editorial|calm|soft|journal|reading|warm)/.test(text)) return 'notion'
  if (/(music|festival|event|club|youth)/.test(text)) return 'spotify'
  return pageType === 'store' ? 'nike' : 'framer'
}
