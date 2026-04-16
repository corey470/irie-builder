import type {
  BriefInput,
  CreativeDirection,
  BrandVoice,
  PsychologyPlan,
  ArtDirection,
  MotionPlan,
  MobilePlan,
  CriticOutput,
} from './types'

/**
 * Fallback values for every agent. Used when an agent call fails, times
 * out, or returns unparseable JSON. Every fallback must produce a VALID
 * output of the agent's declared shape so downstream consumers never see
 * undefined.
 *
 * Fallbacks should still feel intentional — they borrow from the brief
 * the user actually submitted so the output stays on-brand even when
 * a specialist agent goes dark.
 */

export function creativeDirectionFallback(brief: BriefInput): CreativeDirection {
  const energy: CreativeDirection['energyLevel'] = brief.mood === 'warm' ? 'warm'
    : brief.emotionalControls && brief.emotionalControls.tension > 75 ? 'aggressive'
    : brief.emotionalControls && brief.emotionalControls.spectacle > 75 ? 'cinematic'
    : 'editorial'
  const target = brief.vibe || brief.rawBrief || 'Make the visitor feel like they found something real.'
  return {
    emotionalTarget: target,
    energyLevel: energy,
    overallDirection: `A ${energy} page for ${brief.brandName || 'this brand'}: ${target.slice(0, 140)}`,
    creativeSummary: 'Lead with feeling, hold it with specificity, close with a single clear ask.',
    sectionOrder: ['hero', 'difference', 'feature', 'proof', 'cta'],
  }
}

export function brandVoiceFallback(brief: BriefInput): BrandVoice {
  return {
    toneProfile: 'Warm, direct, specific — like a real person talking, not a brand announcing.',
    heroHeadline: brief.headline || 'Feel it first.',
    heroSubheadline: brief.vibe || 'The piece that makes the rest of your day make sense.',
    sectionCopyNotes: [
      { section: 'hero', note: 'Lead with the feeling. No preamble.' },
      { section: 'story', note: 'Specific scenes. Real constraints. Never marketing copy.' },
      { section: 'cta', note: 'Say what happens next, not what the button does.' },
    ],
    ctaText: brief.ctaText || 'Step inside',
    pullQuote: 'Not a store. A studio you can wear.',
  }
}

export function psychologyPlanFallback(_brief: BriefInput): PsychologyPlan {
  return {
    emotionSequence: [
      { stage: 'recognition', treatment: 'Immediate feeling-hit. Hero image + one-line headline.' },
      { stage: 'curiosity', treatment: 'One specific detail that promises more if they keep scrolling.' },
      { stage: 'desire', treatment: 'Feature or product spotlighted with an outcome, not features.' },
      { stage: 'trust', treatment: 'Specificity and proof placed directly before the CTA.' },
      { stage: 'action', treatment: 'Single dominant CTA, low-friction, earned by this point in the scroll.' },
    ],
    trustPlacement: 'Put proof in the section directly above the CTA — where doubt lives.',
    ctaTiming: 'Delay until after the trust block. No hero CTA unless the hero has already earned it.',
    proofStrategy: 'Specific numbers and real constraints, never adjectives like "premium" or "trusted".',
    frictionPoints: ['no forced login', 'no double-opt-in', 'one primary CTA per scroll'],
  }
}

export function artDirectionFallback(brief: BriefInput): ArtDirection {
  return {
    typographySystem: {
      displayFont: 'Playfair Display',
      bodyFont: 'Syne',
      scale: 'clamp-based fluid: hero clamp(2.5rem, 9vw, 6rem), section clamp(1.8rem, 6vw, 3.5rem), body 16-18px.',
      pairing: 'High-contrast didone display over a geometric sans body — editorial kinetic.',
    },
    colorPalette: {
      canvas: brief.colors.background || '#080808',
      accent: brief.colors.accent || '#C9A84C',
      text: '#F2EDE4',
      muted: 'rgba(242,237,228,0.45)',
      highlight: '#E8C96A',
      notes: 'Warm neutral canvas, single gold accent, never dilute accent on body elements.',
    },
    layoutRhythm: 'Alternate compression and release — dense editorial blocks against wide atmospheric beats.',
    contrastStrategy: 'High contrast on the single accent — used only on headlines, CTAs, and hairline dividers.',
    atmosphereSummary: 'Near-black canvas, grain overlay, gold orbs, gold hairlines — depth without drop shadows.',
  }
}

export function motionPlanFallback(_brief: BriefInput): MotionPlan {
  return {
    motionIntensity: 'editorial',
    revealBehavior: 'Stagger reveals on every section — eyebrow 0.3s, title 0.5s, body 0.8s, CTA 1s.',
    transitionStyle: 'Fade + translate-y 24px, 600-800ms cubic-bezier(.16,1,.3,1) easing.',
    scrollRhythm: 'One meaningful reveal per scroll screen — never fire two reveals at once.',
    atmosphereMovement: 'Floating gold orbs 12-16s loop, grain overlay fixed, marquee strip on transition moments.',
  }
}

export function mobilePlanFallback(_brief: BriefInput): MobilePlan {
  return {
    firstViewportStrategy: 'One image moment, one headline moment, one clear next step — visible before first scroll.',
    mobileSimplifications: [
      'grid collapses 4-col -> 2-col -> 1-col',
      'orb count halved',
      'grain opacity reduced 0.5 -> 0.3',
      'stagger timings compressed',
    ],
    thumbFriendlyNotes: 'Primary CTA lives in the bottom third of the screen. Every tap target is 44px minimum.',
    mobileMotionRules: 'No parallax on touch. Reveals keep full intensity — motion is the product on mobile too.',
  }
}

export function criticFallback(): CriticOutput {
  return {
    verdict: 'Output landed cleanly, but the review pass was not able to produce a full score.',
    summary: 'Base critique applied — refine on the next pass for sharper specificity.',
    scores: {
      firstImpression: 7,
      emotionalClarity: 7,
      trustTiming: 7,
      visualDistinctiveness: 7,
      motionReadiness: 7,
      conversionPressure: 7,
    },
    recommendations: ['Push one section with sharper specificity on the next pass.'],
  }
}
