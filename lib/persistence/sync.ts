import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  BRIEF_KEY,
  LAST_GENERATION_KEY,
  STORAGE_EVENT,
} from './keys'

type Supabase = SupabaseClient<Database>

type GenerationSnapshot = {
  html?: string
  metadata?: unknown
  blueprint?: unknown
  critique?: unknown
  decisions?: unknown
  label?: string
  createdAt?: string
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Listen to the builder's custom storage events and mirror changes to Supabase.
 *
 * - BRIEF changes   → debounced 800ms → UPDATE builder_projects.brief_json
 * - LAST_GENERATION → INSERT builder_generations (dedup by createdAt) + UPDATE
 *                     builder_projects.current_generation_id
 *
 * PASS_HISTORY, PENDING_GENERATION, and RAIL are intentionally skipped —
 * they're either derived (history), ephemeral (pending), or UI-local (rail).
 */
export function attachSupabaseSync(
  supabase: Supabase,
  userId: string,
  projectId: string,
): () => void {
  let briefTimer: ReturnType<typeof setTimeout> | null = null
  // Seed the dedup guard from whatever hydrate just wrote into localStorage so
  // that the first edit (which preserves createdAt) doesn't trigger a duplicate
  // INSERT of the generation that Supabase already has.
  let lastSyncedGenAt: string | null =
    typeof window === 'undefined'
      ? null
      : safeParseJSON<GenerationSnapshot>(
          window.localStorage.getItem(LAST_GENERATION_KEY),
        )?.createdAt ?? null

  async function pushBrief() {
    if (typeof window === 'undefined') return
    const brief = safeParseJSON<Record<string, unknown>>(
      window.localStorage.getItem(BRIEF_KEY),
    )
    if (!brief) return
    const { error } = await supabase
      .from('builder_projects')
      .update({ brief_json: brief as never })
      .eq('id', projectId)
      .eq('owner_id', userId)
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[persistence] brief sync failed', error)
    }
  }

  async function pushGeneration() {
    if (typeof window === 'undefined') return
    const snapshot = safeParseJSON<GenerationSnapshot>(
      window.localStorage.getItem(LAST_GENERATION_KEY),
    )
    if (!snapshot?.html) return
    const createdAt = snapshot.createdAt ?? new Date().toISOString()
    if (lastSyncedGenAt === createdAt) return
    lastSyncedGenAt = createdAt

    const briefJson =
      safeParseJSON<Record<string, unknown>>(
        window.localStorage.getItem(BRIEF_KEY),
      ) ?? {}

    const { data: gen, error: insertError } = await supabase
      .from('builder_generations')
      .insert({
        project_id: projectId,
        owner_id: userId,
        brief_json: briefJson as never,
        agent_outputs_json: {
          metadata: snapshot.metadata ?? null,
          blueprint: snapshot.blueprint ?? null,
          critique: snapshot.critique ?? null,
          decisions: snapshot.decisions ?? [],
          label: snapshot.label ?? 'Generation',
        } as never,
        final_html: snapshot.html,
        status: 'complete',
        created_at: createdAt,
      })
      .select('id')
      .single()
    if (insertError || !gen) {
      // eslint-disable-next-line no-console
      console.error('[persistence] generation sync failed', insertError)
      lastSyncedGenAt = null
      return
    }
    await supabase
      .from('builder_projects')
      .update({ current_generation_id: gen.id })
      .eq('id', projectId)
      .eq('owner_id', userId)
  }

  function handler(event: Event) {
    const detail = (event as CustomEvent<{ key?: string }>).detail
    const key = detail?.key
    if (!key) return

    if (key === BRIEF_KEY) {
      if (briefTimer) clearTimeout(briefTimer)
      briefTimer = setTimeout(() => {
        void pushBrief()
      }, 800)
      return
    }
    if (key === LAST_GENERATION_KEY) {
      void pushGeneration()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(STORAGE_EVENT, handler as EventListener)
  }

  return () => {
    if (briefTimer) clearTimeout(briefTimer)
    if (typeof window !== 'undefined') {
      window.removeEventListener(STORAGE_EVENT, handler as EventListener)
    }
  }
}

/**
 * Record that a generation's seed matches what's already in Supabase.
 * Called immediately after hydration so the first storage event doesn't
 * re-INSERT a row that just came from Supabase.
 */
export function primeGenerationGuard(createdAt: string | null): string | null {
  return createdAt
}
