import type { AgentName, AgentState } from './types'

/**
 * In-memory per-request agent status map.
 *
 * IMPORTANT: serverless functions on Vercel do NOT share memory across
 * concurrent invocations, so while a long-running generate request holds
 * its lambda container, status polls from the browser will land on
 * DIFFERENT containers with empty maps. This store is therefore a
 * best-effort fallback — the primary real-time status channel is the
 * streaming body of the generate response. See orchestrator.ts for the
 * event emitter and route.ts for the ReadableStream consumer.
 *
 * A single warm container that handles both requests (rare but possible)
 * will get accurate data from this store. TTL is 2 minutes so stale
 * request IDs clean themselves up.
 */

interface Entry {
  createdAt: number
  states: Partial<Record<AgentName, AgentState>>
}

const store: Map<string, Entry> = (() => {
  const g = globalThis as unknown as { __irieAgentStatusStore?: Map<string, Entry> }
  if (!g.__irieAgentStatusStore) g.__irieAgentStatusStore = new Map()
  return g.__irieAgentStatusStore
})()

const TTL_MS = 2 * 60 * 1000

function prune() {
  const now = Date.now()
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) store.delete(id)
  }
}

export function initStatus(requestId: string) {
  prune()
  store.set(requestId, { createdAt: Date.now(), states: {} })
}

export function setStatus(requestId: string, agent: AgentName, state: AgentState) {
  const entry = store.get(requestId)
  if (!entry) {
    store.set(requestId, { createdAt: Date.now(), states: { [agent]: state } })
    return
  }
  entry.states[agent] = state
}

export function getStatus(requestId: string): Partial<Record<AgentName, AgentState>> {
  const entry = store.get(requestId)
  if (!entry) return {}
  return { ...entry.states }
}

export function clearStatus(requestId: string) {
  store.delete(requestId)
}
