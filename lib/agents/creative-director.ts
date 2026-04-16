import { callJsonAgent, MODELS } from './anthropic'
import { creativeDirectionFallback } from './fallbacks'
import type { BriefInput, CreativeDirection } from './types'

/**
 * Creative Director — sets the emotional target for the page.
 * First in the pipeline. Every other agent receives this output.
 */

const SYSTEM = `You are the Creative Director for Irie Builder. Your job is to read the brief and set the ONE emotional target for the entire page.

Be decisive and specific. Never generic. Choose a clear angle: cinematic, raw, luxurious, aggressive, warm, editorial, playful, restrained.

Rules:
- The emotional target is a single sentence describing what the visitor should feel in the first 3 seconds.
- energyLevel must be one of: restrained, cinematic, aggressive, warm, luxurious, raw, playful, editorial.
- overallDirection is one sentence — the creative thesis for this pass.
- creativeSummary is one sentence describing how the page moves from arrival to action.
- sectionOrder is an array of short section slugs in the order they should appear.

Output ONLY valid JSON. No markdown. No explanation. No backticks.

Schema:
{
  "emotionalTarget": string,
  "energyLevel": "restrained"|"cinematic"|"aggressive"|"warm"|"luxurious"|"raw"|"playful"|"editorial",
  "overallDirection": string,
  "creativeSummary": string,
  "sectionOrder": string[]
}`

export async function runCreativeDirector(brief: BriefInput): Promise<CreativeDirection> {
  const user = buildUserPrompt(brief)
  const out = await callJsonAgent<CreativeDirection>({
    model: MODELS.sonnet,
    system: SYSTEM,
    user,
    maxTokens: 500,
    timeoutMs: 15000,
    label: 'creative-director',
  })
  if (!out || !out.emotionalTarget || !out.energyLevel) {
    return creativeDirectionFallback(brief)
  }
  // Guarantee sectionOrder exists
  if (!Array.isArray(out.sectionOrder) || out.sectionOrder.length === 0) {
    out.sectionOrder = ['hero', 'difference', 'feature', 'proof', 'cta']
  }
  return out
}

function buildUserPrompt(brief: BriefInput): string {
  const parts: string[] = []
  if (brief.rawBrief) parts.push(`RAW BRIEF: "${brief.rawBrief}"`)
  if (brief.brandName) parts.push(`Brand: ${brief.brandName}`)
  if (brief.vibe) parts.push(`Vibe: ${brief.vibe}`)
  if (brief.audience) parts.push(`Audience: ${brief.audience}`)
  if (brief.headline) parts.push(`Headline (verbatim): ${brief.headline}`)
  parts.push(`Mood: ${brief.mood} | Page type: ${brief.pageType} | Direction: ${brief.designDirection}`)
  if (brief.referenceStyles.length) parts.push(`Reference styles: ${brief.referenceStyles.join(', ')}`)
  if (brief.emotionalControls) {
    const ec = brief.emotionalControls
    parts.push(`Emotional weights — authority:${ec.authority} desire:${ec.desire} warmth:${ec.warmth} tension:${ec.tension} spectacle:${ec.spectacle}`)
  }
  if (brief.userFeedback) parts.push(`User feedback (HIGHEST priority): ${brief.userFeedback}`)
  return parts.join('\n')
}
