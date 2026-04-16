import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type Supabase = SupabaseClient<Database>

export type EditorContext = {
  ownerId: string
  projectId: string
  generationId: string
}

/**
 * Resolve the authed user + their latest project + the project's current
 * generation id. Returns null if any piece is missing (e.g. no session, no
 * project, no generation yet — in which case edit/publish logging is a no-op).
 */
export async function getCurrentEditorContext(
  supabase: Supabase,
): Promise<EditorContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: project } = await supabase
    .from('builder_projects')
    .select('id, current_generation_id')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!project?.current_generation_id) return null
  return {
    ownerId: user.id,
    projectId: project.id,
    generationId: project.current_generation_id,
  }
}

type TextEdit = {
  kind: 'text'
  element_id: string
  before: string | null
  after: string
}
type ImageEdit = {
  kind: 'image'
  element_id: string
  // Images are base64 data URLs that can be 500KB+ — never store the full
  // payload in edit_json. A short summary is enough to audit what changed.
  before_summary: string
  after_summary: string
}
type AccentEdit = {
  kind: 'accent'
  before: string
  after: string
}
export type EditDiff = TextEdit | ImageEdit | AccentEdit

function summarizeImage(value: string): string {
  if (!value) return '<empty>'
  if (value.startsWith('data:')) {
    const mimeMatch = value.match(/^data:([^;,]+)/)
    return `<data:${mimeMatch?.[1] ?? 'unknown'} ${value.length}b>`
  }
  return value.length > 120 ? `${value.slice(0, 120)}…` : value
}

export function diffEditorState(
  prev: {
    text: Record<string, string>
    image: Record<string, string>
    accent: string
  },
  next: {
    text: Record<string, string>
    image: Record<string, string>
    accent: string
  },
): EditDiff[] {
  const diffs: EditDiff[] = []
  for (const [id, value] of Object.entries(next.text)) {
    if (prev.text[id] !== value) {
      diffs.push({
        kind: 'text',
        element_id: id,
        before: prev.text[id] ?? null,
        after: value,
      })
    }
  }
  for (const [id, value] of Object.entries(next.image)) {
    if (prev.image[id] !== value) {
      diffs.push({
        kind: 'image',
        element_id: id,
        before_summary: summarizeImage(prev.image[id] ?? ''),
        after_summary: summarizeImage(value),
      })
    }
  }
  if (prev.accent !== next.accent) {
    diffs.push({ kind: 'accent', before: prev.accent, after: next.accent })
  }
  return diffs
}

/**
 * Insert one builder_edits row per diff and UPDATE the generation's
 * final_html (and optionally agent_outputs_json) so the canonical row matches
 * what the user sees. agent_outputs_json is updated when provided so that the
 * next hydrate reads back the edited metadata (e.g. the new accent) instead
 * of the original palette. Fire-and-forget; logs on failure but never throws.
 */
export async function logEdits(
  supabase: Supabase,
  ctx: EditorContext,
  diffs: EditDiff[],
  currentHtml: string,
  agentOutputs?: Record<string, unknown> | null,
): Promise<void> {
  if (diffs.length === 0) return
  const rows = diffs.map((diff) => ({
    owner_id: ctx.ownerId,
    generation_id: ctx.generationId,
    edit_json: diff as never,
  }))
  const updateBody: {
    final_html: string
    agent_outputs_json?: never
  } = { final_html: currentHtml }
  if (agentOutputs) {
    updateBody.agent_outputs_json = agentOutputs as never
  }
  const [{ error: insertError }, { error: updateError }] = await Promise.all([
    supabase.from('builder_edits').insert(rows),
    supabase
      .from('builder_generations')
      .update(updateBody)
      .eq('id', ctx.generationId)
      .eq('owner_id', ctx.ownerId),
  ])
  if (insertError) {
    // eslint-disable-next-line no-console
    console.error('[edit-log] builder_edits insert failed', insertError)
  }
  if (updateError) {
    // eslint-disable-next-line no-console
    console.error('[edit-log] builder_generations update failed', updateError)
  }
}

/**
 * Record a publish event with the current HTML snapshot. Fire-and-forget.
 */
export async function logPublish(
  supabase: Supabase,
  ctx: EditorContext,
  publishedHtml: string,
): Promise<void> {
  const { error } = await supabase.from('builder_publishes').insert({
    owner_id: ctx.ownerId,
    generation_id: ctx.generationId,
    published_html: publishedHtml,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[edit-log] builder_publishes insert failed', error)
  }
}
