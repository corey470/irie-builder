'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/* ── TYPES ─────────────────────────────────────── */

interface GeneratePayload {
  brandName: string
  headline: string
  heroImageUrl: string
  heroImageDescription: string
  ctaText: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
  designDirection: DesignDirectionOption
  styleBlend?: string
  referenceStyles?: string[]
  emotionalControls?: EmotionalControls
  sectionFocus?: string
  revisionDirective?: string
  carryForwardLocks?: string[]
  userFeedback?: string
  rawBrief?: string
}

interface Metadata {
  fonts: string[]
  sections: string[]
  palette: { primary: string; accent: string; background: string }
  motionVocabulary: string[]
}

interface CreativeDecision {
  label: string
  value: string
  reason: string
  agent?: string
}

type AgentName =
  | 'creative-director'
  | 'brand-voice'
  | 'psychology-director'
  | 'art-director'
  | 'motion-director'
  | 'mobile-director'
  | 'assembler'
  | 'critic'

type AgentState = 'waiting' | 'working' | 'done' | 'failed'

const AGENT_ROSTER: Array<{ name: AgentName; label: string; description: string }> = [
  { name: 'creative-director', label: 'Creative Director', description: 'shaping the emotional target' },
  { name: 'brand-voice', label: 'Brand Voice', description: 'writing your copy' },
  { name: 'psychology-director', label: 'Psychology Director', description: 'sequencing emotion' },
  { name: 'art-director', label: 'Art Director', description: 'choosing visual language' },
  { name: 'motion-director', label: 'Motion Director', description: 'setting reveal behavior' },
  { name: 'mobile-director', label: 'Mobile Director', description: 'optimizing for handheld' },
  { name: 'assembler', label: 'Assembler', description: 'building your page' },
  { name: 'critic', label: 'Critic', description: 'preparing review' },
]

type AgentStatusMap = Partial<Record<AgentName, AgentState>>

function emptyAgentStatus(): AgentStatusMap {
  const m: AgentStatusMap = {}
  for (const a of AGENT_ROSTER) m[a.name] = 'waiting'
  return m
}

function stateLabel(state: AgentState): string {
  switch (state) {
    case 'waiting': return 'waiting'
    case 'working': return 'working'
    case 'done': return 'done'
    case 'failed': return 'fallback'
  }
}

interface EmotionalControls {
  authority: number
  desire: number
  warmth: number
  tension: number
  spectacle: number
}

