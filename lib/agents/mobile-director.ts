import { callJsonAgent } from './anthropic'
import { AGENT_CONFIG } from './config'
import { mobilePlanFallback } from './fallbacks'
import { getDesignMobileAndPsychology } from './md-loader'
import type { BriefInput, CreativeDirection, MobilePlan } from './types'

/**
 * Mobile Director — owns handheld impact. Mobile is NOT a fallback; it
 * must carry the same emotional force as desktop. Runs in parallel with
 * Motion Director.
 */

function buildSystem(): string {
  const mobileBrief = getDesignMobileAndPsychology()
  return `You are the Mobile Director for Irie Builder.

Mobile is not a fallback. Mobile must carry the same emotional force as desktop. The first mobile viewport has to hit fast and hard: one image moment, one headline moment, one clear next step — all before the first scroll.

Rules:
- Design at 375px first. Every decision must work at 375px and scale up.
- Touch targets minimum 44px.
- Primary CTA lives in the bottom third of the screen (thumb zone).
- Full-width inputs and buttons on mobile. Stacked, never side-by-side.
- Grids collapse 4-col -> 2-col -> 1-col.
- Motion on mobile stays meaningful — don't strip reveals on smaller screens.

Reference (authoritative — mobile and psychology rules from DESIGN.md):
${mobileBrief}

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "firstViewportStrategy": string,
  "mobileSimplifications": string[],
  "thumbFriendlyNotes": string,
  "mobileMotionRules": string
}`
}

export async function runMobileDirector(
  brief: BriefInput,
  direction: CreativeDirection,
  requestId: string,
): Promise<MobilePlan> {
  const user = `Creative thesis: ${direction.overallDirection}
Emotional target: ${direction.emotionalTarget}

Brief:
Page type: ${brief.pageType}
Vibe: ${brief.vibe || brief.rawBrief || ''}
${brief.audience ? `Audience: ${brief.audience}` : ''}

Decide: what the first mobile viewport must contain, which desktop details to simplify, how to handle the thumb zone, and what motion rules apply to the mobile pass.`

  const out = await callJsonAgent<MobilePlan>({
    model: AGENT_CONFIG.mobileDirector.model,
    system: buildSystem(),
    user,
    maxTokens: AGENT_CONFIG.mobileDirector.maxTokens,
    timeoutMs: AGENT_CONFIG.mobileDirector.timeoutMs,
    label: 'mobile-director',
    requestId,
  })
  if (!out || !out.firstViewportStrategy) return mobilePlanFallback(brief)
  if (!Array.isArray(out.mobileSimplifications)) out.mobileSimplifications = []
  return out
}
