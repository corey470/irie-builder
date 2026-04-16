/**
 * Shared types for the Irie Builder parallel agent system.
 *
 * Each visible agent produces a typed output. Every agent call MUST return
 * a value of its declared output type — if the Anthropic call fails, times
 * out, or returns unparseable JSON, the caller uses a fallback of the same
 * shape so the pipeline never breaks.
 */

export type AgentName =
  | 'creative-director'
  | 'brand-voice'
  | 'psychology-director'
  | 'art-director'
  | 'motion-director'
  | 'mobile-director'
  | 'assembler'
  | 'critic'

export type AgentState = 'waiting' | 'working' | 'done' | 'failed'

export const VISIBLE_AGENTS: Array<{ name: AgentName; label: string; description: string }> = [
  { name: 'creative-director', label: 'Creative Director', description: 'shaping the emotional target' },
  { name: 'brand-voice', label: 'Brand Voice', description: 'writing your copy' },
  { name: 'psychology-director', label: 'Psychology Director', description: 'sequencing emotion' },
  { name: 'art-director', label: 'Art Director', description: 'choosing visual language' },
  { name: 'motion-director', label: 'Motion Director', description: 'setting reveal behavior' },
  { name: 'mobile-director', label: 'Mobile Director', description: 'optimizing for handheld' },
  { name: 'assembler', label: 'Assembler', description: 'building your page' },
  { name: 'critic', label: 'Critic', description: 'preparing review' },
]

/* ── Agent input/output contracts ─────────────── */

export interface BriefInput {
  brandName?: string
  headline?: string
  ctaText?: string
  vibe?: string
  audience?: string
  rawBrief?: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
  designDirection: string
  referenceStyles: string[]
  styleBlend?: string
  emotionalControls?: {
    authority: number
    desire: number
    warmth: number
    tension: number
    spectacle: number
  }
  heroImageUrl: string
  heroImageDescription?: string
  contentImages: string[]
  userFeedback?: string
  sectionFocus?: string
  revisionDirective?: string
  carryForwardLocks?: string[]
}

export interface CreativeDirection {
  emotionalTarget: string
  energyLevel: 'restrained' | 'cinematic' | 'aggressive' | 'warm' | 'luxurious' | 'raw' | 'playful' | 'editorial'
  overallDirection: string
  creativeSummary: string
  sectionOrder: string[]
}

export interface BrandVoice {
  toneProfile: string
  heroHeadline: string
  heroSubheadline: string
  sectionCopyNotes: Array<{ section: string; note: string }>
  ctaText: string
  pullQuote: string
}

export interface PsychologyPlan {
  emotionSequence: Array<{ stage: 'recognition' | 'curiosity' | 'desire' | 'trust' | 'action'; treatment: string }>
  trustPlacement: string
  ctaTiming: string
  proofStrategy: string
  frictionPoints: string[]
}

export interface ArtDirection {
  typographySystem: {
    displayFont: string
    bodyFont: string
    scale: string
    pairing: string
  }
  colorPalette: {
    canvas: string
    accent: string
    text: string
    muted: string
    highlight: string
    notes: string
  }
  layoutRhythm: string
  contrastStrategy: string
  atmosphereSummary: string
}

export interface MotionPlan {
  motionIntensity: 'subtle' | 'editorial' | 'cinematic' | 'explosive'
  revealBehavior: string
  transitionStyle: string
  scrollRhythm: string
  atmosphereMovement: string
}

export interface MobilePlan {
  firstViewportStrategy: string
  mobileSimplifications: string[]
  thumbFriendlyNotes: string
  mobileMotionRules: string
}

export interface CritiqueScoreBlock {
  firstImpression: number
  emotionalClarity: number
  trustTiming: number
  visualDistinctiveness: number
  motionReadiness: number
  conversionPressure: number
}

export interface CriticOutput {
  verdict: string
  summary: string
  scores: CritiqueScoreBlock
  recommendations: string[]
}

export interface AgentOutputs {
  creativeDirection: CreativeDirection
  brandVoice: BrandVoice
  psychologyPlan: PsychologyPlan
  artDirection: ArtDirection
  motionPlan: MotionPlan
  mobilePlan: MobilePlan
}

/* ── Streaming event contract ─────────────────── */

export type StreamEvent =
  | { type: 'status'; agent: AgentName; state: AgentState; at: number }
  | { type: 'warning'; message: string; at: number }
  | { type: 'complete'; at: number; payload: CompletePayload }
  | { type: 'error'; at: number; message: string }

export interface CompletePayload {
  html: string
  metadata: {
    fonts: string[]
    sections: string[]
    palette: { primary: string; accent: string; background: string }
    motionVocabulary: string[]
  }
  decisions: AgentCreativeDecision[]
  critique: {
    summary: string
    verdict: string
    scores: Array<{ label: string; score: number; note: string }>
    recommendations: string[]
  }
  blueprint: LegacyBlueprint
  agentOutputs: AgentOutputs
  designDirection: string
  referenceStyles: string[]
}

export interface AgentCreativeDecision {
  label: string
  value: string
  reason: string
  agent: string
}

/* The dashboard already renders a specific blueprint shape. Keep that shape
 * stable by mapping agent outputs into it. This is a compatibility layer. */
export interface LegacyBlueprint {
  brandCore: {
    brandName: string
    brandVoice: string
    emotionalPromise: string
    audienceLens: string
  }
  storyArc: Array<{
    stage: 'recognition' | 'curiosity' | 'desire' | 'trust' | 'action'
    objective: string
    execution: string
  }>
  designSystem: {
    primaryDirection: string
    supportingDirections: string[]
    typographyStrategy: string
    paletteStrategy: string
    layoutRhythm: string
  }
  motionSystem: {
    intensity: 'subtle' | 'editorial' | 'cinematic' | 'explosive'
    style: string
    revealBehavior: string
    atmosphere: string
  }
  persuasionSystem: {
    trustStrategy: string
    proofPlacement: string
    ctaStrategy: string
    specificityNotes: string
  }
  sections: Array<{
    id: string
    role: string
    heading: string
    purpose: string
    contentDirection: string
  }>
}