interface GenerationBlueprint {
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

interface CritiqueScore {
  label: string
  score: number
  note: string
}

interface GenerationCritique {
  summary: string
  verdict: string
  scores: CritiqueScore[]
  recommendations: string[]
}

interface GenerationSnapshot {
  html: string
  blueprint: GenerationBlueprint | null
  critique: GenerationCritique | null
  label: string
}

interface ChangeSummary {
  headline: string
  improvements: string[]
  shifts: string[]
}

function buildGenerationLabel(params: {
  nextCount: number
  sectionFocus: string
  revisionDirective: string
}): string {
  const { nextCount, sectionFocus, revisionDirective } = params
  if (revisionDirective.trim()) return `Gen ${nextCount}: ${revisionDirective.trim().slice(0, 48)}`
  if (sectionFocus !== 'whole-page') return `Gen ${nextCount}: ${sectionFocus}`
  return `Generation #${nextCount}`
}

function summarizeChange(previous: GenerationSnapshot | null, currentBlueprint: GenerationBlueprint | null, currentCritique: GenerationCritique | null): ChangeSummary | null {
  if (!previous?.blueprint || !previous?.critique || !currentBlueprint || !currentCritique) return null

  const previousScores = new Map(previous.critique.scores.map(score => [score.label, score.score]))
  const improvements = currentCritique.scores
    .map(score => ({
      label: score.label,
      delta: score.score - (previousScores.get(score.label) ?? score.score),
    }))
    .filter(item => item.delta >= 4)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map(item => `${item.label} improved by ${item.delta} points.`)

  const shifts: string[] = []

  if (previous.blueprint.motionSystem.intensity !== currentBlueprint.motionSystem.intensity) {
    shifts.push(`Motion shifted from ${previous.blueprint.motionSystem.intensity} to ${currentBlueprint.motionSystem.intensity}.`)
  }
  if (previous.blueprint.designSystem.primaryDirection !== currentBlueprint.designSystem.primaryDirection) {
    shifts.push(`Primary direction moved from ${previous.blueprint.designSystem.primaryDirection} to ${currentBlueprint.designSystem.primaryDirection}.`)
  }
  if (previous.blueprint.sections[0]?.heading !== currentBlueprint.sections[0]?.heading) {
    shifts.push(`The opening section changed from “${previous.blueprint.sections[0]?.heading}” to “${currentBlueprint.sections[0]?.heading}.”`)
  }
  if (previous.blueprint.persuasionSystem.proofPlacement !== currentBlueprint.persuasionSystem.proofPlacement) {
    shifts.push('Proof placement strategy changed to alter trust timing.')
  }

  const headline = improvements.length > 0
    ? 'This pass made meaningful progress.'
    : 'This pass changed direction more than raw score.'

  return {
    headline,
    improvements,
    shifts: shifts.slice(0, 3),
  }
}

type MoodOption = 'light' | 'dark' | 'warm'
type PageOption = 'landing' | 'store' | 'portfolio' | 'event'
type DesignDirectionOption = 'auto' | 'nike' | 'apple' | 'vercel' | 'stripe' | 'framer' | 'notion' | 'spotify'
type ReferenceStyleOption =
  | 'linear'
  | 'supabase'
  | 'raycast'
  | 'cursor'
  | 'claude'
  | 'airbnb'
  | 'figma'
  | 'runwayml'
  | 'spacex'
  | 'uber'
  | 'ferrari'
  | 'lamborghini'
  | 'pinterest'
  | 'webflow'
  | 'notion'
  | 'vercel'
  | 'stripe'
  | 'apple'
  | 'nike'
  | 'spotify'

function isReferenceStyleOption(value: string): value is ReferenceStyleOption {
  return REFERENCE_STYLE_LIBRARY.some(style => style.value === value)
}

/* ── INTENT DETECTION (UPGRADE 2) ─────────────── */

const BRAND_KEYWORDS = ['dj', 'restaurant', 'streetwear', 'luxury', 'cannabis', 'jewelry', 'fitness', 'salon', 'bar', 'event', 'portfolio', 'photography', 'yoga', 'bakery', 'coffee', 'tattoo', 'music', 'fashion', 'creative', 'candle', 'catering', 'florist', 'barber', 'spa', 'club', 'gallery']
const MOOD_KEYWORDS = ['dark', 'light', 'moody', 'minimal', 'bold', 'warm', 'vibrant', 'earthy', 'clean', 'premium', 'edgy', 'soft', 'electric', 'chill', 'elevated', 'raw', 'elegant', 'gritty', 'dreamy', 'atmospheric']
const AUDIENCE_KEYWORDS = ['women', 'men', 'local', 'community', 'culture', 'lovers', 'fans', 'seekers', 'professionals', 'young', 'millennials', 'gen z']
const LOCATION_KEYWORDS = ['miami', 'brooklyn', 'nashville', 'atlanta', 'la', 'los angeles', 'new york', 'chicago', 'london', 'austin', 'portland', 'oakland', 'detroit', 'tokyo', 'paris', 'toronto', 'seattle', 'denver', 'houston', 'philly', 'memphis']
const ACTION_KEYWORDS = ['sell', 'serve', 'book', 'perform', 'create', 'make', 'build', 'offer', 'teach', 'design', 'cook', 'host']

function analyzeIntent(input: string): number {
  const lower = input.toLowerCase()
  let score = 0
  if (BRAND_KEYWORDS.some(kw => lower.includes(kw))) score += 2
  if (MOOD_KEYWORDS.some(kw => lower.includes(kw))) score += 2
  if (AUDIENCE_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (LOCATION_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (ACTION_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (input.trim().split(/\s+/).length > 6) score += 1
  return score
}

/* ── CHAT QUESTION DEFINITIONS ────────────────── */

interface ChatQuestion {
  key: string
  question: string
  placeholder: string
}

const CHAT_QUESTIONS: ChatQuestion[] = [
  { key: 'brandName', question: "What's your brand called?", placeholder: '' },
  { key: 'vibe', question: 'What do you want someone to feel when they land here?', placeholder: 'e.g. Warm, like a festival at golden hour. Art you wear. Peace you carry.' },
  { key: 'audience', question: 'Who are you talking to?', placeholder: 'e.g. Culture-driven fashion lovers who live at the intersection of music and art.' },
  { key: 'headline', question: "What's your hero headline — the first thing they read?", placeholder: 'e.g. Art you wear. Peace you carry.' },
  { key: 'heroImage', question: 'Got an image for your hero? Paste a URL — or describe what it should feel like and the AI will find one.', placeholder: 'e.g. A hand reaching up at a concert, atmospheric, bokeh lights' },
  { key: 'ctaText', question: 'What do you want them to do?', placeholder: 'e.g. Shop the collection, Reserve a table, Join the community' },
]

/* ── PRESETS ───────────────────────────────────── */

interface Preset {
  label: string
  answers: string[]
  mood: MoodOption
  pageType: PageOption
  designDirection: DesignDirectionOption
  colors: { primary: string; accent: string; background: string }
}

const PRESETS: Preset[] = [
  {
    label: 'Streetwear Brand',
    answers: ['Your Brand', 'Bold, urban, premium streetwear. The energy of a drop day. Confident, slightly rebellious, always authentic.', 'Culture-driven streetwear fans 18-35', 'Built different. Worn proud.', 'skip', 'Shop the Drop'],
    mood: 'dark', pageType: 'store', designDirection: 'nike',
    colors: { primary: '#0A0A0A', accent: '#E8C547', background: '#0A0A0A' },
  },
  {
    label: 'Luxury Brand',
    answers: ['Your Brand', 'Quiet luxury. Refined, minimal, timeless. The feeling of quality before you even touch it.', 'Discerning buyers 30-55 who value craftsmanship over logos', 'Refined by design. Defined by you.', 'skip', 'Explore the Collection'],
    mood: 'light', pageType: 'store', designDirection: 'apple',
    colors: { primary: '#1A1A1A', accent: '#C9A84C', background: '#F8F5F0' },
  },
  {
    label: 'Restaurant',
    answers: ['Your Restaurant', 'Warm, soulful, inviting. The smell of something good cooking. Neighborhood spot with a premium feel.', 'Local food lovers and experience seekers 25-55', 'Food that stays with you.', 'skip', 'Reserve a Table'],
    mood: 'warm', pageType: 'landing', designDirection: 'notion',
    colors: { primary: '#1C0F00', accent: '#D47C2F', background: '#FDF6EC' },
  },
  {
    label: 'Creator Portfolio',
    answers: ['Your Name', 'Creative, editorial, confident. The portfolio of someone who knows exactly what they do and does it exceptionally well.', 'Brands and businesses looking for creative partnership', 'This is my work.', 'skip', 'See My Work'],
    mood: 'dark', pageType: 'portfolio', designDirection: 'framer',
    colors: { primary: '#080808', accent: '#FF4D00', background: '#080808' },
  },
  {
    label: 'Event Page',
    answers: ['Your Event', 'High energy, exclusive, electric. The anticipation before the doors open. FOMO in the best way.', 'Event-goers and culture community 21-40', "You don't want to miss this.", 'skip', 'Get Your Tickets'],
    mood: 'dark', pageType: 'event', designDirection: 'spotify',
    colors: { primary: '#0A0008', accent: '#9B5DE5', background: '#0A0008' },
  },
]

const DESIGN_DIRECTIONS: Array<{ value: DesignDirectionOption; label: string; note: string }> = [
  { value: 'auto', label: 'AUTO', note: 'Let Irie Builder choose the strongest direction from the brief.' },
  { value: 'nike', label: 'NIKE', note: 'Image-led, bold type, kinetic, high-pressure street and sport energy.' },
  { value: 'apple', label: 'APPLE', note: 'Premium restraint, cinematic product focus, polished minimalism.' },
  { value: 'vercel', label: 'VERCEL', note: 'Sharp, technical, black-and-white precision with confidence.' },
  { value: 'stripe', label: 'STRIPE', note: 'Elegant product storytelling, premium SaaS flow, soft depth.' },
  { value: 'framer', label: 'FRAMER', note: 'Design-forward motion, bold landing-page rhythm, visual heat.' },
  { value: 'notion', label: 'NOTION', note: 'Warm clarity, reading-first structure, soft minimalism.' },
  { value: 'spotify', label: 'SPOTIFY', note: 'Dark, youth-forward, punchy, culture-driven immersion.' },
]

const REFERENCE_STYLE_LIBRARY: Array<{
  value: ReferenceStyleOption
  label: string
  note: string
}> = [
  { value: 'linear', label: 'Linear', note: 'Sleek product calm, editorial precision, dense confidence.' },
  { value: 'supabase', label: 'Supabase', note: 'Developer warmth, green accents, open-source clarity.' },
  { value: 'raycast', label: 'Raycast', note: 'Glossy dark polish, gradient-native utility confidence.' },
  { value: 'cursor', label: 'Cursor', note: 'AI-native dark tool feel, sharp developer edge.' },
  { value: 'claude', label: 'Claude', note: 'Warm editorial calm with human, thoughtful softness.' },
  { value: 'airbnb', label: 'Airbnb', note: 'Photography-first hospitality, warmth, and lifestyle trust.' },
  { value: 'figma', label: 'Figma', note: 'Playful creative energy with product-led structure.' },
  { value: 'runwayml', label: 'Runway', note: 'Cinematic, media-rich, art-tech tension.' },
  { value: 'spacex', label: 'SpaceX', note: 'Monumental black-and-white futurism and gravitas.' },
  { value: 'uber', label: 'Uber', note: 'Urban sharpness, compressed type, system confidence.' },
  { value: 'ferrari', label: 'Ferrari', note: 'Luxury heat, high drama, sparing red intensity.' },
  { value: 'lamborghini', label: 'Lamborghini', note: 'Aggressive luxury darkness with hard-edged energy.' },
  { value: 'pinterest', label: 'Pinterest', note: 'Image-first curation, visual discovery, playful flow.' },
  { value: 'webflow', label: 'Webflow', note: 'Design-system boldness, high-end web polish.' },
  { value: 'notion', label: 'Notion', note: 'Warm minimalism, reading-first calm, helpful structure.' },
  { value: 'vercel', label: 'Vercel', note: 'Technical precision, black-white confidence, product clarity.' },
  { value: 'stripe', label: 'Stripe', note: 'Elegant conversion systems and premium SaaS polish.' },
  { value: 'apple', label: 'Apple', note: 'Premium restraint, cinematic whitespace, polished calm.' },
  { value: 'nike', label: 'Nike', note: 'Image-led power, bold type, kinetic street-sport energy.' },
  { value: 'spotify', label: 'Spotify', note: 'Youthful dark immersion and culture-heavy rhythm.' },
]

const EMOTIONAL_SLIDERS: Array<{ key: keyof EmotionalControls; label: string; note: string }> = [
  { key: 'authority', label: 'Authority', note: 'How commanding and certain the page should feel.' },
  { key: 'desire', label: 'Desire', note: 'How magnetic and want-inducing the offer should feel.' },
  { key: 'warmth', label: 'Warmth', note: 'How human, inviting, and emotionally safe it should feel.' },
  { key: 'tension', label: 'Tension', note: 'How much page-turn energy and dramatic contrast it should carry.' },
  { key: 'spectacle', label: 'Spectacle', note: 'How cinematic, vivid, and unforgettable it should look.' },
]

const DIRECTING_FOCUS_OPTIONS = [
  { value: 'whole-page', label: 'Whole Page' },
  { value: 'hero', label: 'Hero' },
  { value: 'story', label: 'Story Arc' },
  { value: 'trust', label: 'Trust Layer' },
  { value: 'cta', label: 'CTA Close' },
  { value: 'motion', label: 'Motion System' },
  { value: 'conversion', label: 'Conversion Pressure' },
]

const CARRY_FORWARD_OPTIONS = [
  { value: 'hero', label: 'Hero' },
  { value: 'story-arc', label: 'Story Arc' },
  { value: 'trust-layer', label: 'Trust Layer' },
  { value: 'cta-close', label: 'CTA Close' },
  { value: 'motion-system', label: 'Motion System' },
  { value: 'design-system', label: 'Design System' },
]

/* ── LOADING MESSAGES (UPGRADE 4) ─────────────── */

const LOADING_MESSAGES = [
  'Reading your brief\u2026',
  'Deciding on your typography\u2026',
  'Building your color system\u2026',
  'Choosing your motion vocabulary\u2026',
  'Writing your headlines\u2026',
  'Designing your sections\u2026',
  'Adding atmosphere\u2026',
  'Placing the unexpected detail\u2026',
  'Bringing it alive\u2026',
  'Almost there\u2026',
]

const PLACEHOLDER_DECISIONS = [
  'Typography pairing',
  'Color system',
  'Motion personality',
  'Atmosphere layer',
  'Section architecture',
  'Section headings',
  'Unexpected detail',
  'Brand voice',
  'Hero treatment',
  'Overall direction',
]

/* ── PILL BUTTON ───────────────────────────────── */

function Pill<T extends string>({
  value, label, selected, onSelect,
}: { value: T; label: string; selected: T; onSelect: (v: T) => void }) {
  const active = value === selected
  return (
    <button type="button" onClick={() => onSelect(value)}
      className={`pill ${active ? 'pill--active' : ''}`}>
      {label}
    </button>
  )
}

/* ── CHAT MESSAGE TYPE ────────────────────────── */

interface ChatMessage {
  role: 'ai' | 'user'
  text: string
}

/* ── DASHBOARD PAGE ────────────────────────────── */

export default function DashboardPage() {
  /* Just Build It state */
  const [briefInput, setBriefInput] = useState('')
  const [chatExpanded, setChatExpanded] = useState(false)

  /* chat state */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chatPhase, setChatPhase] = useState<'conversation' | 'generating' | 'complete' | 'feedback'>('conversation')
  const [answers, setAnswers] = useState<string[]>([])

  /* form state — Your Vibe */
  const [vibeText, setVibeText] = useState('')
  const [mood, setMood] = useState<MoodOption>('dark')
  const [pageType, setPageType] = useState<PageOption>('landing')
  const [designDirection, setDesignDirection] = useState<DesignDirectionOption>('auto')
  const [styleBlend, setStyleBlend] = useState('')
  const [referenceStyles, setReferenceStyles] = useState<ReferenceStyleOption[]>(['nike', 'apple'])
  const [sectionFocus, setSectionFocus] = useState('whole-page')
  const [revisionDirective, setRevisionDirective] = useState('')
  const [carryForwardLocks, setCarryForwardLocks] = useState<string[]>([])
  const [emotionalControls, setEmotionalControls] = useState<EmotionalControls>({
    authority: 78,
    desire: 82,
    warmth: 54,
    tension: 74,
    spectacle: 80,
  })
  const [primary, setPrimary] = useState('#111111')
  const [accent, setAccent] = useState('#C9A84C')
  const [background, setBackground] = useState('#F5F0E8')

  /* generation state */
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [blueprint, setBlueprint] = useState<GenerationBlueprint | null>(null)
  const [critique, setCritique] = useState<GenerationCritique | null>(null)
  const [previousGeneration, setPreviousGeneration] = useState<GenerationSnapshot | null>(null)
  const [generationHistory, setGenerationHistory] = useState<Array<{ label: string; verdict: string }>>([])
  const [previewMode, setPreviewMode] = useState<'current' | 'before-after'>('current')
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [decisions, setDecisions] = useState<CreativeDecision[]>([])
  const [visibleDecisions, setVisibleDecisions] = useState(0)
  const [genCount, setGenCount] = useState(0)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [errorLog, setErrorLog] = useState<{ time: string; message: string }[]>([])

  /* agent status (streamed from /api/generate in real time) */
  const [agentStatus, setAgentStatus] = useState<AgentStatusMap>(emptyAgentStatus)

  /* mobile panel */
  const [mobilePanel, setMobilePanel] = useState<'form' | 'preview' | 'log'>('form')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const mobileIframeRef = useRef<HTMLIFrameElement>(null)
  const previousIframeRef = useRef<HTMLIFrameElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const briefInputRef = useRef<HTMLInputElement>(null)

  /* scroll chat to bottom on new messages */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* focus input after typing indicator clears */
  useEffect(() => {
    if (!isTyping && chatPhase === 'conversation' && chatExpanded) {
      inputRef.current?.focus()
    }
  }, [isTyping, chatPhase, chatExpanded])

  /* cycle loading messages — 2.5s each (UPGRADE 4) */
  useEffect(() => {
    if (!loading) return
    setLoadingMsgIdx(0)
    const iv = setInterval(() => {
      setLoadingMsgIdx(prev => {
        const next = prev + 1
        return next < LOADING_MESSAGES.length ? next : prev
      })
    }, 2500)
    return () => clearInterval(iv)
  }, [loading])

  /* Stagger visible decisions in sync with loading (UPGRADE 4) */
  useEffect(() => {
    if (!loading) return
    setVisibleDecisions(0)
    const iv = setInterval(() => {
      setVisibleDecisions(prev => {
        const next = prev + 1
        return next <= PLACEHOLDER_DECISIONS.length ? next : prev
      })
    }, 2500)
    return () => clearInterval(iv)
  }, [loading])

  /* Restore rail collapsed state from localStorage on mount */
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (window.localStorage.getItem('irie-builder-rail-collapsed') === 'true') {
        setRailCollapsed(true)
      }
    } catch {}
  }, [])

