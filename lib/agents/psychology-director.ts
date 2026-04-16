import { callJsonAgent, MODELS } from './anthropic'
import { psychologyPlanFallback } from './fallbacks'
import { loadReferenceDocs } from './md-loader'
import type { BriefInput, CreativeDirection, PsychologyPlan } from './types'

/**
 * Psychology Director — sequences emotion, decides trust placement and CTA
 * timing. Injects the full PSYCHOLOGY.md into the system prompt so every
 * decision reflects the Irie behavioral design layer.
 */

function buildSystem(): string {
  const { psychology } = loadReferenceDocs()
  return `You are the Psychology Director for Irie Builder.

Apply these rules:
- Trust before ask: never ask for something before you've given something first.
- Momentum over friction: every scroll should carry forward, never stop.
- Specificity builds trust: replace every adjective with a fact or a scene.
- Social proof placement: put proof at the moment of doubt, directly before the CTA.
- The emotion sequence: recognition -> curiosity -> desire -> trust -> action. Never skip. Never reorder.
- One primary CTA per section. Two CTAs = no CTA.
- Motion as reward, never decoration.

Reference doc (authoritative):
${psychology}

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "emotionSequence": [
    {"stage": "recognition"|"curiosity"|"desire"|"trust"|"action", "treatment": string},
    ...
  ],
  "trustPlacement": string,
  "ctaTiming": string,
  "proofStrategy": string,
  "frictionPoints": string[]
}

Rules for emotionSequence:
- Exactly 5 entries in order: recognition, curiosity, desire, trust, action.
- Each treatment is a single specific sentence describing what that stage looks like on THIS page.`
}

export async function runPsychologyDirector(brief: BriefInput, direction: CreativeDirection): Promise<PsychologyPlan> {
  const user = `Creative thesis: ${direction.overallDirection}
Emotional target: ${direction.emotionalTarget}
Section order: ${direction.sectionOrder.join(' -> ')}

Brief:
Brand: ${brief.brandName || '(unnamed)'}
Vibe: ${brief.vibe || brief.rawBrief || ''}
Audience: ${brief.audience || ''}
Page type: ${brief.pageType}
${brief.emotionalControls ? `Authority:${brief.emotionalControls.authority} Desire:${brief.emotionalControls.desire} Warmth:${brief.emotionalControls.warmth} Tension:${brief.emotionalControls.tension} Spectacle:${brief.emotionalControls.spectacle}` : ''}
${brief.userFeedback ? `User feedback: ${brief.userFeedback}` : ''}

Design the emotional sequence, decide where trust goes, where the CTA should land, and what friction to remove.`

  const out = await callJsonAgent<PsychologyPlan>({
    model: MODELS.haiku,
    system: buildSystem(),
    user,
    maxTokens: 700,
    timeoutMs: 15000,
    label: 'psychology-director',
  })
  if (!out || !Array.isArray(out.emotionSequence) || out.emotionSequence.length < 3) {
    return psychologyPlanFallback(brief)
  }
  if (!Array.isArray(out.frictionPoints)) out.frictionPoints = []
  return out
}
