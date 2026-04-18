import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  BRIEF_KEY,
  LAST_GENERATION_KEY,
  PASS_HISTORY_KEY,
} from './keys'

type Supabase = SupabaseClient<Database>
type Project = Database['public']['Tables']['builder_projects']['Row']

/**
 * Write the authenticated user's project state into localStorage so that
 * builder-platform.tsx (which reads synchronously on mount) sees fresh
 * Supabase-backed data. Must run BEFORE the builder components render.
 */
export async function hydrateLocalStorage(
  supabase: Supabase,
  project: Project,
): Promise<void> {
  if (typeof window === 'undefined') return

  // Brief
  const briefJson = project.brief_json ?? {}
  window.localStorage.setItem(BRIEF_KEY, JSON.stringify(briefJson))

  // Latest completed generation. If Supabase errors, THROW — the caller
  // (PersistenceGate) will catch and fall back to anonymous/offline mode.
  // Do NOT clear LAST_GENERATION_KEY on a transient DB error; that would
  // silently wipe the user's work. We only remove it when we definitively
  // know no generation exists (no error AND no data).
  const { data: latestGen, error: latestGenError } = await supabase
    .from('builder_generations')
    .select('*')
    .eq('project_id', project.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestGenError) {
    throw new Error(
      `hydrate: failed to load latest generation (${latestGenError.message})`,
    )
  }

  if (latestGen && latestGen.final_html) {
    const agentOutputs = (latestGen.agent_outputs_json ?? {}) as {
      metadata?: unknown
      blueprint?: unknown
      critique?: unknown
      decisions?: unknown
      label?: string
    }
    const snapshot = {
      html: latestGen.final_html,
      metadata: agentOutputs.metadata ?? null,
      blueprint: agentOutputs.blueprint ?? null,
      critique: agentOutputs.critique ?? null,
      decisions: Array.isArray(agentOutputs.decisions) ? agentOutputs.decisions : [],
      label: agentOutputs.label ?? 'Generation',
      createdAt: latestGen.created_at,
    }
    window.localStorage.setItem(LAST_GENERATION_KEY, JSON.stringify(snapshot))
  } else {
    window.localStorage.removeItem(LAST_GENERATION_KEY)
  }

  // Pass history (derived from completed generations, chronological)
  const { data: allComplete, error: historyError } = await supabase
    .from('builder_generations')
    .select('agent_outputs_json, created_at')
    .eq('project_id', project.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: true })

  if (historyError) {
    throw new Error(
      `hydrate: failed to load generation history (${historyError.message})`,
    )
  }

  const history = (allComplete ?? []).map((g, i) => {
    const outputs = (g.agent_outputs_json ?? {}) as {
      label?: string
      critique?: { verdict?: string }
    }
    return {
      label: outputs.label ?? `Generation ${i + 1}`,
      verdict: outputs.critique?.verdict ?? '',
    }
  })
  window.localStorage.setItem(PASS_HISTORY_KEY, JSON.stringify(history))
}
