import { getStatus } from '@/lib/agents/status-store'
import type { AgentName, AgentState } from '@/lib/agents/types'
import { VISIBLE_AGENTS } from '@/lib/agents/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/generate/status?requestId=xxx
 *
 * Returns the current agent status for a given request ID.
 *
 * LIMITATION: serverless invocations on Vercel do not share memory, so
 * this endpoint is a best-effort compatibility shim — a poll can land on
 * a different container than the generator and return empty state. The
 * primary real-time channel is the streaming body of POST /api/generate,
 * which emits the same status events without the cross-container risk.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')
  if (!requestId) {
    return jsonResponse({ error: true, message: 'Missing requestId' }, 400)
  }
  const states = getStatus(requestId)
  // Fill in any missing agents with 'waiting' so the UI renders a stable roster
  const full: Record<AgentName, AgentState> = {} as Record<AgentName, AgentState>
  for (const a of VISIBLE_AGENTS) {
    full[a.name] = states[a.name] ?? 'waiting'
  }
  return jsonResponse({ requestId, statuses: full, resolved: Object.keys(states).length > 0 }, 200)
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-transform' },
  })
}
