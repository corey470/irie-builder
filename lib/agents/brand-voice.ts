import { callJsonAgent } from './anthropic'
import { AGENT_CONFIG } from './config'
import { brandVoiceFallback } from './fallbacks'
import type { BriefInput, BrandVoice, CreativeDirection } from './types'

/**
 * Brand Voice — owns language, tone, and the copy that will appear on the
 * page. Runs in parallel with Psychology Director and Art Director after
 * the Creative Director sets the emotional target.
 */

const SYSTEM = `You are the Brand Voice agent for Irie Builder. You write copy that sounds human and lived-in. Never generic marketing language. Be specific to THIS brand. Short sentences. Real words.

Rules from PSYCHOLOGY.md:
- Write like you're talking to someone at a stoplight.
- Avoid the literal words section, scroll, CTA, trust, friction, and placement in any user-facing sentence.
- Replace every adjective with a fact or a scene.
- Headlines: max 8 words, present tense, feeling-first.
- CTAs: say what happens next, not what the button does ("Step inside" > "Learn More").
- If it sounds like an ad, rewrite it.
- If the user supplied a verbatim headline or CTA, use it EXACTLY. Do not paraphrase.

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "toneProfile": string,
  "heroHeadline": string,
  "heroSubheadline": string,
  "sectionCopyNotes": [{"section": string, "note": string}, ...],
  "ctaText": string,
  "pullQuote": string
}`

export async function runBrandVoice(
  brief: BriefInput,
  direction: CreativeDirection,
  requestId: string,
): Promise<BrandVoice> {
  const user = `Creative thesis: ${direction.overallDirection}
Emotional target: ${direction.emotionalTarget}
Energy level: ${direction.energyLevel}

Brief:
Brand: ${brief.brandName || '(invent one — short, specific, ownable)'}
Vibe: ${brief.vibe || brief.rawBrief || ''}
Audience: ${brief.audience || '(infer from vibe)'}
Mood: ${brief.mood}
Page type: ${brief.pageType}
${brief.headline ? `Verbatim hero headline (use as-is): ${brief.headline}` : ''}
${brief.ctaText ? `Verbatim CTA (use as-is): ${brief.ctaText}` : ''}
${brief.userFeedback ? `User feedback: ${brief.userFeedback}` : ''}

Write copy for: hero headline, hero subheadline, one-line notes for 3-5 sections (hero, story, feature, proof, cta), the CTA button text, and a pull-quote that could sit in a trust section.`

  const out = await callJsonAgent<BrandVoice>({
    model: AGENT_CONFIG.brandVoice.model,
    system: SYSTEM,
    user,
    maxTokens: AGENT_CONFIG.brandVoice.maxTokens,
    timeoutMs: AGENT_CONFIG.brandVoice.timeoutMs,
    label: 'brand-voice',
    requestId,
  })
  if (!out || !out.heroHeadline) return brandVoiceFallback(brief)
  // Respect verbatim inputs even if the agent tried to paraphrase
  if (brief.headline) out.heroHeadline = brief.headline
  if (brief.ctaText) out.ctaText = brief.ctaText
  if (!Array.isArray(out.sectionCopyNotes)) out.sectionCopyNotes = []
  return out
}
