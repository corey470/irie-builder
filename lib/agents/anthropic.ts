import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared Anthropic client + safe call helpers for agent modules.
 *
 * All agent calls go through callJsonAgent (JSON output) or callTextAgent
 * (HTML output). Both enforce a per-call timeout via Promise.race so one
 * slow agent never blocks the whole pipeline past the orchestrator budget.
 */

let client: Anthropic | null = null

export function getClient(): Anthropic | null {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  client = new Anthropic({ apiKey, timeout: 20000 })
  return client
}

export function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
    promise
      .then(v => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch(err => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

interface JsonCallOpts {
  model: string
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
  label: string
}

export async function callJsonAgent<T>(opts: JsonCallOpts): Promise<T | null> {
  const c = getClient()
  if (!c) return null
  try {
    const res = await withTimeout(
      c.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      opts.timeoutMs,
      opts.label,
    )
    const block = res.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return null
    return parseJsonObject<T>(block.text)
  } catch (err) {
    console.error(`[agent:${opts.label}] failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

interface TextCallOpts {
  model: string
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
  label: string
}

export async function callTextAgent(opts: TextCallOpts): Promise<string | null> {
  const c = getClient()
  if (!c) return null
  try {
    const res = await withTimeout(
      c.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      opts.timeoutMs,
      opts.label,
    )
    const block = res.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return null
    return block.text
  } catch (err) {
    console.error(`[agent:${opts.label}] failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

/* Model IDs used by agents. Sonnet for decision-heavy roles and HTML
 * assembly; Haiku for fast specialist passes. */
export const MODELS = {
  sonnet: 'claude-sonnet-4-5',
  haiku: 'claude-haiku-4-5-20251001',
} as const
