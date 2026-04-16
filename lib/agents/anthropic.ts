import Anthropic from '@anthropic-ai/sdk'
import { logError, logWarn } from '@/lib/logging'

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
  requestId?: string
}

function trimPrompt(text: string, limit = 2400): string {
  if (text.length <= limit) return text
  const truncated = text.slice(0, limit)
  const lastBreak = Math.max(
    truncated.lastIndexOf('\n'),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf(' '),
  )
  if (lastBreak > 0) return truncated.slice(0, lastBreak).trim()
  return truncated.trim()
}

async function attemptJsonCall<T>(
  client: Anthropic,
  opts: JsonCallOpts,
  userPrompt: string,
): Promise<{ parsed: T | null; stopReason: string | null }> {
  const res = await withTimeout(
    client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    opts.timeoutMs,
    opts.label,
  )
  const block = res.content.find(b => b.type === 'text')
  const stopReason = (res as any).stop_reason || null
  if (!block || block.type !== 'text') return { parsed: null, stopReason }
  return { parsed: parseJsonObject<T>(block.text), stopReason }
}

export async function callJsonAgent<T>(opts: JsonCallOpts): Promise<T | null> {
  const c = getClient()
  if (!c) return null
  try {
    const firstAttempt = await attemptJsonCall(c, opts, opts.user)
    if (firstAttempt.parsed !== null && firstAttempt.parsed !== undefined) return firstAttempt.parsed as T
    if (firstAttempt.stopReason === 'max_tokens') {
      const trimmedUser = trimPrompt(opts.user)
      if (trimmedUser !== opts.user) {
        logWarn('agent hit max_tokens, retrying with shorter prompt', {
          ...callMeta(opts),
          stopReason: 'max_tokens',
        })
        const retryAttempt = await attemptJsonCall(c, opts, trimmedUser)
        if (retryAttempt.parsed !== null && retryAttempt.parsed !== undefined) return retryAttempt.parsed as T
      }
    }
    return null
  } catch (err) {
    logError('agent call failed (JSON)', {
      ...callMeta(opts),
      ...normalizeError(err),
    })
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
  requestId?: string
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
    logError('agent call failed (text)', {
      ...callMeta(opts),
      ...normalizeError(err),
    })
    return null
  }
}

function callMeta(opts: { label: string; requestId?: string }) {
  return { agent: opts.label, requestId: opts.requestId }
}

function normalizeError(err: unknown) {
  if (err instanceof Error) {
    return { errorMessage: err.message, errorStack: err.stack }
  }
  const message = typeof err === 'string' ? err : String(err)
  return { errorMessage: message }
}