  const toggleRailCollapsed = useCallback(() => {
    setRailCollapsed(prev => {
      const next = !prev
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('irie-builder-rail-collapsed', String(next))
        }
      } catch {}
      return next
    })
  }, [])

  const writeIframeDocument = useCallback((iframe: HTMLIFrameElement | null, markup: string | null) => {
    if (!iframe || !markup) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(markup)
    doc.close()
  }, [])

  /* ── GENERATE ── */
  const generate = useCallback(async (
    collectedAnswers?: string[],
    feedback?: string,
    rawBrief?: string,
  ) => {
    const brandName = collectedAnswers?.[0] || ''
    const vibe = collectedAnswers?.[1] || ''
    const audience = collectedAnswers?.[2] || ''
    const headline = collectedAnswers?.[3] || ''
    const heroRaw = collectedAnswers?.[4] || ''
    const ctaText = collectedAnswers?.[5] || ''

    const isUrl = heroRaw.match(/^https?:\/\//i)
    const isSkip = heroRaw.toLowerCase() === 'skip' || heroRaw.trim() === ''

    const mergedVibe = vibeText.trim() ? `${vibe}. ${vibeText.trim()}` : vibe
    const finalVibe = feedback ? `${mergedVibe} — User feedback: ${feedback}` : mergedVibe

    // For rawBrief mode, we only need the brief
    if (!rawBrief && !brandName.trim() && !finalVibe.trim()) return

    const nextGenerationLabel = buildGenerationLabel({
      nextCount: genCount + 1,
      sectionFocus,
      revisionDirective,
    })

    setLoading(true)
    setError(null)
    if (html) {
      setPreviousGeneration({
        html,
        blueprint,
        critique,
        label: generationHistory[0]?.label || `Generation #${genCount || 1}`,
      })
    }
    setBlueprint(null)
    setCritique(null)
    setDecisions([])
    setVisibleDecisions(0)
    setAgentStatus(emptyAgentStatus())

    const requestId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const payload: GeneratePayload & { requestId: string } = {
      requestId,
      brandName: brandName.trim(),
      headline: headline.trim(),
      heroImageUrl: isUrl ? heroRaw.trim() : '',
      heroImageDescription: (!isUrl && !isSkip) ? heroRaw.trim() : '',
      ctaText: ctaText.trim(),
      vibe: finalVibe.trim(),
      audience: audience.trim(),
      colors: { primary, accent, background },
      mood,
      pageType,
      designDirection,
      emotionalControls,
      ...(sectionFocus !== 'whole-page' ? { sectionFocus } : {}),
      ...(revisionDirective.trim() ? { revisionDirective: revisionDirective.trim() } : {}),
      ...(carryForwardLocks.length ? { carryForwardLocks } : {}),
      ...(styleBlend.trim() ? { styleBlend: styleBlend.trim() } : {}),
      ...(referenceStyles.length ? { referenceStyles } : {}),
      ...(feedback ? { userFeedback: feedback } : {}),
      ...(rawBrief ? { rawBrief } : {}),
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok || !res.body) {
        const fallbackText = await res.text().catch(() => '')
        let msg = `Generation failed (HTTP ${res.status})`
        try {
          const j = JSON.parse(fallbackText)
          if (j && j.message) msg = j.message
        } catch {}
        throw new Error(msg)
      }

      let data: Record<string, unknown> | null = null
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(trimmed)
          } catch {
            continue
          }
          if (event.type === 'status' && typeof event.agent === 'string' && typeof event.state === 'string') {
            const agent = event.agent as AgentName
            const state = event.state as AgentState
            setAgentStatus(prev => ({ ...prev, [agent]: state }))
          } else if (event.type === 'complete' && event.payload) {
            data = event.payload as Record<string, unknown>
          } else if (event.type === 'error' && typeof event.message === 'string') {
            throw new Error(event.message as string)
          }
        }
      }

      if (buffer.trim()) {
        try {
          const tail = JSON.parse(buffer.trim())
          if (tail && tail.type === 'complete' && tail.payload) data = tail.payload
        } catch {}
      }

      if (!data) {
        throw new Error('Stream ended without a complete payload.')
      }

      setHtml(data.html as string)
      setMetadata(data.metadata as Metadata)
      setBlueprint((data.blueprint as GenerationBlueprint | undefined) || null)
      setCritique((data.critique as GenerationCritique | undefined) || null)
      setGenerationHistory(prev => [
        {
          label: nextGenerationLabel,
          verdict: ((data.critique as GenerationCritique | undefined)?.verdict) || 'New pass generated.',
        },
        ...prev,
      ].slice(0, 6))
      setGenCount(prev => prev + 1)
      setMobilePanel('preview')
      setPreviewMode(previousGeneration || html ? 'before-after' : 'current')

      // Parse creative decisions from response
      const apiDecisions = (data.decisions as CreativeDecision[] | undefined) || []
      if (apiDecisions.length > 0) {
        setDecisions(apiDecisions)
        setVisibleDecisions(apiDecisions.length)
      }

      writeIframeDocument(iframeRef.current, data.html as string)
      writeIframeDocument(mobileIframeRef.current, data.html as string)

      // UPGRADE 5 — 3-bubble completion
      setChatPhase('complete')
      setMessages(prev => [...prev, { role: 'ai', text: "There's no perfect website. Only one that feels right to you." }])

      // Second bubble — reference decisions
      const decisionSummary = apiDecisions.length > 0
        ? apiDecisions.slice(0, 3).map(d => `${d.label}: ${d.value}`).join('. ')
        : 'typography, color system, and motion'

      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: `I made ${apiDecisions.length || 'several'} creative decisions for you. Here's what I chose \u2014 ${decisionSummary}.`,
        }])
      }, 1500)

      // Third bubble
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: 'Does this feel right? Tell me anything you want to change.' }])
        setChatPhase('feedback')
      }, 3000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      setErrorLog(prev => [...prev, { time: new Date().toLocaleTimeString(), message: msg }])
      setMessages(prev => [...prev, { role: 'ai', text: `Something went wrong: ${msg}. Try again?` }])
      setChatPhase('feedback')
    } finally {
      setLoading(false)
    }
  }, [vibeText, primary, accent, background, mood, pageType, designDirection, styleBlend, referenceStyles, emotionalControls, html, blueprint, critique, genCount, previousGeneration, sectionFocus, revisionDirective, generationHistory, carryForwardLocks, writeIframeDocument])

  /* ── JUST BUILD IT (UPGRADE 1) ── */
  const handleJustBuildIt = useCallback(() => {
    const brief = briefInput.trim()
    if (!brief) return

    const score = analyzeIntent(brief)

    // Expand chat, show brief as user message, show "Got it"
    setChatExpanded(true)
    setMessages([
      { role: 'user', text: brief },
    ])
    setAnswers([])
    setCurrentStep(0)
    setError(null)

    if (score >= 3) {
      // High intent — skip questionnaire entirely
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
        setChatPhase('generating')
        generate(undefined, undefined, brief)
      }, 600)
    } else {
      // Low intent — start questionnaire
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, {
          role: 'ai',
          text: "I want to get this right. Let me ask you a few quick things.",
        }])
        setTimeout(() => {
          setIsTyping(true)
          setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[0].question }])
            setChatPhase('conversation')
          }, 400)
        }, 600)
      }, 600)
    }
  }, [briefInput, generate])

  /* ── SUBMIT ANSWER ── */
  const submitAnswer = useCallback((value?: string) => {
    const answer = (value ?? inputValue).trim()
    if (!answer && currentStep !== 4) return

    const displayAnswer = answer || 'skip'
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', text: displayAnswer }])

    const newAnswers = [...answers, displayAnswer]
    setAnswers(newAnswers)
    const nextStep = currentStep + 1

    if (nextStep < CHAT_QUESTIONS.length) {
      setIsTyping(true)
      setCurrentStep(nextStep)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[nextStep].question }])
      }, 600)
    } else {
      setCurrentStep(nextStep)
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
        setChatPhase('generating')
        generate(newAnswers)
      }, 600)
    }
  }, [inputValue, currentStep, answers, generate])

  /* ── SUBMIT FEEDBACK ── */
  const submitFeedback = useCallback(() => {
    const feedback = inputValue.trim()
    if (!feedback) return
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', text: feedback }])

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'ai', text: "Rebuilding around your feedback\u2026" }])
      setChatPhase('generating')
      setHtml(null)
      setMetadata(null)
      setBlueprint(null)
      setCritique(null)
      setDecisions([])
      generate(answers.length > 0 ? answers : undefined, feedback, briefInput.trim() || undefined)
    }, 600)
  }, [inputValue, answers, generate, briefInput])

  /* ── HANDLE SEND ── */
  const handleSend = useCallback(() => {
    if (chatPhase === 'feedback') {
      submitFeedback()
    } else if (chatPhase === 'conversation') {
      submitAnswer()
    }
  }, [chatPhase, submitAnswer, submitFeedback])

  /* ── PRESET SPEED-RUN ── */
  const applyPreset = useCallback((p: Preset) => {
    setMood(p.mood)
    setPageType(p.pageType)
    setDesignDirection(p.designDirection)
    setReferenceStyles(isReferenceStyleOption(p.designDirection) ? [p.designDirection] : [])
    setPrimary(p.colors.primary)
    setAccent(p.colors.accent)
    setBackground(p.colors.background)
    setChatExpanded(true)

    setMessages([])
    setAnswers([])
    setCurrentStep(0)
    setError(null)
    setChatPhase('conversation')

    let delay = 0
    for (let i = 0; i < CHAT_QUESTIONS.length; i++) {
      const qDelay = delay
      const aDelay = delay + 150
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[i].question }])
      }, qDelay)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'user', text: p.answers[i] }])
      }, aDelay)
      delay += 300
    }

    setTimeout(() => {
      setAnswers(p.answers)
      setCurrentStep(CHAT_QUESTIONS.length)
      setIsTyping(true)
    }, delay)

    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
      setChatPhase('generating')
      generate(p.answers)
    }, delay + 600)
  }, [generate])

  /* ── START OVER ── */
  const startOver = useCallback(() => {
    setMessages([])
    setAnswers([])
    setCurrentStep(0)
    setInputValue('')
    setBriefInput('')
    setIsTyping(false)
    setError(null)
    setChatPhase('conversation')
    setChatExpanded(false)
    setBlueprint(null)
    setCritique(null)
    setPreviousGeneration(null)
    setGenerationHistory([])
    setPreviewMode('current')
    setViewportMode('desktop')
    setDecisions([])
    setVisibleDecisions(0)
  }, [])

  const toggleReferenceStyle = useCallback((style: ReferenceStyleOption) => {
    setReferenceStyles(prev =>
      prev.includes(style)
        ? prev.filter(item => item !== style)
        : [...prev, style]
    )
  }, [])

  const toggleCarryForwardLock = useCallback((value: string) => {
    setCarryForwardLocks(prev =>
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    )
  }, [])

  /* helpers */
  const openFullScreen = () => {
    if (!html) return
    const w = window.open('', '_blank')
    if (w) { w.document.open(); w.document.write(html); w.document.close() }
  }
  const downloadHtml = () => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${(answers[0] || briefInput || 'site').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.html`
    a.click(); URL.revokeObjectURL(url)
  }
  const onIframeLoad = useCallback(() => {
    writeIframeDocument(iframeRef.current, html)
  }, [html, writeIframeDocument])
  const onMobileIframeLoad = useCallback(() => {
    writeIframeDocument(mobileIframeRef.current, html)
  }, [html, writeIframeDocument])
  const onPreviousIframeLoad = useCallback(() => {
    writeIframeDocument(previousIframeRef.current, previousGeneration?.html || null)
  }, [previousGeneration, writeIframeDocument])
  const changeSummary = summarizeChange(previousGeneration, blueprint, critique)
  const mobileImpactScore = critique?.scores.find(score => score.label === 'Mobile Impact')?.score

  const showInput = chatPhase === 'conversation' || chatPhase === 'feedback'

  return (
    <>
      <style>{dashboardCSS}</style>

      <div className={`db ${railCollapsed ? 'db--rail-collapsed' : ''}`}>
        {/* ── MOBILE NAV ── */}
        <nav className="db-mobile-nav">
          <button className={mobilePanel === 'form' ? 'active' : ''} onClick={() => setMobilePanel('form')}>Edit</button>
          <button className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Preview</button>
          <button className={mobilePanel === 'log' ? 'active' : ''} onClick={() => setMobilePanel('log')}>Decisions</button>
        </nav>

        {/* ══════════════ LEFT PANEL ══════════════ */}
        <aside className={`db-panel db-form ${mobilePanel === 'form' ? 'db-panel--active' : ''}`}>
          <div className="db-form-inner">
            <h1 className="db-logo">Irie<span>Builder</span></h1>
            <p className="db-sub">Your vision. AI brings it alive.</p>
            <div className="db-form-hero">
              <p className="db-form-kicker">Creative Direction Engine</p>
              <h2 className="db-form-title">The blaze before the volcano.</h2>
              <p className="db-form-copy">
                This is where psychology, taste, and direction come together so the output feels inevitable before it ever goes live.
              </p>
              <div className="db-form-badges">
                <span>Design Direction</span>
                <span>Psychology</span>
                <span>Mobile Impact</span>
              </div>
            </div>

            {/* ── PRESETS ── */}
            <div className="db-presets">
              <p className="db-presets-label">{'\u2728'} Try a preset:</p>
              <div className="db-presets-row">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" className="db-preset-pill"
                    onClick={() => applyPreset(p)}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* ── JUST BUILD IT (UPGRADE 1) ── */}
            <div className="jbi">
              <input
                ref={briefInputRef}
                type="text"
                className="jbi-input"
                value={briefInput}
                onChange={e => setBriefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleJustBuildIt() }}
                placeholder="Describe your vision. One sentence is enough."
              />
              <button
                type="button"
                className="jbi-btn"
                onClick={handleJustBuildIt}
                disabled={!briefInput.trim() || loading}
              >
                Build It {'\u2192'}
              </button>
            </div>

            {/* ── Conversation toggle ── */}
            <button
              type="button"
              className="chat-toggle"
              onClick={() => {
                setChatExpanded(!chatExpanded)
                if (!chatExpanded && messages.length === 0) {
                  setTimeout(() => {
                    setMessages([{ role: 'ai', text: CHAT_QUESTIONS[0].question }])
                  }, 300)
                }
              }}
            >
              <span className="chat-toggle-line" />
              <span className="chat-toggle-text">
                {chatExpanded ? 'collapse conversation' : 'or have a conversation \u2192'}
              </span>
              <span className="chat-toggle-line" />
            </button>

            {/* ── AI CHAT INTERFACE ── */}
            {chatExpanded && (
              <div className="chat">
                {/* Progress dots */}
                <div className="chat-progress">
                  {CHAT_QUESTIONS.map((_, i) => (
                    <div key={i} className={`chat-dot ${i < answers.length ? 'chat-dot--filled' : ''}`} />
                  ))}
                  {(currentStep > 0 || messages.length > 0) && (
                    <button type="button" className="chat-restart" onClick={startOver}>
                      Start over
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="chat-messages">
                  {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble chat-bubble--${msg.role}`}>
                      {msg.text}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="chat-typing">
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input row */}
                {showInput && !isTyping && (
                  <div className="chat-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      className="chat-input"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                      placeholder={
                        chatPhase === 'feedback'
                          ? 'Tell me what to change\u2026'
                          : currentStep < CHAT_QUESTIONS.length
                            ? CHAT_QUESTIONS[currentStep].placeholder || 'Type your answer\u2026'
                            : ''
                      }
                    />
                    <button type="button" className="chat-send" onClick={handleSend} aria-label="Send">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── DIVIDER ── */}
            <div className="db-divider" />

            {/* ── YOUR VIBE ── */}
            <p className="db-group-header">Your Vibe</p>

            <label className="db-label" htmlFor="vibe">Vibe (optional extra detail)</label>
            <textarea id="vibe" className="db-textarea db-textarea-sm" rows={2}
              placeholder="Add more vibe detail here \u2014 merges with what you told the AI above"
              value={vibeText} onChange={e => setVibeText(e.target.value)} />

            <fieldset className="db-fieldset">
              <legend className="db-label">Mood</legend>
              <div className="db-pills" role="radiogroup" aria-label="Mood selection">
                {(['light', 'dark', 'warm'] as MoodOption[]).map(m => (
                  <Pill key={m} value={m} label={m.toUpperCase()} selected={mood} onSelect={setMood} />
                ))}
              </div>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Page Type</legend>
              <div className="db-pills" role="radiogroup" aria-label="Page type selection">
                {(['landing', 'store', 'portfolio', 'event'] as PageOption[]).map(p => (
                  <Pill key={p} value={p} label={p.toUpperCase()} selected={pageType} onSelect={setPageType} />
                ))}
              </div>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Design Toolkit</legend>
              <div className="db-pills" role="radiogroup" aria-label="Design direction selection">
                {DESIGN_DIRECTIONS.map(direction => (
                  <Pill
                    key={direction.value}
                    value={direction.value}
                    label={direction.label}
                    selected={designDirection}
                    onSelect={setDesignDirection}
                  />
                ))}
              </div>
              <p className="db-helper">
                {DESIGN_DIRECTIONS.find(direction => direction.value === designDirection)?.note}
              </p>
            </fieldset>

            <label className="db-label" htmlFor="styleBlend">Style Blend (optional)</label>
            <textarea
              id="styleBlend"
              className="db-textarea db-textarea-sm"
              rows={2}
              placeholder="e.g. Nike energy with Apple restraint. Vercel precision but warmer. Framer motion with streetwear edge."
              value={styleBlend}
              onChange={e => setStyleBlend(e.target.value)}
            />

            <fieldset className="db-fieldset">
              <legend className="db-label">Reference Style Library</legend>
              <div className="db-reference-grid" role="group" aria-label="Reference style library">
                {REFERENCE_STYLE_LIBRARY.map(style => {
                  const active = referenceStyles.includes(style.value)
                  return (
                    <button
                      key={style.value}
                      type="button"
                      className={`db-reference-card ${active ? 'db-reference-card--active' : ''}`}
                      onClick={() => toggleReferenceStyle(style.value)}
                    >
                      <span className="db-reference-name">{style.label}</span>
                      <span className="db-reference-note">{style.note}</span>
                    </button>
                  )
                })}
              </div>
              <p className="db-helper">
                These references act like a creative moodboard for the generator. Mix them, or let Auto decide the lead.
              </p>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Emotional Controls</legend>
              <div className="db-sliders">
                {EMOTIONAL_SLIDERS.map(slider => (
                  <label key={slider.key} className="db-slider">
                    <div className="db-slider-head">
                      <span className="db-slider-label">{slider.label}</span>
                      <span className="db-slider-value">{emotionalControls[slider.key]}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={emotionalControls[slider.key]}
                      onChange={e => setEmotionalControls(prev => ({ ...prev, [slider.key]: Number(e.target.value) }))}
                    />
                    <span className="db-slider-note">{slider.note}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Directing Pass</legend>
              <div className="db-pills" role="radiogroup" aria-label="Section focus selection">
                {DIRECTING_FOCUS_OPTIONS.map(option => (
                  <Pill
                    key={option.value}
                    value={option.value}
                    label={option.label.toUpperCase()}
                    selected={sectionFocus}
                    onSelect={setSectionFocus}
                  />
                ))}
              </div>
              <label className="db-label" htmlFor="revisionDirective">Creative Note</label>
              <textarea
                id="revisionDirective"
                className="db-textarea db-textarea-sm"
                rows={2}
                placeholder="e.g. Make the hero feel more dangerous. Hold the CTA longer. Push trust earlier. Add more cinematic reveals."
                value={revisionDirective}
                onChange={e => setRevisionDirective(e.target.value)}
              />
              <p className="db-helper">
                This lets you direct the next pass like a creative review instead of starting over blind.
              </p>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Carry Forward</legend>
              <div className="db-lock-grid" role="group" aria-label="Carry forward locks">
                {CARRY_FORWARD_OPTIONS.map(option => {
                  const active = carryForwardLocks.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`db-lock-chip ${active ? 'db-lock-chip--active' : ''}`}
                      onClick={() => toggleCarryForwardLock(option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <p className="db-helper">
                Lock the parts that are already right so the next pass evolves around them instead of replacing them.
              </p>
            </fieldset>

            <label className="db-label">Colors</label>
            <div className="db-colors">
              <div className="db-color-item">
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} aria-label="Primary color" />
                <span>Primary<br /><code>{primary}</code></span>
              </div>
              <div className="db-color-item">
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} aria-label="Accent color" />
                <span>Accent<br /><code>{accent}</code></span>
              </div>
              <div className="db-color-item">
                <input type="color" value={background} onChange={e => setBackground(e.target.value)} aria-label="Background color" />
                <span>Background<br /><code>{background}</code></span>
              </div>
            </div>

            {genCount > 0 && <p className="db-gen-count">Generation #{genCount}</p>}
            {error && <p className="db-error">{error}</p>}
          </div>
        </aside>

        {/* ══════════════ CENTER PANEL ══════════════ */}
        <main className={`db-panel db-preview ${mobilePanel === 'preview' ? 'db-panel--active' : ''}`}>
          {!html && !loading && (
            <div className="db-placeholder">
              <p className="db-placeholder-title">Describe your brand.</p>
              <p className="db-placeholder-title">Watch it come alive.</p>
              <p className="db-placeholder-sub">Every scroll, every motion, every detail \u2014 built around your vibe.</p>
            </div>
          )}

          {loading && (
            <div className="db-loading">
              <div className="db-agent-panel" role="status" aria-live="polite">
                <p className="db-agent-panel-kicker">Creative team at work</p>
                <p className="db-agent-panel-title">{LOADING_MESSAGES[loadingMsgIdx]}</p>
                <ul className="db-agent-list">
                  {AGENT_ROSTER.map(agent => {
                    const state = agentStatus[agent.name] || 'waiting'
                    return (
                      <li key={agent.name} className={`db-agent-row db-agent-row--${state}`}>
                        <span className={`db-agent-dot db-agent-dot--${state}`} aria-hidden="true">
                          {state === 'done' ? '\u2713' : state === 'failed' ? '\u2715' : ''}
                        </span>
                        <span className="db-agent-label">{agent.label}</span>
                        <span className="db-agent-desc">{agent.description}</span>
                        <span className={`db-agent-state db-agent-state--${state}`}>{stateLabel(state)}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          {html && !loading && (
            <>
              <div className="db-stage-top">
                <div className="db-stage-copy">
                  <p className="db-stage-kicker">Live Direction Stage</p>
                  <h2 className="db-stage-title">{blueprint?.brandCore.brandName || answers[0] || 'Creative Output'}</h2>
                  <p className="db-stage-sub">
                    {critique?.summary || 'Shape the page, push the emotion, and judge the result like a real creative director.'}
                  </p>
                </div>
                <div className="db-stage-stats">
                  <div className="db-stage-stat">
                    <span className="db-stage-stat-label">Direction</span>
                    <span className="db-stage-stat-value">{blueprint?.designSystem.primaryDirection || designDirection}</span>
                  </div>
                  <div className="db-stage-stat">
                    <span className="db-stage-stat-label">Motion</span>
                    <span className="db-stage-stat-value">{blueprint?.motionSystem.intensity || 'editorial'}</span>
                  </div>
                  <div className="db-stage-stat">
                    <span className="db-stage-stat-label">Mobile</span>
                    <span className="db-stage-stat-value">{mobileImpactScore ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div className="db-preview-actions">
                <button onClick={openFullScreen} className="db-action-btn">View Full Screen</button>
                <button onClick={downloadHtml} className="db-action-btn">Download HTML</button>
                <div className="db-viewport-toggle" role="group" aria-label="Preview viewport">
                  <button
                    type="button"
                    onClick={() => setViewportMode('mobile')}
                    className={`pill ${viewportMode === 'mobile' ? 'pill--active' : ''}`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('tablet')}
                    className={`pill ${viewportMode === 'tablet' ? 'pill--active' : ''}`}
                  >
                    Tablet
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('desktop')}
                    className={`pill ${viewportMode === 'desktop' ? 'pill--active' : ''}`}
                  >
                    Desktop
                  </button>
                </div>
                {previousGeneration && (
                  <button
                    onClick={() => setPreviewMode(prev => prev === 'current' ? 'before-after' : 'current')}
                    className="db-action-btn"
                  >
                    {previewMode === 'before-after' ? 'Current Only' : 'Before / After'}
                  </button>
                )}
                <button onClick={() => { setHtml(null); setMetadata(null); setBlueprint(null); setCritique(null); setPreviewMode('current'); setDecisions([]); setMobilePanel('form') }} className="db-action-btn">Regenerate</button>
                <button onClick={() => setMobilePanel('form')} className="db-action-btn db-back-btn">Back to Edit</button>
              </div>
              {previewMode === 'before-after' && previousGeneration ? (
                <div className="db-compare">
                  <div className={`db-compare-panel db-compare-panel--${viewportMode}`}>
                    <div className="db-compare-label">Before</div>
                    <iframe
                      ref={previousIframeRef}
                      title="Previous generated site preview"
                      className="db-iframe"
                      sandbox="allow-scripts allow-same-origin"
                      onLoad={onPreviousIframeLoad}
                    />
                  </div>
                  <div className={`db-compare-panel db-compare-panel--${viewportMode}`}>
                    <div className="db-compare-label">After</div>
                    <iframe
                      ref={iframeRef}
                      title="Generated site preview"
                      className="db-iframe"
                      sandbox="allow-scripts allow-same-origin"
                      onLoad={onIframeLoad}
                    />
                  </div>
                </div>
              ) : (
                <div className={`db-single-preview db-single-preview--${viewportMode}`}>
                  {viewportMode === 'desktop' ? (
                    <div className="db-stage-layout">
                      <div className="db-desktop-stage">
                        <iframe ref={iframeRef} title="Generated site preview"
                          className="db-iframe" sandbox="allow-scripts allow-same-origin"
                          onLoad={onIframeLoad} />
                      </div>
                      <aside className="db-device-rail">
                        <div className="db-device-card">
                          <div className="db-device-card-head">
                            <div>
                              <span className="db-device-label">Phone Preview</span>
                              <p className="db-device-copy">See the emotional hit where it matters most.</p>
                            </div>
                            <button
                              type="button"
                              className="db-device-switch"
                              onClick={() => setViewportMode('mobile')}
                            >
                              Focus Mobile
                            </button>
                          </div>
                          <div className="db-phone-shell">
                            <iframe
                              ref={mobileIframeRef}
                              title="Generated mobile site preview"
                              className="db-phone-iframe"
                              sandbox="allow-scripts allow-same-origin"
                              onLoad={onMobileIframeLoad}
                            />
                          </div>
                        </div>
                        <div className="db-device-note">
                          <span className="db-device-label">Creative Pressure</span>
                          <strong>{critique?.verdict || 'Output ready for direction.'}</strong>
                          <p>{changeSummary?.headline || 'Compare passes, keep what works, and push what still feels safe.'}</p>
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <iframe ref={iframeRef} title="Generated site preview"
                      className="db-iframe" sandbox="allow-scripts allow-same-origin"
                      onLoad={onIframeLoad} />
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating expand tab — visible only when rail is collapsed */}
        {railCollapsed && (
          <button
            type="button"
            className="db-rail-expand"
            onClick={toggleRailCollapsed}
            aria-label="Expand Creative Decisions rail"
            title="Expand Creative Decisions"
          >
            {'\u2039'}
          </button>
        )}

        {/* ══════════════ RIGHT PANEL — CREATIVE DECISIONS ══════════════ */}
        <aside className={`db-panel db-log ${mobilePanel === 'log' ? 'db-panel--active' : ''}`}>
          <div className="db-rail-head">
            <h2 className="db-log-title">Creative Decisions</h2>
            <button
              type="button"
              className="db-rail-toggle"
              onClick={toggleRailCollapsed}
              aria-label="Collapse Creative Decisions rail"
              title="Collapse"
            >
              {'\u2039'}
            </button>
          </div>
          <p className="db-log-sub">Blueprint, critique, compare, and carry-forward all live here.</p>

          {blueprint && (
            <div className="db-blueprint">
              <div className="db-blueprint-block">
                <span className="db-log-label">Brand Core</span>
                <span className="db-log-value">{blueprint.brandCore.brandName}</span>
                <span className="db-log-reason">{blueprint.brandCore.emotionalPromise}</span>
                <span className="db-log-reason">Voice: {blueprint.brandCore.brandVoice}</span>
                <span className="db-log-reason">Audience: {blueprint.brandCore.audienceLens}</span>
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Story Arc</span>
                {blueprint.storyArc.map(step => (
                  <div key={step.stage} className="db-blueprint-step">
                    <span className="db-blueprint-step-title">{step.stage}</span>
                    <span className="db-log-value">{step.objective}</span>
                    <span className="db-log-reason">{step.execution}</span>
                  </div>
                ))}
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Design System</span>
                <span className="db-log-value">{blueprint.designSystem.primaryDirection}</span>
                <span className="db-log-reason">Supporting: {blueprint.designSystem.supportingDirections.join(', ') || 'None'}</span>
                <span className="db-log-reason">{blueprint.designSystem.typographyStrategy}</span>
                <span className="db-log-reason">{blueprint.designSystem.paletteStrategy}</span>
                <span className="db-log-reason">{blueprint.designSystem.layoutRhythm}</span>
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Motion System</span>
                <span className="db-log-value">{blueprint.motionSystem.intensity}</span>
                <span className="db-log-reason">{blueprint.motionSystem.style}</span>
                <span className="db-log-reason">{blueprint.motionSystem.revealBehavior}</span>
                <span className="db-log-reason">{blueprint.motionSystem.atmosphere}</span>
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Persuasion System</span>
                <span className="db-log-reason">{blueprint.persuasionSystem.trustStrategy}</span>
                <span className="db-log-reason">Proof: {blueprint.persuasionSystem.proofPlacement}</span>
                <span className="db-log-reason">CTA: {blueprint.persuasionSystem.ctaStrategy}</span>
                <span className="db-log-reason">{blueprint.persuasionSystem.specificityNotes}</span>
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Section Plan</span>
                {blueprint.sections.map(section => (
                  <div key={section.id} className="db-blueprint-step">
                    <span className="db-blueprint-step-title">{section.heading}</span>
                    <span className="db-log-value">{section.role}</span>
                    <span className="db-log-reason">{section.purpose}</span>
                    <span className="db-log-reason">{section.contentDirection}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {critique && (
            <div className="db-blueprint">
              <div className="db-blueprint-block">
                <span className="db-log-label">Self-Critique</span>
                <span className="db-log-value">{critique.verdict}</span>
                <span className="db-log-reason">{critique.summary}</span>
              </div>

              <div className="db-blueprint-block">
                <span className="db-log-label">Scores</span>
                {critique.scores.map(score => (
                  <div key={score.label} className="db-score-row">
                    <span className="db-score-label">{score.label}</span>
                    <span className="db-score-value">{score.score}</span>
                  </div>
                ))}
              </div>

              {critique.recommendations.length > 0 && (
                <div className="db-blueprint-block">
                  <span className="db-log-label">Recommendations</span>
                  {critique.recommendations.map(rec => (
                    <span key={rec} className="db-log-reason">{rec}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {previousGeneration && (
            <div className="db-blueprint">
              <div className="db-blueprint-block">
                <span className="db-log-label">Before / After</span>
                <span className="db-log-value">{previousGeneration.label} → Generation #{genCount}</span>
                <span className="db-log-reason">
                  {previousGeneration.critique?.verdict || 'Previous pass saved for comparison.'}
                </span>
                <span className="db-log-reason">
                  {critique?.verdict || 'Current pass ready for comparison.'}
                </span>
              </div>
            </div>
          )}

          {changeSummary && (
            <div className="db-blueprint">
              <div className="db-blueprint-block">
                <span className="db-log-label">What Changed</span>
                <span className="db-log-value">{changeSummary.headline}</span>
                {changeSummary.improvements.map(item => (
                  <span key={item} className="db-log-reason">{item}</span>
                ))}
                {changeSummary.shifts.map(item => (
                  <span key={item} className="db-log-reason">{item}</span>
                ))}
              </div>
            </div>
          )}

          {generationHistory.length > 0 && (
            <div className="db-blueprint">
              <div className="db-blueprint-block">
                <span className="db-log-label">Pass History</span>
                {generationHistory.map(item => (
                  <div key={item.label} className="db-blueprint-step">
                    <span className="db-blueprint-step-title">{item.label}</span>
                    <span className="db-log-reason">{item.verdict}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorLog.length > 0 && (
            <div className="db-log-errors">
              {errorLog.map((e, i) => (
                <div key={i} className="db-log-error">
                  <span className="db-log-error-time">{e.time}</span>
                  <span className="db-log-error-msg">{e.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Real decisions from API */}
          {decisions.length > 0 && decisions.map((d, i) => (
            <div key={i} className={`db-log-item db-log-item--stagger ${i < visibleDecisions ? 'db-log-item--visible' : ''}`}
              style={{ transitionDelay: `${i * 400}ms` }}>
              <span className="db-log-icon">{'\u2726'}</span>
              <div className="db-log-body">
                <span className="db-log-label">{d.label}</span>
                <span className="db-log-value">{d.value}</span>
                {d.agent && (
                  <span className="db-log-agent">{'\u21b3 '}{d.agent}</span>
                )}
                {d.reason && <span className="db-log-reason">{d.reason}</span>}
              </div>
            </div>
          ))}

          {/* Placeholder decisions during loading / idle */}
          {decisions.length === 0 && (
            <div className="db-log-placeholders">
              {PLACEHOLDER_DECISIONS.map((text, i) => (
                <div key={i} className={`db-log-ph ${loading && i < visibleDecisions ? 'db-log-ph--lit' : ''}`}>
                  <span className="db-log-ph-icon">{'\u2726'}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */

const dashboardCSS = `
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{
    --black:#080808;--surface:#0f0f0f;--border:rgba(201,168,76,0.18);
    --gold:#C9A84C;--gold-dim:rgba(201,168,76,0.12);
    --text:#F2EDE4;--muted:rgba(242,237,228,0.45);--radius:6px;
    --chat-bg:#0D0D0D;--chat-user-bg:#1A1A1A;
  }
  body{font-family:'Syne',system-ui,sans-serif;background:var(--black);color:var(--text);overflow:hidden;height:100dvh}

  /* ── LAYOUT ── */
  .db{display:grid;grid-template-columns:400px 1fr 220px;height:100dvh;position:relative;transition:grid-template-columns 200ms ease}
  .db--rail-collapsed{grid-template-columns:400px 1fr 0}
  .db-panel{overflow-y:auto;height:100%}

  /* ── MOBILE NAV ── */
  .db-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:50;background:var(--surface);border-top:1px solid var(--border)}
  .db-mobile-nav button{flex:1;padding:14px 0;background:none;border:none;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;min-height:48px}
  .db-mobile-nav button.active{color:var(--gold);border-top:2px solid var(--gold)}

  /* ── LEFT PANEL ── */
  .db-form{background:var(--surface);border-right:1px solid var(--border);padding:24px 24px 32px}
  .db-form-inner{display:flex;flex-direction:column}

  .db-logo{font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;letter-spacing:0.01em;margin-bottom:2px}
  .db-logo span{font-style:italic;font-weight:400;color:var(--gold)}
  .db-sub{font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5}
  .db-form-hero{padding:18px;border:1px solid var(--border);border-radius:16px;background:
    radial-gradient(circle at top right, rgba(201,168,76,0.16), transparent 42%),
    linear-gradient(180deg, rgba(201,168,76,0.06), rgba(255,255,255,0.01));
    margin-bottom:18px;box-shadow:0 22px 50px rgba(0,0,0,0.28)}
  .db-form-kicker{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
  .db-form-title{font-family:'Playfair Display',Georgia,serif;font-size:28px;line-height:1.02;color:var(--text);margin-bottom:10px}
  .db-form-copy{font-size:13px;line-height:1.7;color:rgba(242,237,228,0.72);margin-bottom:14px}
  .db-form-badges{display:flex;flex-wrap:wrap;gap:8px}
  .db-form-badges span{padding:7px 10px;border:1px solid rgba(201,168,76,0.24);border-radius:999px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);background:rgba(0,0,0,0.18)}

  /* presets */
  .db-presets{margin-bottom:16px}
  .db-presets-label{font-size:12px;color:var(--gold);margin-bottom:8px;letter-spacing:0.02em}
  .db-presets-row{display:flex;gap:6px;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .db-preset-pill{padding:7px 14px;border:1px solid var(--gold);border-radius:100px;background:transparent;color:var(--gold);font-family:'Syne',system-ui,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.03em;cursor:pointer;transition:all 0.2s;white-space:nowrap;min-height:44px;display:flex;align-items:center}
  .db-preset-pill:hover{background:var(--gold-dim);color:var(--text)}

  /* ── JUST BUILD IT (UPGRADE 1) ── */
  .jbi{display:flex;flex-direction:column;gap:8px;margin-bottom:4px}
  .jbi-input{width:100%;height:56px;background:#0D0D0D;border:1px solid rgba(201,168,76,0.3);border-radius:var(--radius);padding:0 16px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;transition:border-color 0.3s,box-shadow 0.3s}
  .jbi-input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 12px rgba(201,168,76,0.15)}
  .jbi-input::placeholder{color:var(--gold);opacity:0.5;transition:opacity 0.3s}
  .jbi-input:focus::placeholder{opacity:0}
  .jbi-btn{width:100%;height:52px;background:var(--gold);color:#0A0A0A;border:none;border-radius:var(--radius);font-family:'Syne',system-ui,sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:filter 0.2s,transform 0.2s;min-height:44px}
  .jbi-btn:hover:not(:disabled){filter:brightness(1.1);transform:scale(1.01)}
  .jbi-btn:disabled{opacity:0.5;cursor:not-allowed}

  /* ── Chat toggle ── */
  .chat-toggle{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;cursor:pointer;padding:12px 0 8px;margin-bottom:4px}
  .chat-toggle-line{flex:1;height:1px;background:var(--border)}
  .chat-toggle-text{font-family:'Syne',system-ui,sans-serif;font-size:11px;color:var(--muted);letter-spacing:0.03em;white-space:nowrap;transition:color 0.2s;min-height:44px;display:flex;align-items:center}
  .chat-toggle:hover .chat-toggle-text{color:var(--gold)}

  /* ── CHAT INTERFACE ── */
  .chat{background:var(--chat-bg);border-radius:12px;display:flex;flex-direction:column;max-height:380px;position:relative;overflow-x:hidden;width:100%;animation:chatFadeIn 0.3s ease-out}

  .chat-progress{display:flex;align-items:center;gap:6px;padding:12px 16px 0;flex-shrink:0}
  .chat-dot{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--gold);opacity:0.35;transition:all 0.3s}
  .chat-dot--filled{background:var(--gold);opacity:1;border-color:var(--gold)}
  .chat-restart{margin-left:auto;background:none;border:none;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:11px;cursor:pointer;letter-spacing:0.02em;transition:color 0.2s;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center}
  .chat-restart:hover{color:var(--gold)}

  .chat-messages{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:120px}
  .chat-messages::-webkit-scrollbar{width:3px}
  .chat-messages::-webkit-scrollbar-track{background:transparent}
  .chat-messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

  .chat-bubble{max-width:88%;line-height:1.5;animation:chatFadeIn 0.3s ease-out;word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap;box-sizing:border-box}
  .chat-bubble--ai{align-self:flex-start;color:var(--gold);font-family:'Syne',system-ui,sans-serif;font-size:14px;padding:0}
  .chat-bubble--user{align-self:flex-end;background:var(--chat-user-bg);color:var(--text);font-size:13px;padding:8px 14px;border-radius:12px 12px 4px 12px}
  @keyframes chatFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

  .chat-typing{display:flex;gap:4px;padding:4px 0;align-self:flex-start}
  .chat-typing-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);opacity:0.4;animation:typingBounce 1.2s ease-in-out infinite}
  .chat-typing-dot:nth-child(2){animation-delay:0.15s}
  .chat-typing-dot:nth-child(3){animation-delay:0.3s}
  @keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-4px);opacity:1}}

  .chat-input-row{display:flex;gap:8px;padding:8px 12px 12px;border-top:1px solid rgba(201,168,76,0.1);flex-shrink:0}
  .chat-input{flex:1;background:var(--chat-user-bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;line-height:1.4;transition:border-color 0.2s;min-width:0;box-sizing:border-box;word-break:break-word;overflow-wrap:break-word}
  .chat-input:focus{outline:none;border-color:var(--gold)}
  .chat-input::placeholder{color:var(--muted);font-size:12px}
  .chat-send{width:44px;height:44px;border-radius:8px;background:var(--gold);border:none;color:var(--black);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:box-shadow 0.2s}
  .chat-send:hover{box-shadow:0 0 16px rgba(201,168,76,0.3)}

  /* group headers */
  .db-group-header{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-top:4px;margin-bottom:12px}
  .db-divider{height:1px;background:var(--border);margin:16px 0 12px}

  /* labels & inputs */
  .db-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-top:12px;margin-bottom:5px}
  .db-input,.db-textarea{width:100%;background:var(--black);border:1px solid var(--border);border-radius:var(--radius);padding:11px 13px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;line-height:1.5;transition:border-color 0.2s}
  .db-input:focus,.db-textarea:focus{outline:none;border-color:var(--gold)}
  .db-textarea{resize:vertical;min-height:72px}
  .db-textarea-sm{min-height:56px}

  .db-fieldset{border:none;padding:0;margin:0}

  .db-pills{display:flex;gap:6px;flex-wrap:wrap}
  .pill{padding:8px 16px;border:1px solid var(--border);border-radius:100px;background:transparent;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;cursor:pointer;transition:all 0.2s;min-height:44px;display:flex;align-items:center}
  .pill:hover{border-color:var(--gold);color:var(--text)}
  .pill--active{background:var(--gold-dim);border-color:var(--gold);color:var(--gold)}

  .db-colors{display:flex;gap:12px}
  .db-helper{font-size:11px;color:var(--muted);line-height:1.6;margin-top:8px}
  .db-reference-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .db-reference-card{padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:#0d0d0d;color:var(--muted);text-align:left;cursor:pointer;transition:border-color .2s,transform .2s,color .2s,background .2s;min-height:88px}
  .db-reference-card:hover{border-color:var(--gold);transform:translateY(-1px);color:var(--text)}
  .db-reference-card--active{border-color:var(--gold);background:var(--gold-dim);color:var(--text)}
  .db-reference-name{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;color:inherit}
  .db-reference-note{display:block;font-size:11px;line-height:1.45;color:inherit}
  .db-sliders{display:flex;flex-direction:column;gap:10px}
  .db-slider{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);background:#0d0d0d}
  .db-slider-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .db-slider-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text)}
  .db-slider-value{font-size:11px;color:var(--gold);font-variant-numeric:tabular-nums}
  .db-slider input[type="range"]{width:100%;accent-color:var(--gold)}
  .db-slider-note{font-size:11px;line-height:1.45;color:var(--muted)}
  .db-lock-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .db-lock-chip{padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);background:#0d0d0d;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:border-color .2s,color .2s,background .2s;min-height:44px}
  .db-lock-chip:hover{border-color:var(--gold);color:var(--text)}
  .db-lock-chip--active{border-color:var(--gold);background:var(--gold-dim);color:var(--gold)}
  .db-color-item{display:flex;align-items:center;gap:8px}
  .db-color-item input[type="color"]{width:44px;height:44px;border:1px solid var(--border);border-radius:var(--radius);padding:2px;background:var(--black);cursor:pointer}
  .db-color-item span{font-size:11px;color:var(--muted);line-height:1.4}
  .db-color-item code{font-size:10px;color:var(--text);font-family:'Syne',monospace}

  .db-gen-count{text-align:center;font-size:11px;color:var(--muted);margin-top:16px}
  .db-error{text-align:center;font-size:12px;color:#e55;margin-top:8px}

  /* ── CENTER: PREVIEW ── */
  .db-preview{background:var(--black);position:relative;display:flex;flex-direction:column}
  .db-stage-top{display:flex;justify-content:space-between;gap:18px;padding:20px 20px 14px;border-bottom:1px solid rgba(201,168,76,0.12);background:
    radial-gradient(circle at top left, rgba(201,168,76,0.14), transparent 35%),
    linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0))}
  .db-stage-copy{max-width:620px}
  .db-stage-kicker{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:8px}
  .db-stage-title{font-family:'Playfair Display',Georgia,serif;font-size:34px;line-height:1;color:var(--text);margin-bottom:8px}
  .db-stage-sub{font-size:13px;line-height:1.7;color:rgba(242,237,228,0.68)}
  .db-stage-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;min-width:340px}
  .db-stage-stat{padding:14px 12px;border:1px solid rgba(201,168,76,0.14);border-radius:14px;background:rgba(8,8,8,0.42);display:flex;flex-direction:column;gap:6px}
  .db-stage-stat-label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .db-stage-stat-value{font-size:14px;color:var(--text);text-transform:capitalize}
  .db-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;gap:4px}
  .db-placeholder-title{font-family:'Playfair Display',Georgia,serif;font-size:clamp(26px,3.5vw,44px);font-style:italic;color:var(--text);line-height:1.15}
  .db-placeholder-sub{font-size:13px;color:var(--gold);letter-spacing:0.04em;margin-top:12px;max-width:380px;line-height:1.5;opacity:0.7}

  .db-loading{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px}
  .db-loading-pulse{width:48px;height:48px;border-radius:50%;background:var(--gold);animation:pulse 1.8s ease-in-out infinite}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.2);opacity:1}}
  .db-loading-msg{font-size:14px;color:var(--gold);letter-spacing:0.04em;animation:fadeCycle 2.5s ease-in-out infinite}
  @keyframes fadeCycle{0%,100%{opacity:0.5}50%{opacity:1}}

  /* ── AGENT STATUS PANEL ── */
  .db-agent-panel{width:100%;max-width:560px;padding:24px 28px;border:1px solid var(--border);border-radius:16px;background:
    radial-gradient(circle at top right, rgba(201,168,76,0.10), transparent 60%),
    linear-gradient(180deg, rgba(201,168,76,0.04), rgba(0,0,0,0.18))}
  .db-agent-panel-kicker{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
  .db-agent-panel-title{font-family:'Playfair Display',Georgia,serif;font-size:22px;line-height:1.15;color:var(--text);margin-bottom:18px;min-height:28px}
  .db-agent-list{list-style:none;display:flex;flex-direction:column;gap:10px;padding:0;margin:0}
  .db-agent-row{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:rgba(0,0,0,0.16);transition:border-color .25s,background .25s,opacity .25s;opacity:.7}
  .db-agent-row--waiting{opacity:.55}
  .db-agent-row--working{border-color:rgba(201,168,76,0.35);background:rgba(201,168,76,0.06);opacity:1}
  .db-agent-row--done{opacity:1}
  .db-agent-row--failed{border-color:rgba(220,80,80,0.35);opacity:1}
  .db-agent-dot{width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;color:#0A0A0A;font-weight:700}
  .db-agent-dot--waiting{background:rgba(242,237,228,0.25)}
  .db-agent-dot--working{background:var(--gold);animation:agentPulse 1.2s ease-in-out infinite}
  .db-agent-dot--done{background:#6EE7A6}
  .db-agent-dot--failed{background:#E66A6A}
  @keyframes agentPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.5)}50%{box-shadow:0 0 0 6px rgba(201,168,76,0)}}
  .db-agent-label{font-size:13px;font-weight:600;color:var(--text);letter-spacing:0.01em}
  .db-agent-desc{font-size:11px;color:rgba(242,237,228,0.55);grid-column:2;margin-top:2px}
  .db-agent-state{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-variant-numeric:tabular-nums;grid-column:3;grid-row:1 / span 2;align-self:center}
  .db-agent-state--working{color:var(--gold)}
  .db-agent-state--done{color:#6EE7A6}
  .db-agent-state--failed{color:#E66A6A}

  .db-preview-actions{display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;flex-wrap:wrap}
  .db-action-btn{padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;transition:border-color 0.2s,color 0.2s;min-height:44px}
  .db-action-btn:hover{border-color:var(--gold);color:var(--gold)}
  .db-back-btn{display:none}
  .db-compare{display:grid;grid-template-columns:1fr 1fr;gap:1px;flex:1;background:var(--border)}
  .db-compare-panel{display:flex;flex-direction:column;min-height:0;background:var(--black);transition:max-width 200ms ease}
  .db-compare-panel--mobile{max-width:420px;width:100%;margin:0 auto;background:#050505}
  .db-compare-panel--tablet{max-width:768px;width:100%;margin:0 auto;background:#050505}
  .db-compare-panel--desktop{max-width:none}
  .db-compare-label{padding:8px 12px;border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--gold);background:var(--surface)}
  .db-single-preview{flex:1;display:flex;background:var(--black);transition:max-width 200ms ease}
  .db-single-preview--mobile{max-width:430px;width:100%;margin:0 auto;background:#050505;border-left:1px solid var(--border);border-right:1px solid var(--border)}
  .db-single-preview--tablet{max-width:768px;width:100%;margin:0 auto;background:#050505;border-left:1px solid var(--border);border-right:1px solid var(--border)}
  .db-single-preview--desktop{max-width:none}
  .db-stage-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;flex:1;padding:18px}
  .db-desktop-stage{min-height:0;border:1px solid rgba(201,168,76,0.12);border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.42)}
  .db-device-rail{display:flex;flex-direction:column;gap:14px}
  .db-device-card{padding:14px;border:1px solid rgba(201,168,76,0.16);border-radius:18px;background:linear-gradient(180deg, rgba(201,168,76,0.08), rgba(255,255,255,0.01));box-shadow:0 24px 60px rgba(0,0,0,0.35)}
  .db-device-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
  .db-device-label{display:block;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:4px}
  .db-device-copy{font-size:12px;line-height:1.5;color:rgba(242,237,228,0.62)}
  .db-device-switch{border:1px solid rgba(201,168,76,0.2);background:rgba(0,0,0,0.16);color:var(--text);padding:10px 12px;border-radius:999px;font-family:'Syne',system-ui,sans-serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;min-height:44px}
  .db-device-switch:hover{border-color:var(--gold);color:var(--gold)}
  .db-phone-shell{width:100%;max-width:248px;margin:0 auto;padding:10px;border-radius:28px;background:#050505;border:1px solid rgba(201,168,76,0.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04),0 28px 70px rgba(0,0,0,0.45)}
  .db-phone-shell::before{content:'';display:block;width:74px;height:7px;border-radius:999px;background:rgba(242,237,228,0.16);margin:0 auto 10px}
  .db-phone-iframe{width:100%;height:560px;border:none;border-radius:20px;background:white}
  .db-device-note{padding:16px;border:1px solid rgba(201,168,76,0.14);border-radius:18px;background:rgba(255,255,255,0.02)}
  .db-device-note strong{display:block;font-family:'Playfair Display',Georgia,serif;font-size:22px;line-height:1.1;color:var(--text);margin-bottom:8px}
  .db-device-note p{font-size:12px;line-height:1.6;color:rgba(242,237,228,0.66)}
  .db-iframe{flex:1;width:100%;border:none;background:white}

  /* ── VIEWPORT TOGGLE (Mobile | Tablet | Desktop) ── */
  .db-viewport-toggle{display:inline-flex;gap:4px;align-items:center}

  /* ── RIGHT: CREATIVE DECISIONS ── */
  .db-log{background:var(--surface);border-left:1px solid var(--border);padding:24px 14px;overflow-x:hidden;transition:padding 200ms ease,opacity 200ms ease}
  .db--rail-collapsed .db-log{padding-left:0;padding-right:0;border-left:none;opacity:0;pointer-events:none}
  .db-rail-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
  .db-rail-head .db-log-title{margin-bottom:0}
  .db-rail-toggle{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:1px solid var(--border);border-radius:var(--radius);background:transparent;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color 0.2s,border-color 0.2s}
  .db-rail-toggle:hover{color:var(--gold);border-color:var(--gold)}
  .db-rail-expand{position:absolute;top:80px;right:0;z-index:20;width:24px;height:56px;padding:0;border:1px solid var(--border);border-right:none;border-radius:var(--radius) 0 0 var(--radius);background:var(--surface);color:var(--gold);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transform:rotate(180deg);transition:border-color 0.2s,color 0.2s}
  .db-rail-expand:hover{border-color:var(--gold);color:var(--text)}
  .db-log-title{font-family:'Playfair Display',Georgia,serif;font-size:16px;font-weight:700;margin-bottom:16px}
  .db-log-sub{font-size:11px;line-height:1.55;color:rgba(242,237,228,0.58);margin:0 0 18px}
  .db-blueprint{display:flex;flex-direction:column;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)}
  .db-blueprint-block{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);background:#0d0d0d}
  .db-blueprint-step{display:flex;flex-direction:column;gap:2px;padding-top:8px;margin-top:8px;border-top:1px solid rgba(201,168,76,0.08)}
  .db-blueprint-step-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--gold);font-weight:700}
  .db-score-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:6px;margin-top:6px;border-top:1px solid rgba(201,168,76,0.08)}
  .db-score-label{font-size:12px;color:var(--text)}
  .db-score-value{font-size:12px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}

  .db-log-errors{margin-bottom:16px}
  .db-log-error{display:flex;flex-direction:column;gap:2px;padding:10px 12px;margin-bottom:8px;background:rgba(220,60,60,0.08);border:1px solid rgba(220,60,60,0.2);border-radius:var(--radius)}
  .db-log-error-time{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums}
  .db-log-error-msg{font-size:12px;color:#e88;line-height:1.5;word-break:break-word}

  .db-log-item{display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)}
  .db-log-item--stagger{opacity:0;transform:translateY(8px);transition:opacity 0.4s ease-out,transform 0.4s ease-out}
  .db-log-item--visible{opacity:1;transform:translateY(0)}
  .db-log-icon{color:var(--gold);font-size:14px;flex-shrink:0;margin-top:2px}
  .db-log-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);margin-bottom:2px;font-weight:500}
  .db-log-value{display:block;font-size:13px;color:var(--text);line-height:1.5}
  .db-log-agent{display:inline-block;margin-top:4px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);padding:2px 6px;border:1px solid var(--border);border-radius:100px;background:rgba(201,168,76,0.06)}
  .db-log-body .db-log-reason{margin-top:6px}
  .db-log-reason{display:block;font-size:11px;color:var(--muted);line-height:1.4;font-style:italic;margin-top:3px}

  /* placeholder decisions */
  .db-log-placeholders{display:flex;flex-direction:column;gap:12px}
  .db-log-ph{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);opacity:0.35;transition:opacity 0.6s,color 0.6s}
  .db-log-ph--lit{opacity:1;color:var(--gold)}
  .db-log-ph-icon{font-size:14px;color:var(--gold);opacity:0.4;transition:opacity 0.6s}
  .db-log-ph--lit .db-log-ph-icon{opacity:1}

  /* ── GRAIN ── */
  .db::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:100;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:256px 256px}

  /* ── RESPONSIVE ── */
  @media(max-width:1200px){
    .db{grid-template-columns:360px 1fr 0}
    .db--rail-collapsed{grid-template-columns:360px 1fr 0}
    .db-log{display:none}
    .db-rail-expand{display:none}
    .db-stage-layout{grid-template-columns:1fr}
    .db-device-rail{display:none}
  }
  @media(max-width:1024px){
    .db{grid-template-columns:340px 1fr 0}
    .db-stage-top{flex-direction:column}
    .db-stage-stats{min-width:0}
  }
  @media(max-width:768px){
    .db{display:flex;flex-direction:column;position:relative}
    .db-mobile-nav{display:flex}
    .db-panel{position:absolute;inset:0;bottom:52px;display:none}
    .db-panel--active{display:flex;flex-direction:column}
    .db-form{padding-bottom:80px;border-right:none}
    .db-back-btn{display:inline-flex}
    .db-log{display:none;border-left:none;border-top:1px solid var(--border)}
    .db-log.db-panel--active{display:flex;flex-direction:column}
    .db-presets-row{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}
    .chat{max-height:300px}
    .jbi-input,.jbi-btn{width:100%}
    .db-reference-grid{grid-template-columns:1fr}
    .db-lock-grid{grid-template-columns:1fr}
    .db-compare{grid-template-columns:1fr}
    .db-stage-top{padding:16px}
    .db-stage-title{font-size:28px}
    .db-stage-stats{grid-template-columns:1fr 1fr}
    .db-stage-layout{padding:0}
    .db-form-hero{padding:16px}
    .db-form-title{font-size:24px}
  }

  @media(prefers-reduced-motion:reduce){
    .db-loading-pulse{animation:none;opacity:0.8}
    .db-loading-msg{animation:none;opacity:1}
    .chat-bubble{animation:none}
    .chat-typing-dot{animation:none;opacity:0.6}
    .db-log-item--stagger{opacity:1;transform:none;transition:none}
  }

  .db-panel::-webkit-scrollbar{width:4px}
  .db-panel::-webkit-scrollbar-track{background:transparent}
  .db-panel::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
`
