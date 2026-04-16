import { callJsonAgent, MODELS } from './anthropic'
import { criticFallback } from './fallbacks'
import type { AgentOutputs, CriticOutput } from './types'

/**
 * Critic — reviews the final HTML and scores it across six dimensions
 * from 1-10. Runs after the Assembler and is the last step before the
 * orchestrator emits the complete payload.
 */

const SYSTEM = `You are the Critic for Irie Builder.

Score the output honestly from 1 (poor) to 10 (exceptional) on each dimension. Identify what is working and what is not. Be direct and specific. Generic praise is failure.

Dimensions:
- firstImpression: does the page hit in the first 3 seconds?
- emotionalClarity: is the emotional intent unmistakable?
- trustTiming: does proof land where doubt lives?
- visualDistinctiveness: does it feel memorable or template-safe?
- motionReadiness: is motion reinforcing the story or decorating it?
- conversionPressure: does desire build enough before the ask?

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "verdict": string,
  "summary": string,
  "scores": {
    "firstImpression": number,
    "emotionalClarity": number,
    "trustTiming": number,
    "visualDistinctiveness": number,
    "motionReadiness": number,
    "conversionPressure": number
  },
  "recommendations": string[]
}

Scores must be integers 1-10. Recommendations must be specific and actionable (never "improve further").`

export async function runCritic(html: string, agents: AgentOutputs): Promise<CriticOutput> {
  // Feed a trimmed HTML + agent plan so the Critic has context without
  // blowing past token limits.
  const htmlSample = sampleHtml(html)
  const user = `Agent plan the page was built against:
- Creative thesis: ${agents.creativeDirection.overallDirection}
- Emotional target: ${agents.creativeDirection.emotionalTarget}
- Tone: ${agents.brandVoice.toneProfile}
- Motion intensity: ${agents.motionPlan.motionIntensity}
- Trust placement: ${agents.psychologyPlan.trustPlacement}

HTML sample (hero + section heads + CTAs):
${htmlSample}

Score this honestly. If anything is generic, say so in the recommendations.`

  const out = await callJsonAgent<CriticOutput>({
    model: MODELS.haiku,
    system: SYSTEM,
    user,
    maxTokens: 500,
    timeoutMs: 8000,
    label: 'critic',
  })
  if (!out || !out.scores) return criticFallback()
  // Clamp scores to 1-10
  const keys: Array<keyof CriticOutput['scores']> = [
    'firstImpression', 'emotionalClarity', 'trustTiming',
    'visualDistinctiveness', 'motionReadiness', 'conversionPressure',
  ]
  for (const k of keys) {
    const v = Number(out.scores[k])
    out.scores[k] = Number.isFinite(v) ? Math.max(1, Math.min(10, Math.round(v))) : 7
  }
  if (!Array.isArray(out.recommendations)) out.recommendations = []
  return out
}

function sampleHtml(html: string): string {
  // Keep title, meta, h1/h2/h3, button text, CTA — drop inline CSS / scripts.
  const strippedStyle = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  const matches: string[] = []
  const title = strippedStyle.match(/<title>([\s\S]*?)<\/title>/i)
  if (title) matches.push(`TITLE: ${title[1].trim()}`)
  for (const m of strippedStyle.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    matches.push(`H${m[1]}: ${m[2].replace(/<[^>]+>/g, '').trim()}`)
  }
  for (const m of strippedStyle.matchAll(/<(?:a|button)[^>]*class="[^"]*(?:cta|btn|button)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)) {
    matches.push(`CTA: ${m[1].replace(/<[^>]+>/g, '').trim()}`)
  }
  const comment = strippedStyle.match(/<!--\s*CREATIVE DECISIONS[\s\S]*?-->/i)
  if (comment) matches.push(comment[0])
  return matches.join('\n').slice(0, 3500)
}
