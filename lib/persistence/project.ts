import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  BRIEF_KEY,
  LAST_GENERATION_KEY,
  PASS_HISTORY_KEY,
  RESCUABLE_KEYS,
} from './keys'

type Supabase = SupabaseClient<Database>
type Project = Database['public']['Tables']['builder_projects']['Row']

export type ProjectResolution = {
  project: Project
  rescued: boolean
}

function safeParseJSON<T = unknown>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function readLegacy<T = unknown>(key: string): T | null {
  if (typeof window === 'undefined') return null
  return safeParseJSON<T>(window.localStorage.getItem(key))
}

function clearLegacyKeys() {
  if (typeof window === 'undefined') return
  for (const key of RESCUABLE_KEYS) {
    window.localStorage.removeItem(key)
  }
}

function deriveName(brief: { briefInput?: string; vibeText?: string } | null): string {
  const candidate = brief?.briefInput?.trim() || brief?.vibeText?.trim() || ''
  if (!candidate) return 'My Irie site'
  return candidate.slice(0, 60)
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return base || 'project'
}

/**
 * Get the user's most-recently-updated project, or null if they have none.
 */
async function fetchCurrentProject(
  supabase: Supabase,
  userId: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from('builder_projects')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Create a fresh project. If legacy localStorage keys are present, pull their
 * values in as the initial brief + generation and clear them afterwards.
 */
async function createProjectFromLegacyOrDefault(
  supabase: Supabase,
  userId: string,
): Promise<ProjectResolution> {
  type Brief = { briefInput?: string; vibeText?: string } & Record<string, unknown>
  const legacyBrief = readLegacy<Brief>(BRIEF_KEY)
  const legacyGen = readLegacy<{
    html?: string
    metadata?: unknown
    blueprint?: unknown
    critique?: unknown
    decisions?: unknown
    label?: string
    createdAt?: string
  }>(LAST_GENERATION_KEY)
  const hadLegacy = Boolean(legacyBrief || legacyGen?.html)

  const name = deriveName(legacyBrief)
  const slug = `${slugify(name)}-${Date.now()}`

  const { data: project, error: insertError } = await supabase
    .from('builder_projects')
    .insert({
      owner_id: userId,
      name,
      slug,
      brief_json: (legacyBrief ?? {}) as never,
    })
    .select('*')
    .single()
  if (insertError || !project) throw insertError ?? new Error('Project insert failed')

  // If a legacy completed generation exists, import it and point the project at it.
  if (legacyGen?.html) {
    const { data: gen, error: genError } = await supabase
      .from('builder_generations')
      .insert({
        project_id: project.id,
        owner_id: userId,
        brief_json: (legacyBrief ?? {}) as never,
        agent_outputs_json: {
          metadata: legacyGen.metadata ?? null,
          blueprint: legacyGen.blueprint ?? null,
          critique: legacyGen.critique ?? null,
          decisions: legacyGen.decisions ?? [],
          label: legacyGen.label ?? 'Rescued generation',
        } as never,
        final_html: legacyGen.html,
        status: 'complete',
        created_at: legacyGen.createdAt ?? new Date().toISOString(),
      })
      .select('id')
      .single()
    if (!genError && gen) {
      await supabase
        .from('builder_projects')
        .update({ current_generation_id: gen.id })
        .eq('id', project.id)
      project.current_generation_id = gen.id
    }
  }

  if (hadLegacy) clearLegacyKeys()

  return { project, rescued: hadLegacy }
}

/**
 * Get-or-create the current project for the authenticated user.
 * Transparently rescues legacy localStorage data on first creation.
 */
export async function getOrCreateCurrentProject(
  supabase: Supabase,
  userId: string,
): Promise<ProjectResolution> {
  const existing = await fetchCurrentProject(supabase, userId)
  if (existing) return { project: existing, rescued: false }
  return createProjectFromLegacyOrDefault(supabase, userId)
}
