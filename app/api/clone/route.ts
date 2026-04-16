import { callJsonAgent } from '@/lib/agents/anthropic'
import { MODELS } from '@/lib/agents/config'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

interface CloneRequestBody {
  url?: unknown
}

interface FirecrawlResponse {
  success?: boolean
  data?: {
    markdown?: string
  }
}

interface CloneAnalysis {
  sections: string[]
  style: string
  pacing: string
  colorMood: string
  typographyStyle: string
}

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape'
const MAX_MARKDOWN_CHARS = 12000

export async function POST(request: Request) {
  let payload: CloneRequestBody
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid JSON in request body', 400)
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonError('Invalid JSON in request body', 400)
  }

  const url = typeof payload.url === 'string' ? payload.url.trim() : ''
  if (!url) return jsonError('Missing url', 400)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return jsonError('Invalid url', 400)
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return jsonError('Invalid url', 400)
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    return jsonError('FIRECRAWL_API_KEY not configured on server', 500)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError('ANTHROPIC_API_KEY not configured on server', 500)
  }

  let markdown: string
  try {
    const fireRes = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: parsedUrl.toString(),
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })

    if (!fireRes.ok) {
      return jsonError(`Firecrawl scrape failed (HTTP ${fireRes.status})`, 500)
    }

    const data = await fireRes.json() as FirecrawlResponse
    if (!data?.data?.markdown || typeof data.data.markdown !== 'string') {
      return jsonError('Firecrawl response missing markdown', 500)
    }
    markdown = data.data.markdown.trim()
  } catch {
    return jsonError('Firecrawl scrape failed', 500)
  }

  if (!markdown) {
    return jsonError('Firecrawl response missing markdown', 500)
  }

  const trimmedMarkdown = markdown.length > MAX_MARKDOWN_CHARS
    ? markdown.slice(0, MAX_MARKDOWN_CHARS)
    : markdown

  const analysis = await callJsonAgent<CloneAnalysis>({
    model: MODELS.haiku,
    maxTokens: 500,
    timeoutMs: 12000,
    label: 'clone-analyzer',
    system: [
      'You analyze website markdown and summarize the structure and visual tone.',
      'Return JSON only with keys: sections (string[]), style, pacing, colorMood, typographyStyle.',
      'Sections should be short labels in reading order. Keep each field concise.',
    ].join(' '),
    user: `Markdown:\n\n${trimmedMarkdown}`,
  })

  if (!analysis || !isCloneAnalysis(analysis)) {
    return jsonError('Clone analysis failed', 500)
  }

  return new Response(JSON.stringify(analysis), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isCloneAnalysis(value: unknown): value is CloneAnalysis {
  if (!value || typeof value !== 'object') return false
  const candidate = value as CloneAnalysis
  return (
    Array.isArray(candidate.sections) &&
    typeof candidate.style === 'string' &&
    typeof candidate.pacing === 'string' &&
    typeof candidate.colorMood === 'string' &&
    typeof candidate.typographyStyle === 'string'
  )
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: true, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
