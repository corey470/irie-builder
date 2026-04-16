import { callJsonAgent, MODELS } from './anthropic'
import { motionPlanFallback } from './fallbacks'
import { getDesignMotionBrief } from './md-loader'
import type { BriefInput, CreativeDirection, ArtDirection, MotionPlan } from './types'

/**
 * Motion Director — shapes scroll rhythm, reveal behavior, and the
 * atmospheric movement system. Receives the Art Director's visual system
 * so motion can be tuned to match contrast and density.
 */

function buildSystem(): string {
  const motionBrief = getDesignMotionBrief()
  return `You are the Motion Director for Irie Builder.

Motion should feel meaningful, not decorative. Every reveal rewards attention and feels earned.

Rules:
- motionIntensity is one of: subtle, editorial, cinematic, explosive.
- revealBehavior describes HOW content enters (fade + translate, scale, split text, etc) with timing.
- transitionStyle describes easing and duration (cubic-bezier, ms) — be specific.
- scrollRhythm is one sentence about cadence: how many reveals per viewport, and when to pause.
- atmosphereMovement describes background/ambient motion: orbs, grain, marquee, parallax.

Motion reference from DESIGN.md:
${motionBrief}

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "motionIntensity": "subtle"|"editorial"|"cinematic"|"explosive",
  "revealBehavior": string,
  "transitionStyle": string,
  "scrollRhythm": string,
  "atmosphereMovement": string
}`
}

export async function runMotionDirector(
  brief: BriefInput,
  direction: CreativeDirection,
  art: ArtDirection,
): Promise<MotionPlan> {
  const user = `Creative thesis: ${direction.overallDirection}
Energy level: ${direction.energyLevel}
Visual atmosphere: ${art.atmosphereSummary}
Layout rhythm: ${art.layoutRhythm}

Brief:
Mood: ${brief.mood}
Page type: ${brief.pageType}
${brief.emotionalControls ? `Tension:${brief.emotionalControls.tension} Spectacle:${brief.emotionalControls.spectacle}` : ''}

Decide the motion personality for this page — intensity, reveals, transitions, scroll rhythm, ambient atmosphere.`

  const out = await callJsonAgent<MotionPlan>({
    model: MODELS.haiku,
    system: buildSystem(),
    user,
    maxTokens: 500,
    timeoutMs: 15000,
    label: 'motion-director',
  })
  if (!out || !out.motionIntensity) return motionPlanFallback(brief)
  return out
}
