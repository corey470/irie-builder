'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react'
import { PRESET_PLACEHOLDERS } from '@/lib/constants/presetPlaceholders'

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

interface EmotionalControls {
  authority: number
  desire: number
  warmth: number
  tension: number
  spectacle: number
}

interface GeneratePayload {
  brandName: string
  headline: string
  heroImageUrl: string
  heroImageDescription: string
  ctaText: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: MoodOption
  pageType: PageOption
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
  metadata: Metadata | null
  blueprint: GenerationBlueprint | null
  critique: GenerationCritique | null
  decisions: CreativeDecision[]
  label: string
  createdAt: string
}

interface GenerationHistoryEntry {
  label: string
  verdict: string
}

interface ChatMessage {
  role: 'ai' | 'user'
  text: string
}

interface BriefState {
  briefInput: string
  messages: ChatMessage[]
  currentStep: number
  inputValue: string
  chatExpanded: boolean
  answers: string[]
  presetLabel: string | null
  vibeText: string
  mood: MoodOption
  pageType: PageOption
  designDirection: DesignDirectionOption
  styleBlend: string
  referenceStyles: ReferenceStyleOption[]
  sectionFocus: string
  revisionDirective: string
  carryForwardLocks: string[]
  emotionalControls: EmotionalControls
  primary: string
  accent: string
  background: string
}

interface PendingGenerationRequest {
  id: string
  createdAt: string
  source: 'brief' | 'revision'
}

interface StreamPayload {
  html?: unknown
  metadata?: unknown
  blueprint?: unknown
  critique?: unknown
  decisions?: unknown
}

interface SafeStreamPayload {
  html: string
  metadata: Metadata | null
  blueprint: GenerationBlueprint | null
  critique: GenerationCritique | null
  decisions: CreativeDecision[]
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
type AgentStatusMap = Record<string, AgentState>

const BRIEF_STORAGE_KEY = 'irie-builder-brief'
const LAST_GENERATION_STORAGE_KEY = 'irie-builder-last-generation'
const PASS_HISTORY_STORAGE_KEY = 'irie-builder-pass-history'
const PENDING_GENERATION_STORAGE_KEY = 'irie-builder-pending-generation'
const STORAGE_EVENT_NAME = 'irie-builder-storage'
const RAIL_STORAGE_KEY = 'irie-builder-rail-collapsed'

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

const CHAT_QUESTIONS = [
  { question: "What's your brand called?", placeholder: '' },
  { question: 'What do you want someone to feel when they land here?', placeholder: 'Warm, electric, cinematic, premium, rebellious...' },
  { question: 'Who are you talking to?', placeholder: 'The audience you want this page to move.' },
  { question: "What's the hero headline?", placeholder: 'The first line they should feel.' },
  { question: 'Paste a hero image URL, or describe the scene.', placeholder: 'A URL, or a quick visual description. Type skip if none.' },
  { question: 'What should the main CTA say?', placeholder: 'Shop the collection. Book now. Join the list.' },
] as const

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

const REFERENCE_STYLE_LIBRARY: Array<{ value: ReferenceStyleOption; label: string; note: string }> = [
  { value: 'linear', label: 'Linear', note: 'Sleek product calm, editorial precision, dense confidence.' },
  { value: 'supabase', label: 'Supabase', note: 'Developer warmth, green accents, open-source clarity.' },
  { value: 'raycast', label: 'Raycast', note: 'Glossy dark polish, gradient-native utility confidence.' },
  { value: 'cursor', label: 'Cursor', note: 'AI-native dark tool feel, sharp developer edge.' },
  { value: 'claude', label: 'Claude', note: 'Warm editorial calm with thoughtful softness.' },
  { value: 'airbnb', label: 'Airbnb', note: 'Photography-first hospitality and lifestyle trust.' },
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

const LOADING_MESSAGES = [
  'Reading your brief…',
  'Deciding on your typography…',
  'Building your color system…',
  'Choosing your motion vocabulary…',
  'Writing your headlines…',
  'Designing your sections…',
  'Adding atmosphere…',
  'Placing the unexpected detail…',
  'Bringing it alive…',
  'Almost there…',
]

const { brand: YOUR_BRAND, restaurant: YOUR_RESTAURANT, name: YOUR_NAME, event: YOUR_EVENT } = PRESET_PLACEHOLDERS

const PRESETS = [
  {
    label: 'Streetwear Brand',
    answers: [
      YOUR_BRAND,
      'Bold, urban, premium streetwear. The energy of a drop day. Confident, slightly rebellious, always authentic.',
      'Culture-driven streetwear fans 18-35.',
      'Built different. Worn proud.',
      'skip',
      'Shop the Drop',
    ],
    mood: 'dark' as MoodOption,
    pageType: 'store' as PageOption,
    designDirection: 'nike' as DesignDirectionOption,
    colors: { primary: '#0A0A0A', accent: '#E8C547', background: '#0A0A0A' },
  },
  {
    label: 'Luxury Brand',
    answers: [
      YOUR_BRAND,
      'Quiet luxury. Refined, minimal, timeless. The feeling of quality before you even touch it.',
      'Discerning buyers 30-55 who value craftsmanship over logos.',
      'Refined by design. Defined by you.',
      'skip',
      'Explore the Collection',
    ],
    mood: 'light' as MoodOption,
    pageType: 'store' as PageOption,
    designDirection: 'apple' as DesignDirectionOption,
    colors: { primary: '#1A1A1A', accent: '#C9A84C', background: '#F8F5F0' },
  },
  {
    label: 'Restaurant',
    answers: [
      YOUR_RESTAURANT,
      'Warm, soulful, inviting. The smell of something good cooking. Neighborhood spot with a premium feel.',
      'Local food lovers and experience seekers 25-55.',
      'Food that stays with you.',
      'skip',
      'Reserve a Table',
    ],
    mood: 'warm' as MoodOption,
    pageType: 'landing' as PageOption,
    designDirection: 'notion' as DesignDirectionOption,
    colors: { primary: '#1C0F00', accent: '#D47C2F', background: '#FDF6EC' },
  },
  {
    label: 'Creator Portfolio',
    answers: [
      YOUR_NAME,
      'Creative, editorial, confident. The portfolio of someone who knows exactly what they do and does it exceptionally well.',
      'Brands and businesses looking for creative partnership.',
      'This is my work.',
      'skip',
      'See My Work',
    ],
    mood: 'dark' as MoodOption,
    pageType: 'portfolio' as PageOption,
    designDirection: 'framer' as DesignDirectionOption,
    colors: { primary: '#080808', accent: '#FF4D00', background: '#080808' },
  },
  {
    label: 'Event Page',
    answers: [
      YOUR_EVENT,
      'High energy, exclusive, electric. The anticipation before the doors open. FOMO in the best way.',
      'Event-goers and culture community 21-40.',
      "You don't want to miss this.",
      'skip',
      'Get Your Tickets',
    ],
    mood: 'dark' as MoodOption,
    pageType: 'event' as PageOption,
    designDirection: 'spotify' as DesignDirectionOption,
    colors: { primary: '#0A0008', accent: '#9B5DE5', background: '#0A0008' },
  },
] as const

function emptyAgentStatus(): AgentStatusMap {
  const status: AgentStatusMap = {}
  for (const agent of AGENT_ROSTER) status[agent.name] = 'waiting'
  return status
}

function defaultBriefState(): BriefState {
  return {
    briefInput: '',
    messages: [],
    currentStep: 0,
    inputValue: '',
    chatExpanded: false,
    answers: [],
    presetLabel: null,
    vibeText: '',
    mood: 'dark',
    pageType: 'landing',
    designDirection: 'auto',
    styleBlend: '',
    referenceStyles: ['nike', 'apple'],
    sectionFocus: 'whole-page',
    revisionDirective: '',
    carryForwardLocks: [],
    emotionalControls: {
      authority: 78,
      desire: 82,
      warmth: 54,
      tension: 74,
      spectacle: 80,
    },
    primary: '#111111',
    accent: '#C9A84C',
    background: '#F5F0E8',
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMetadata(value: unknown): value is Metadata {
  return (
    isObject(value) &&
    Array.isArray(value.fonts) &&
    Array.isArray(value.sections) &&
    isObject(value.palette) &&
    Array.isArray(value.motionVocabulary)
  )
}

function isGenerationBlueprint(value: unknown): value is GenerationBlueprint {
  return (
    isObject(value) &&
    isObject(value.brandCore) &&
    isObject(value.designSystem) &&
    isObject(value.motionSystem) &&
    isObject(value.persuasionSystem) &&
    Array.isArray(value.storyArc) &&
    Array.isArray(value.sections)
  )
}

function isGenerationCritique(value: unknown): value is GenerationCritique {
  return (
    isObject(value) &&
    typeof value.summary === 'string' &&
    typeof value.verdict === 'string' &&
    Array.isArray(value.scores) &&
    Array.isArray(value.recommendations)
  )
}

function isCreativeDecision(value: unknown): value is CreativeDecision {
  return isObject(value) && typeof value.label === 'string' && typeof value.value === 'string'
}

function isAgentState(value: unknown): value is AgentState {
  return value === 'waiting' || value === 'working' || value === 'done' || value === 'failed'
}

function parseStreamPayload(value: unknown): SafeStreamPayload {
  if (!isObject(value)) {
    throw new Error('Stream payload is not an object.')
  }
  if (typeof value.html !== 'string' || !value.html.trim()) {
    throw new Error('Stream payload did not include valid HTML.')
  }

  return {
    html: value.html,
    metadata: isMetadata(value.metadata) ? value.metadata : null,
    blueprint: isGenerationBlueprint(value.blueprint) ? value.blueprint : null,
    critique: isGenerationCritique(value.critique) ? value.critique : null,
    decisions: Array.isArray(value.decisions) ? value.decisions.filter(isCreativeDecision) : [],
  }
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT_NAME, { detail: { key } }))
  } catch {}
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT_NAME, { detail: { key } }))
  } catch {}
}

function downloadHtml(html: string, name: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'irie-page'}.html`
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildGenerationLabel(nextCount: number, sectionFocus: string, revisionDirective: string): string {
  if (revisionDirective.trim()) return `Gen ${nextCount}: ${revisionDirective.trim().slice(0, 48)}`
  if (sectionFocus !== 'whole-page') return `Gen ${nextCount}: ${sectionFocus}`
  return `Generation #${nextCount}`
}

function humanizeAgentLabel(name: string): string {
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function stateLabel(state: AgentState): string {
  switch (state) {
    case 'waiting':
      return 'waiting'
    case 'working':
      return 'working'
    case 'done':
      return 'done'
    case 'failed':
      return 'failed'
  }
}

function resolveBrandName(brief: BriefState, generation: GenerationSnapshot | null): string {
  return (
    generation?.blueprint?.brandCore?.brandName ||
    brief.answers[0] ||
    brief.briefInput.trim().slice(0, 42) ||
    'Current Project'
  )
}

function hasBriefContent(brief: BriefState): boolean {
  return Boolean(
    brief.briefInput.trim() ||
    brief.answers.some(answer => answer.trim()) ||
    brief.vibeText.trim() ||
    brief.styleBlend.trim()
  )
}

function summarizeChange(previous: GenerationSnapshot | null, current: GenerationSnapshot | null) {
  if (!previous?.blueprint || !previous?.critique || !current?.blueprint || !current?.critique) return null

  const previousScores = new Map(previous.critique.scores.map(score => [score.label, score.score]))
  const improvements = current.critique.scores
    .map(score => ({ label: score.label, delta: score.score - (previousScores.get(score.label) ?? score.score) }))
    .filter(item => item.delta >= 4)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map(item => `${item.label} improved by ${item.delta} points.`)

  const shifts: string[] = []
  if (previous.blueprint.motionSystem.intensity !== current.blueprint.motionSystem.intensity) {
    shifts.push(`Motion shifted from ${previous.blueprint.motionSystem.intensity} to ${current.blueprint.motionSystem.intensity}.`)
  }
  if (previous.blueprint.designSystem.primaryDirection !== current.blueprint.designSystem.primaryDirection) {
    shifts.push(`Primary direction moved from ${previous.blueprint.designSystem.primaryDirection} to ${current.blueprint.designSystem.primaryDirection}.`)
  }
  if (previous.blueprint.sections[0]?.heading !== current.blueprint.sections[0]?.heading) {
    shifts.push(`The opening section changed from “${previous.blueprint.sections[0]?.heading}” to “${current.blueprint.sections[0]?.heading}.”`)
  }

  return {
    headline: improvements.length > 0 ? 'This pass made meaningful progress.' : 'This pass changed direction more than raw score.',
    improvements,
    shifts: shifts.slice(0, 3),
  }
}

function PreviewFrame({
  html,
  title,
  className,
}: {
  html: string | null
  title: string
  className: string
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!frameRef.current || !html) return
    const doc = frameRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  return <iframe ref={frameRef} title={title} className={className} sandbox="allow-scripts allow-same-origin" />
}

class BuilderErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  handleReset = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <>
        <BuilderPlatformStyles />
        <div className="platform-shell">
          <div className="platform-empty platform-empty--full">
            <span className="platform-kicker">Something went wrong.</span>
            <h1>We hit a snag rendering this page.</h1>
            <p>Reload the dashboard or head back to the brief and try the pass again.</p>
            <button type="button" className="platform-primary-btn" onClick={this.handleReset}>
              Reload dashboard
            </button>
          </div>
        </div>
      </>
    )
  }
}

function BuilderPlatformStyles() {
  return <style>{platformCss}</style>
}

function useGenerationPresence() {
  const [hasGeneration, setHasGeneration] = useState(false)

  useEffect(() => {
    const sync = () => {
      const next = Boolean(readStorage(LAST_GENERATION_STORAGE_KEY, null))
      setHasGeneration(next)
    }

    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(STORAGE_EVENT_NAME, sync as EventListener)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(STORAGE_EVENT_NAME, sync as EventListener)
    }
  }, [])

  return hasGeneration
}

function PlatformNav({ current }: { current: 'dashboard' | 'brief' | 'generate' | 'edit' | 'publish' }) {
  const hasGeneration = useGenerationPresence()

  return (
    <header className="platform-nav">
      <Link href="/" className="platform-wordmark">IrieBuilder</Link>
      <nav className="platform-nav-links" aria-label="Platform">
        <Link href="/dashboard" className={current === 'dashboard' ? 'is-active' : ''}>Projects</Link>
        <Link href="/brief" className={current === 'brief' ? 'is-active' : ''}>Brief</Link>
        {hasGeneration && (
          <Link href="/generate" className={current === 'generate' ? 'is-active' : ''}>Generate</Link>
        )}
      </nav>
    </header>
  )
}

function Pill<T extends string>({
  value,
  label,
  selected,
  onSelect,
}: {
  value: T
  label: string
  selected: T
  onSelect: (value: T) => void
}) {
  const active = value === selected
  return (
    <button
      type="button"
      className={`platform-pill ${active ? 'platform-pill--active' : ''}`}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  )
}

function AgentStatusRow({
  label,
  description,
  state,
}: {
  label: string
  description: string
  state: AgentState
}) {
  return (
    <li className={`platform-agent-row platform-agent-row--${state}`}>
      <span className={`platform-agent-dot platform-agent-dot--${state}`} aria-hidden="true">
        {state === 'done' ? '✓' : state === 'failed' ? '✕' : ''}
      </span>
      <div className="platform-agent-copy">
        <span className="platform-agent-label">{label}</span>
        <span className="platform-agent-description">{description}</span>
        {state === 'failed' && <span className="platform-agent-recovery">Continuing…</span>}
      </div>
      <span className={`platform-agent-state platform-agent-state--${state}`}>{stateLabel(state)}</span>
    </li>
  )
}

export function ProjectsHomePage() {
  const [lastGeneration, setLastGeneration] = useState<GenerationSnapshot | null>(null)

  useEffect(() => {
    setLastGeneration(readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null))
  }, [])

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <PlatformNav current="dashboard" />
        <main className="platform-page platform-page--dashboard">
          <section className="platform-hero-card">
            <span className="platform-kicker">Projects Home</span>
            <h1>One project at a time. One clear next move.</h1>
            <p>
              The generation engine stays the same. This space is just your clean landing point before you write the brief and send the agents to work.
            </p>
            <div className="platform-hero-actions">
              <Link href="/brief" className="platform-primary-btn">Start a new project →</Link>
            </div>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Recent</span>
              <h2>Last generated page</h2>
            </div>
            {lastGeneration ? (
              <div className="platform-recent-card">
                <div>
                  <strong>{lastGeneration.blueprint?.brandCore?.brandName || 'Last Generation'}</strong>
                  <p>{lastGeneration.critique?.verdict || 'Your latest pass is ready to reopen.'}</p>
                  <span>{new Date(lastGeneration.createdAt).toLocaleString()}</span>
                </div>
                <Link href="/generate" className="platform-secondary-btn">Open generation</Link>
              </div>
            ) : (
              <div className="platform-empty">
                <h3>Nothing generated yet.</h3>
                <p>Start a new project and your latest page will show up here for quick access.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </BuilderErrorBoundary>
  )
}

export function BriefPage() {
  const router = useRouter()
  const [brief, setBrief] = useState<BriefState>(defaultBriefState())
  const [loaded, setLoaded] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const conversationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = readStorage<BriefState>(BRIEF_STORAGE_KEY, defaultBriefState())
    setBrief({ ...defaultBriefState(), ...saved })
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    writeStorage(BRIEF_STORAGE_KEY, brief)
  }, [brief, loaded])

  useEffect(() => {
    if (!brief.chatExpanded || isTyping) return
    const active = document.querySelector<HTMLInputElement>('[data-brief-chat-input="true"]')
    active?.focus()
  }, [brief.chatExpanded, isTyping])

  function updateBrief<K extends keyof BriefState>(key: K, value: BriefState[K]) {
    setBrief(prev => ({ ...prev, [key]: value }))
  }

  function toggleReference(style: ReferenceStyleOption) {
    setBrief(prev => ({
      ...prev,
      referenceStyles: prev.referenceStyles.includes(style)
        ? prev.referenceStyles.filter(item => item !== style)
        : [...prev.referenceStyles, style],
    }))
  }

  function toggleCarryForward(value: string) {
    setBrief(prev => ({
      ...prev,
      carryForwardLocks: prev.carryForwardLocks.includes(value)
        ? prev.carryForwardLocks.filter(item => item !== value)
        : [...prev.carryForwardLocks, value],
    }))
  }

  function openConversation() {
    setBrief(prev => {
      if (prev.messages.length > 0) {
        return { ...prev, chatExpanded: true }
      }
      return {
        ...prev,
        chatExpanded: true,
        messages: [{ role: 'ai', text: CHAT_QUESTIONS[0].question }],
      }
    })
    window.setTimeout(() => {
      conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function submitAnswer() {
    const answer = brief.inputValue.trim()
    if (!answer && brief.currentStep !== 4) return

    const displayAnswer = answer || 'skip'
    const nextAnswers = [...brief.answers, displayAnswer]
    const nextStep = brief.currentStep + 1

    setBrief(prev => ({
      ...prev,
      inputValue: '',
      answers: nextAnswers,
      currentStep: nextStep,
      messages: [...prev.messages, { role: 'user', text: displayAnswer }],
    }))

    if (nextStep < CHAT_QUESTIONS.length) {
      setIsTyping(true)
      window.setTimeout(() => {
        setIsTyping(false)
        setBrief(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'ai', text: CHAT_QUESTIONS[nextStep].question }],
        }))
      }, 500)
    } else {
      setIsTyping(true)
      window.setTimeout(() => {
        setIsTyping(false)
        setBrief(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'ai', text: 'Conversation captured. When you are ready, hit Build It.' }],
        }))
      }, 500)
    }
  }

  function applyPreset(label: string) {
    const preset = PRESETS.find(item => item.label === label)
    if (!preset) return

    const messages: ChatMessage[] = CHAT_QUESTIONS.flatMap((question, index) => [
      { role: 'ai', text: question.question },
      { role: 'user', text: preset.answers[index] || 'skip' },
    ])

    setBrief(prev => ({
      ...prev,
      mood: preset.mood,
      pageType: preset.pageType,
      designDirection: preset.designDirection,
      referenceStyles: preset.designDirection === 'auto' ? prev.referenceStyles : [preset.designDirection as ReferenceStyleOption],
      primary: preset.colors.primary,
      accent: preset.colors.accent,
      background: preset.colors.background,
      chatExpanded: true,
      messages: [...messages, { role: 'ai', text: 'Preset loaded. Adjust the brief and hit Build It when you are ready.' }],
      answers: [...preset.answers],
      currentStep: CHAT_QUESTIONS.length,
      presetLabel: preset.label,
      inputValue: '',
    }))

    window.setTimeout(() => {
      conversationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  function startBuild() {
    if (!hasBriefContent(brief)) return
    const request: PendingGenerationRequest = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pending-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: 'brief',
    }
    writeStorage(BRIEF_STORAGE_KEY, brief)
    writeStorage(PENDING_GENERATION_STORAGE_KEY, request)
    router.push('/generate')
  }

  const canBuild = hasBriefContent(brief)

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <PlatformNav current="brief" />
        <main className="platform-page platform-page--brief">
          <section className="platform-brief-hero">
            <span className="platform-kicker">Creative Brief</span>
            <h1>Shape the page before the engine touches a pixel.</h1>
            <p>Every control here feeds the same generation engine. This page just gives the brief room to breathe.</p>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Presets</span>
              <h2>Start from a direction</h2>
            </div>
            <div className="platform-chip-grid">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className={`platform-chip ${brief.presetLabel === preset.label ? 'platform-chip--active' : ''}`}
                  onClick={() => applyPreset(preset.label)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Vision</span>
              <h2>Describe your vision</h2>
            </div>
            <textarea
              className="platform-textarea platform-textarea--hero"
              rows={4}
              value={brief.briefInput}
              onChange={event => updateBrief('briefInput', event.target.value)}
              placeholder="Describe the feeling, the offer, the world, and the kind of page you want Irie Builder to create."
            />
          </section>

          <section ref={conversationRef} className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Conversation</span>
              <h2>Or have a conversation</h2>
            </div>
            {!brief.chatExpanded ? (
              <button type="button" className="platform-secondary-btn" onClick={openConversation}>
                Open the guided conversation →
              </button>
            ) : (
              <div className="platform-chat">
                <div className="platform-chat-messages">
                  {brief.messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`platform-chat-bubble platform-chat-bubble--${message.role}`}>
                      {message.text}
                    </div>
                  ))}
                  {isTyping && <div className="platform-chat-typing">•••</div>}
                </div>
                <div className="platform-chat-input-row">
                  <input
                    data-brief-chat-input="true"
                    type="text"
                    className="platform-input"
                    value={brief.inputValue}
                    onChange={event => updateBrief('inputValue', event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') submitAnswer() }}
                    placeholder={brief.currentStep < CHAT_QUESTIONS.length ? CHAT_QUESTIONS[brief.currentStep].placeholder : 'Everything is captured. Adjust the brief and build when ready.'}
                  />
                  <button type="button" className="platform-secondary-btn" onClick={submitAnswer}>Send</button>
                </div>
              </div>
            )}
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Your Vibe</span>
              <h2>Set the emotional and visual direction</h2>
            </div>

            <label className="platform-field">
              <span>Extra vibe detail</span>
              <textarea
                className="platform-textarea"
                rows={3}
                value={brief.vibeText}
                onChange={event => updateBrief('vibeText', event.target.value)}
                placeholder="Add mood, texture, tension, references, or anything the page should feel like."
              />
            </label>

            <div className="platform-control-block">
              <span className="platform-field-label">Mood</span>
              <div className="platform-pill-row">
                {(['light', 'dark', 'warm'] as MoodOption[]).map(option => (
                  <Pill key={option} value={option} label={option.toUpperCase()} selected={brief.mood} onSelect={value => updateBrief('mood', value)} />
                ))}
              </div>
            </div>

            <div className="platform-control-block">
              <span className="platform-field-label">Page Type</span>
              <div className="platform-pill-row">
                {(['landing', 'store', 'portfolio', 'event'] as PageOption[]).map(option => (
                  <Pill key={option} value={option} label={option.toUpperCase()} selected={brief.pageType} onSelect={value => updateBrief('pageType', value)} />
                ))}
              </div>
            </div>

            <div className="platform-control-block">
              <span className="platform-field-label">Design Toolkit</span>
              <div className="platform-pill-row">
                {DESIGN_DIRECTIONS.map(option => (
                  <Pill
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    selected={brief.designDirection}
                    onSelect={value => updateBrief('designDirection', value)}
                  />
                ))}
              </div>
              <p className="platform-helper">{DESIGN_DIRECTIONS.find(option => option.value === brief.designDirection)?.note}</p>
            </div>

            <label className="platform-field">
              <span>Style Blend</span>
              <textarea
                className="platform-textarea"
                rows={3}
                value={brief.styleBlend}
                onChange={event => updateBrief('styleBlend', event.target.value)}
                placeholder="Nike energy with Apple restraint. Vercel precision but warmer. Framer motion with streetwear edge."
              />
            </label>

            <div className="platform-control-block">
              <span className="platform-field-label">Reference Library</span>
              <div className="platform-reference-grid">
                {REFERENCE_STYLE_LIBRARY.map(style => (
                  <button
                    key={style.value}
                    type="button"
                    className={`platform-reference-card ${brief.referenceStyles.includes(style.value) ? 'platform-reference-card--active' : ''}`}
                    onClick={() => toggleReference(style.value)}
                  >
                    <strong>{style.label}</strong>
                    <span>{style.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Emotional Controls</span>
              <h2>Push the page where it needs pressure</h2>
            </div>
            <div className="platform-slider-grid">
              {EMOTIONAL_SLIDERS.map(slider => (
                <label key={slider.key} className="platform-slider">
                  <div className="platform-slider-head">
                    <span>{slider.label}</span>
                    <strong>{brief.emotionalControls[slider.key]}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={brief.emotionalControls[slider.key]}
                    onChange={event => updateBrief('emotionalControls', { ...brief.emotionalControls, [slider.key]: Number(event.target.value) })}
                  />
                  <span>{slider.note}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Direction</span>
              <h2>Direct the next pass</h2>
            </div>

            <div className="platform-control-block">
              <span className="platform-field-label">Directing Pass</span>
              <div className="platform-pill-row">
                {DIRECTING_FOCUS_OPTIONS.map(option => (
                  <Pill
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    selected={brief.sectionFocus}
                    onSelect={value => updateBrief('sectionFocus', value)}
                  />
                ))}
              </div>
            </div>

            <label className="platform-field">
              <span>Creative Note</span>
              <textarea
                className="platform-textarea"
                rows={3}
                value={brief.revisionDirective}
                onChange={event => updateBrief('revisionDirective', event.target.value)}
                placeholder="Make the hero feel more dangerous. Hold the CTA longer. Push trust earlier. Add more cinematic reveals."
              />
            </label>

            <div className="platform-control-block">
              <span className="platform-field-label">Carry Forward Locks</span>
              <div className="platform-chip-grid">
                {CARRY_FORWARD_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`platform-chip ${brief.carryForwardLocks.includes(option.value) ? 'platform-chip--active' : ''}`}
                    onClick={() => toggleCarryForward(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="platform-section-card">
            <div className="platform-section-head">
              <span className="platform-kicker">Colors</span>
              <h2>Set the palette anchors</h2>
            </div>
            <div className="platform-color-grid">
              {[
                { key: 'primary' as const, label: 'Primary' },
                { key: 'accent' as const, label: 'Accent' },
                { key: 'background' as const, label: 'Background' },
              ].map(color => (
                <label key={color.key} className="platform-color-card">
                  <input
                    type="color"
                    value={brief[color.key]}
                    onChange={event => updateBrief(color.key, event.target.value)}
                  />
                  <span>{color.label}</span>
                  <code>{brief[color.key]}</code>
                </label>
              ))}
            </div>
          </section>

          <section className="platform-build-card">
            <button type="button" className="platform-primary-btn platform-primary-btn--wide" onClick={startBuild} disabled={!canBuild}>
              Build It →
            </button>
            <button type="button" className="platform-text-link" onClick={openConversation}>
              or have a conversation →
            </button>
          </section>
        </main>
      </div>
    </BuilderErrorBoundary>
  )
}

export function GeneratePage() {
  const router = useRouter()
  const [brief, setBrief] = useState<BriefState>(defaultBriefState())
  const [html, setHtml] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [blueprint, setBlueprint] = useState<GenerationBlueprint | null>(null)
  const [critique, setCritique] = useState<GenerationCritique | null>(null)
  const [decisions, setDecisions] = useState<CreativeDecision[]>([])
  const [previousGeneration, setPreviousGeneration] = useState<GenerationSnapshot | null>(null)
  const [passHistory, setPassHistory] = useState<GenerationHistoryEntry[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatusMap>(emptyAgentStatus())
  const [viewportMode, setViewportMode] = useState<'mobile' | 'desktop'>('desktop')
  const [previewMode, setPreviewMode] = useState<'current' | 'before-after'>('current')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [revisionInput, setRevisionInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [generationCount, setGenerationCount] = useState(0)
  const [errorLog, setErrorLog] = useState<Array<{ time: string; message: string }>>([])
  const processedPendingId = useRef<string | null>(null)

  const currentGeneration: GenerationSnapshot | null = html
    ? {
      html,
      metadata,
      blueprint,
      critique,
      decisions,
      label: passHistory[0]?.label || buildGenerationLabel(generationCount || 1, brief.sectionFocus, revisionInput),
      createdAt: generatedAt || new Date().toISOString(),
    }
    : null

  useEffect(() => {
    const savedBrief = readStorage<BriefState>(BRIEF_STORAGE_KEY, defaultBriefState())
    setBrief(savedBrief)
    setRevisionInput(savedBrief.revisionDirective || '')
    const savedGeneration = readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null)
    if (savedGeneration) {
      setHtml(savedGeneration.html)
      setMetadata(savedGeneration.metadata)
      setBlueprint(savedGeneration.blueprint)
      setCritique(savedGeneration.critique)
      setDecisions(savedGeneration.decisions)
      setGeneratedAt(savedGeneration.createdAt)
    }
    const savedHistory = readStorage<GenerationHistoryEntry[]>(PASS_HISTORY_STORAGE_KEY, [])
    setPassHistory(savedHistory)
    setGenerationCount(savedHistory.length)
    try {
      if (window.localStorage.getItem(RAIL_STORAGE_KEY) === 'true') {
        setRailCollapsed(true)
      }
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded || !loading) return
    const id = window.setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1 < LOADING_MESSAGES.length ? prev + 1 : prev))
    }, 2500)
    return () => window.clearInterval(id)
  }, [loaded, loading])

  useEffect(() => {
    if (!loaded || !currentGeneration) return
    writeStorage(LAST_GENERATION_STORAGE_KEY, currentGeneration)
  }, [currentGeneration, loaded])

  useEffect(() => {
    if (!loaded) return
    writeStorage(PASS_HISTORY_STORAGE_KEY, passHistory)
  }, [passHistory, loaded])

  useEffect(() => {
    if (!loaded) return
    writeStorage(BRIEF_STORAGE_KEY, { ...brief, revisionDirective: revisionInput })
  }, [brief, revisionInput, loaded])

  useEffect(() => {
    if (!loaded || loading) return
    const pending = readStorage<PendingGenerationRequest | null>(PENDING_GENERATION_STORAGE_KEY, null)
    if (!pending || pending.id === processedPendingId.current) return
    processedPendingId.current = pending.id
    removeStorage(PENDING_GENERATION_STORAGE_KEY)
    void generateSite(pending.source === 'revision' ? revisionInput : brief.revisionDirective)
  }, [brief.revisionDirective, loaded, loading, revisionInput])

  function toggleRail() {
    setRailCollapsed(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(RAIL_STORAGE_KEY, String(next))
      } catch {}
      return next
    })
  }

  async function generateSite(revisionOverride?: string) {
    const answers = brief.answers
    const brandName = answers[0] || ''
    const vibe = answers[1] || ''
    const audience = answers[2] || ''
    const headline = answers[3] || ''
    const heroRaw = answers[4] || ''
    const ctaText = answers[5] || ''
    const isUrl = /^https?:\/\//i.test(heroRaw)
    const isSkip = heroRaw.toLowerCase() === 'skip' || !heroRaw.trim()
    const directiveText = (revisionOverride ?? revisionInput ?? '').trim()
    const mergedVibe = brief.vibeText.trim() ? `${vibe}. ${brief.vibeText.trim()}` : vibe

    if (!hasBriefContent(brief)) return

    const previous = currentGeneration
    const nextCount = passHistory.length + 1
    const nextLabel = buildGenerationLabel(nextCount, brief.sectionFocus, directiveText)
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}`

    setLoading(true)
    setLoadingMessageIndex(0)
    setError(null)
    setAgentStatus(emptyAgentStatus())
    setPreviousGeneration(previous)

    const payload: GeneratePayload & { requestId: string } = {
      requestId,
      brandName: brandName.trim(),
      headline: headline.trim(),
      heroImageUrl: isUrl ? heroRaw.trim() : '',
      heroImageDescription: !isUrl && !isSkip ? heroRaw.trim() : '',
      ctaText: ctaText.trim(),
      vibe: mergedVibe.trim(),
      audience: audience.trim(),
      colors: {
        primary: brief.primary,
        accent: brief.accent,
        background: brief.background,
      },
      mood: brief.mood,
      pageType: brief.pageType,
      designDirection: brief.designDirection,
      emotionalControls: brief.emotionalControls,
      ...(brief.sectionFocus !== 'whole-page' ? { sectionFocus: brief.sectionFocus } : {}),
      ...(directiveText ? { revisionDirective: directiveText } : {}),
      ...(brief.carryForwardLocks.length ? { carryForwardLocks: brief.carryForwardLocks } : {}),
      ...(brief.styleBlend.trim() ? { styleBlend: brief.styleBlend.trim() } : {}),
      ...(brief.referenceStyles.length ? { referenceStyles: brief.referenceStyles } : {}),
      ...(brief.briefInput.trim() ? { rawBrief: brief.briefInput.trim() } : {}),
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok || !response.body) {
        const raw = await response.text().catch(() => '')
        throw new Error(raw || `Generation failed (HTTP ${response.status})`)
      }

      let completePayload: unknown | null = null
      let buffer = ''
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          let event: Record<string, unknown>
          try {
            event = JSON.parse(line) as Record<string, unknown>
          } catch {
            continue
          }
          if (event.type === 'status' && typeof event.agent === 'string' && isAgentState(event.state)) {
            setAgentStatus(prev => ({ ...prev, [event.agent as string]: event.state as AgentState }))
          } else if (event.type === 'complete' && event.payload) {
            completePayload = event.payload
          } else if (event.type === 'error' && typeof event.message === 'string') {
            throw new Error(event.message)
          }
        }
      }

      if (buffer.trim()) {
        try {
          const finalEvent = JSON.parse(buffer) as Record<string, unknown>
          if (finalEvent.type === 'complete' && finalEvent.payload) {
            completePayload = finalEvent.payload
          }
        } catch {}
      }

      if (!completePayload) {
        throw new Error('Stream ended without a complete payload.')
      }

      const parsed = parseStreamPayload(completePayload as StreamPayload)
      const nextGeneration: GenerationSnapshot = {
        html: parsed.html,
        metadata: parsed.metadata,
        blueprint: parsed.blueprint,
        critique: parsed.critique,
        decisions: parsed.decisions,
        label: nextLabel,
        createdAt: new Date().toISOString(),
      }

      setHtml(parsed.html)
      setMetadata(parsed.metadata)
      setBlueprint(parsed.blueprint)
      setCritique(parsed.critique)
      setDecisions(parsed.decisions)
      setGeneratedAt(nextGeneration.createdAt)
      setPassHistory(prev => [{ label: nextLabel, verdict: parsed.critique?.verdict || 'New pass generated.' }, ...prev].slice(0, 8))
      setGenerationCount(nextCount)
      setPreviewMode(previous ? 'before-after' : 'current')
      writeStorage(LAST_GENERATION_STORAGE_KEY, nextGeneration)
    } catch (generationError: unknown) {
      const message = generationError instanceof Error ? generationError.message : 'Unknown error'
      setError(message)
      setErrorLog(prev => [...prev, { time: new Date().toLocaleTimeString(), message }])
    } finally {
      setLoading(false)
    }
  }

  function handleRegenerate() {
    void generateSite(revisionInput)
  }

  function handleRevisionSubmit() {
    const nextBrief = { ...brief, revisionDirective: revisionInput }
    setBrief(nextBrief)
    writeStorage(BRIEF_STORAGE_KEY, nextBrief)
    void generateSite(revisionInput)
  }

  function openFullscreen() {
    if (!html) return
    const next = window.open('', '_blank')
    if (!next) return
    next.document.open()
    next.document.write(html)
    next.document.close()
  }

  const knownAgents = new Set<string>(AGENT_ROSTER.map(agent => agent.name))
  const additionalAgents = Object.entries(agentStatus).filter(([name]) => !knownAgents.has(name))
  const agentRows = [
    ...AGENT_ROSTER.map(agent => ({
      key: agent.name,
      label: agent.label,
      description: agent.description,
      state: agentStatus[agent.name] || 'waiting',
    })),
    ...additionalAgents.map(([name, state]) => ({
      key: name,
      label: humanizeAgentLabel(name),
      description: 'Additional collaborator',
      state,
    })),
  ]

  const currentSnapshot = currentGeneration
  const changeSummary = summarizeChange(previousGeneration, currentSnapshot)
  const mobileImpactScore = critique?.scores.find(score => score.label === 'Mobile Impact')?.score

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <PlatformNav current="generate" />
        <main className={`platform-page platform-page--generate ${railCollapsed ? 'platform-page--rail-collapsed' : ''}`}>
          <aside className="platform-agent-panel">
            <span className="platform-kicker">Agent Panel</span>
            <h1>{loading ? LOADING_MESSAGES[loadingMessageIndex] : 'Live Direction Stage'}</h1>
            <p>{loading ? 'The full creative team is assembling the page in real time.' : 'Generate, critique, revise, and compare from one focused stage.'}</p>
            <ul className="platform-agent-list">
              {agentRows.map(agent => (
                <AgentStatusRow
                  key={agent.key}
                  label={agent.label}
                  description={agent.description}
                  state={agent.state}
                />
              ))}
            </ul>
          </aside>

          <section className="platform-generate-main">
            <div className="platform-toolbar">
              <div className="platform-toolbar-stats">
                <div><span>Brand</span><strong>{resolveBrandName(brief, currentSnapshot)}</strong></div>
                <div><span>Direction</span><strong>{blueprint?.designSystem?.primaryDirection || brief.designDirection}</strong></div>
                <div><span>Motion</span><strong>{blueprint?.motionSystem?.intensity || 'editorial'}</strong></div>
                <div><span>Mobile</span><strong>{mobileImpactScore ?? '—'}</strong></div>
              </div>
              <div className="platform-toolbar-actions">
                <button type="button" className="platform-secondary-btn" onClick={openFullscreen} disabled={!html}>View Full Screen</button>
                <button type="button" className="platform-secondary-btn" onClick={() => html && downloadHtml(html, resolveBrandName(brief, currentSnapshot))} disabled={!html}>Download HTML</button>
                <div className="platform-pill-row platform-pill-row--compact">
                  <button type="button" className={`platform-pill ${viewportMode === 'mobile' ? 'platform-pill--active' : ''}`} onClick={() => setViewportMode('mobile')}>Mobile</button>
                  <button type="button" className={`platform-pill ${viewportMode === 'desktop' ? 'platform-pill--active' : ''}`} onClick={() => setViewportMode('desktop')}>Desktop</button>
                </div>
                <button type="button" className="platform-secondary-btn" onClick={handleRegenerate} disabled={loading || !hasBriefContent(brief)}>Regenerate</button>
              </div>
            </div>

            {!html && !loading && (
              <div className="platform-empty">
                <h2>No active generation yet.</h2>
                <p>Head back to the brief, fill in the direction, and hit Build It to start the agent pipeline.</p>
                <Link href="/brief" className="platform-primary-btn">Go to Brief →</Link>
              </div>
            )}

            {loading && (
              <div className="platform-loading-stage">
                <div className="platform-loading-orb" />
                <p>The preview will appear here as soon as the assembler finishes the page.</p>
              </div>
            )}

            {html && !loading && (
              <>
                {previewMode === 'before-after' && previousGeneration ? (
                  <div className={`platform-preview-grid platform-preview-grid--${viewportMode}`}>
                    <div className="platform-preview-panel">
                      <span className="platform-preview-label">Before</span>
                      <PreviewFrame html={previousGeneration.html} title="Previous generation preview" className="platform-preview-frame" />
                    </div>
                    <div className="platform-preview-panel">
                      <span className="platform-preview-label">After</span>
                      <PreviewFrame html={html} title="Current generation preview" className="platform-preview-frame" />
                    </div>
                  </div>
                ) : (
                  <div className={`platform-preview-single platform-preview-single--${viewportMode}`}>
                    {viewportMode === 'desktop' ? (
                      <div className="platform-desktop-preview">
                        <PreviewFrame html={html} title="Generated site preview" className="platform-preview-frame" />
                        <div className="platform-mobile-card">
                          <span className="platform-kicker">Phone Preview</span>
                          <p>Keep the mobile hit in view without leaving the main desktop composition.</p>
                          <PreviewFrame html={html} title="Generated mobile site preview" className="platform-preview-frame platform-preview-frame--phone" />
                        </div>
                      </div>
                    ) : (
                      <PreviewFrame html={html} title="Generated site preview" className="platform-preview-frame" />
                    )}
                  </div>
                )}

                <div className="platform-review-actions">
                  <Link href="/edit" className="platform-primary-btn">Looking good? Edit it →</Link>
                  <Link href="/brief" className="platform-text-link">Start over</Link>
                  {previousGeneration && (
                    <button type="button" className="platform-secondary-btn" onClick={() => setPreviewMode(prev => prev === 'current' ? 'before-after' : 'current')}>
                      {previewMode === 'before-after' ? 'Current Only' : 'Before / After'}
                    </button>
                  )}
                </div>
              </>
            )}

            <section className="platform-section-card">
              <div className="platform-section-head">
                <span className="platform-kicker">Revision</span>
                <h2>Tell me what to change</h2>
              </div>
              <div className="platform-revision-row">
                <textarea
                  className="platform-textarea"
                  rows={3}
                  value={revisionInput}
                  onChange={event => setRevisionInput(event.target.value)}
                  placeholder="Push the hero harder. Make it more luxurious. Add more tension. Bring trust forward."
                />
                <button type="button" className="platform-primary-btn" onClick={handleRevisionSubmit} disabled={loading || !revisionInput.trim()}>
                  Rebuild with note →
                </button>
              </div>
            </section>

            <section className="platform-history-grid">
              <div className="platform-section-card">
                <div className="platform-section-head">
                  <span className="platform-kicker">Pass History</span>
                  <h2>Recent passes</h2>
                </div>
                {passHistory.length > 0 ? (
                  <div className="platform-history-list">
                    {passHistory.map(item => (
                      <article key={item.label} className="platform-history-item">
                        <strong>{item.label}</strong>
                        <p>{item.verdict}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="platform-empty">
                    <h3>No pass history yet.</h3>
                    <p>The last few verdicts will appear here after generation completes.</p>
                  </div>
                )}
              </div>

              <div className="platform-section-card">
                <div className="platform-section-head">
                  <span className="platform-kicker">What Changed</span>
                  <h2>Compare direction</h2>
                </div>
                {changeSummary ? (
                  <div className="platform-summary-list">
                    <strong>{changeSummary.headline}</strong>
                    {changeSummary.improvements.map(item => <p key={item}>{item}</p>)}
                    {changeSummary.shifts.map(item => <p key={item}>{item}</p>)}
                  </div>
                ) : (
                  <div className="platform-empty">
                    <h3>No compare story yet.</h3>
                    <p>Run another pass and this panel will tell you what actually shifted.</p>
                  </div>
                )}
              </div>
            </section>

            {error && (
              <section className="platform-section-card platform-section-card--error">
                <div className="platform-section-head">
                  <span className="platform-kicker">Generation Error</span>
                  <h2>We hit a snag.</h2>
                </div>
                <p>{error}</p>
              </section>
            )}

            {errorLog.length > 0 && (
              <section className="platform-section-card">
                <div className="platform-section-head">
                  <span className="platform-kicker">Log</span>
                  <h2>Recent errors</h2>
                </div>
                <div className="platform-history-list">
                  {errorLog.map(entry => (
                    <article key={`${entry.time}-${entry.message}`} className="platform-history-item">
                      <strong>{entry.time}</strong>
                      <p>{entry.message}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>

          <aside className={`platform-decisions-rail ${railCollapsed ? 'platform-decisions-rail--collapsed' : ''}`}>
            <div className="platform-rail-head">
              <div>
                <span className="platform-kicker">Creative Decisions</span>
                <h2>Blueprint + critique</h2>
              </div>
              <button type="button" className="platform-rail-toggle" onClick={toggleRail}>
                {railCollapsed ? '›' : '‹'}
              </button>
            </div>

            {!railCollapsed && (
              <div className="platform-rail-body">
                {blueprint && (
                  <>
                    <article className="platform-rail-card">
                      <span className="platform-rail-label">Brand Core</span>
                      <strong>{blueprint.brandCore.brandName}</strong>
                      <p>{blueprint.brandCore.emotionalPromise}</p>
                      <p>Voice: {blueprint.brandCore.brandVoice}</p>
                    </article>
                    <article className="platform-rail-card">
                      <span className="platform-rail-label">Design</span>
                      <strong>{blueprint.designSystem.primaryDirection}</strong>
                      <p>{blueprint.designSystem.typographyStrategy}</p>
                      <p>{blueprint.designSystem.paletteStrategy}</p>
                    </article>
                    <article className="platform-rail-card">
                      <span className="platform-rail-label">Motion</span>
                      <strong>{blueprint.motionSystem.intensity}</strong>
                      <p>{blueprint.motionSystem.revealBehavior}</p>
                    </article>
                  </>
                )}

                {critique && (
                  <article className="platform-rail-card">
                    <span className="platform-rail-label">Critique</span>
                    <strong>{critique.verdict}</strong>
                    <p>{critique.summary}</p>
                    {critique.scores.map(score => (
                      <div key={score.label} className="platform-score-row">
                        <span>{score.label}</span>
                        <strong>{score.score}</strong>
                      </div>
                    ))}
                  </article>
                )}

                {decisions.length > 0 ? decisions.map(decision => (
                  <article key={`${decision.label}-${decision.value}`} className="platform-rail-card">
                    <span className="platform-rail-label">{decision.label}</span>
                    <strong>{decision.value}</strong>
                    {decision.agent && <span className="platform-rail-agent">↳ {decision.agent}</span>}
                    <p>{decision.reason}</p>
                  </article>
                )) : (
                  <article className="platform-rail-card">
                    <span className="platform-rail-label">Waiting</span>
                    <strong>Creative decisions will land here.</strong>
                    <p>Once generation finishes, the rail will show the blueprint, critique, and agent-attributed choices.</p>
                  </article>
                )}
              </div>
            )}
          </aside>
        </main>
      </div>
    </BuilderErrorBoundary>
  )
}

export function PlaceholderPage({
  mode,
  title,
  body,
}: {
  mode: 'edit' | 'publish'
  title: string
  body: string
}) {
  const [generation, setGeneration] = useState<GenerationSnapshot | null>(null)

  useEffect(() => {
    setGeneration(readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null))
  }, [])

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <PlatformNav current={mode} />
        <main className="platform-page platform-page--placeholder">
          <section className="platform-hero-card">
            <span className="platform-kicker">{mode === 'edit' ? 'Editor' : 'Publish'}</span>
            <h1>{title}</h1>
            <p>{body}</p>
            <div className="platform-hero-actions">
              <button
                type="button"
                className="platform-primary-btn"
                onClick={() => generation?.html && downloadHtml(generation.html, generation.blueprint?.brandCore?.brandName || 'irie-page')}
                disabled={!generation?.html}
              >
                Download HTML
              </button>
              <Link href="/generate" className="platform-text-link">← Back to Generate</Link>
            </div>
          </section>

          {generation?.html ? (
            <section className="platform-section-card">
              <PreviewFrame html={generation.html} title={`${mode} preview`} className="platform-preview-frame" />
            </section>
          ) : (
            <section className="platform-empty">
              <h2>No generated page ready yet.</h2>
              <p>Generate a page first, then come back here to continue.</p>
            </section>
          )}
        </main>
      </div>
    </BuilderErrorBoundary>
  )
}

const platformCss = `
  *,*::before,*::after{box-sizing:border-box}
  :root{
    --bg:#080808;
    --panel:#101010;
    --panel-2:#141414;
    --line:rgba(201,168,76,0.18);
    --gold:#C9A84C;
    --gold-soft:rgba(201,168,76,0.12);
    --text:#FAF7F2;
    --muted:rgba(250,247,242,0.68);
    --muted-2:rgba(250,247,242,0.42);
    --danger:#E37272;
    --radius:24px;
    --shadow:0 32px 80px rgba(0,0,0,0.35);
  }

  body{
    background:var(--bg);
    color:var(--text);
    font-family:'Syne',system-ui,sans-serif;
    min-height:100dvh;
  }

  .platform-shell{
    min-height:100dvh;
    background:
      radial-gradient(circle at top right, rgba(201,168,76,0.11), transparent 28%),
      radial-gradient(circle at bottom left, rgba(201,168,76,0.07), transparent 24%),
      var(--bg);
  }

  .platform-nav{
    position:sticky;
    top:0;
    z-index:40;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    padding:1.2rem clamp(1.1rem, 3vw, 2.4rem);
    border-bottom:1px solid rgba(201,168,76,0.08);
    background:rgba(8,8,8,0.86);
    backdrop-filter:blur(18px);
  }

  .platform-wordmark{
    color:var(--gold);
    text-decoration:none;
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.15rem;
    font-weight:700;
    letter-spacing:0.04em;
  }

  .platform-nav-links{
    display:flex;
    align-items:center;
    gap:0.8rem;
    flex-wrap:wrap;
  }

  .platform-nav-links a{
    color:var(--muted);
    text-decoration:none;
    font-size:0.72rem;
    letter-spacing:0.18em;
    text-transform:uppercase;
    padding:0.8rem 1rem;
    min-height:44px;
    display:inline-flex;
    align-items:center;
    border:1px solid transparent;
    border-radius:999px;
  }

  .platform-nav-links a.is-active,
  .platform-nav-links a:hover{
    color:var(--gold);
    border-color:rgba(201,168,76,0.22);
    background:rgba(201,168,76,0.06);
  }

  .platform-page{
    width:min(1440px, calc(100% - 2rem));
    margin:0 auto;
    padding:1.5rem 0 3rem;
  }

  .platform-page--dashboard,
  .platform-page--brief,
  .platform-page--placeholder{
    display:grid;
    gap:1.25rem;
  }

  .platform-page--generate{
    display:grid;
    grid-template-columns:280px minmax(0,1fr) 220px;
    gap:1rem;
    align-items:start;
  }

  .platform-page--generate.platform-page--rail-collapsed{
    grid-template-columns:280px minmax(0,1fr) 44px;
  }

  .platform-kicker{
    display:inline-flex;
    align-items:center;
    gap:0.4rem;
    color:var(--gold);
    font-size:0.72rem;
    text-transform:uppercase;
    letter-spacing:0.22em;
  }

  .platform-hero-card,
  .platform-section-card,
  .platform-agent-panel,
  .platform-decisions-rail{
    border:1px solid var(--line);
    border-radius:var(--radius);
    background:
      linear-gradient(180deg, rgba(201,168,76,0.04), rgba(255,255,255,0.01)),
      var(--panel);
    box-shadow:var(--shadow);
  }

  .platform-hero-card,
  .platform-section-card{
    padding:clamp(1.2rem, 2.4vw, 2rem);
  }

  .platform-hero-card h1,
  .platform-brief-hero h1,
  .platform-agent-panel h1{
    margin:0.65rem 0 0.85rem;
    font-family:'Playfair Display', Georgia, serif;
    font-size:clamp(2rem, 4vw, 4.5rem);
    line-height:0.95;
    letter-spacing:-0.03em;
  }

  .platform-hero-card p,
  .platform-brief-hero p,
  .platform-agent-panel p,
  .platform-empty p,
  .platform-section-card p{
    margin:0;
    color:var(--muted);
    line-height:1.75;
    font-size:0.98rem;
  }

  .platform-brief-hero{
    padding:1rem 0 0.25rem;
  }

  .platform-hero-actions{
    display:flex;
    flex-wrap:wrap;
    gap:0.8rem;
    margin-top:1.4rem;
  }

  .platform-primary-btn,
  .platform-secondary-btn,
  .platform-text-link,
  .platform-chip,
  .platform-pill,
  .platform-rail-toggle{
    min-height:44px;
  }

  .platform-primary-btn{
    border:none;
    border-radius:999px;
    background:var(--gold);
    color:#0A0A0A;
    text-decoration:none;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:0.95rem 1.35rem;
    font-size:0.78rem;
    font-weight:700;
    letter-spacing:0.18em;
    text-transform:uppercase;
    cursor:pointer;
  }

  .platform-primary-btn:disabled{
    opacity:0.45;
    cursor:not-allowed;
  }

  .platform-primary-btn--wide{
    width:100%;
  }

  .platform-secondary-btn{
    border:1px solid var(--line);
    border-radius:999px;
    background:rgba(255,255,255,0.02);
    color:var(--text);
    padding:0.9rem 1.15rem;
    text-decoration:none;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:0.72rem;
    letter-spacing:0.14em;
    text-transform:uppercase;
    cursor:pointer;
  }

  .platform-text-link{
    border:none;
    background:none;
    color:var(--gold);
    padding:0.25rem 0;
    text-decoration:none;
    font-size:0.82rem;
    letter-spacing:0.08em;
    text-transform:uppercase;
    cursor:pointer;
    justify-content:flex-start;
  }

  .platform-section-head{
    margin-bottom:1rem;
  }

  .platform-section-head h2,
  .platform-decisions-rail h2{
    margin:0.45rem 0 0;
    font-family:'Playfair Display', Georgia, serif;
    font-size:clamp(1.4rem, 2.6vw, 2.2rem);
    line-height:1.05;
  }

  .platform-chip-grid,
  .platform-pill-row{
    display:flex;
    gap:0.7rem;
    flex-wrap:wrap;
  }

  .platform-chip,
  .platform-pill{
    border-radius:999px;
    border:1px solid rgba(201,168,76,0.24);
    background:transparent;
    color:var(--muted);
    padding:0.8rem 1rem;
    text-transform:uppercase;
    letter-spacing:0.13em;
    font-size:0.7rem;
    cursor:pointer;
  }

  .platform-chip--active,
  .platform-pill--active{
    background:var(--gold);
    color:#0A0A0A;
    border-color:var(--gold);
  }

  .platform-field,
  .platform-control-block{
    display:grid;
    gap:0.65rem;
    margin-top:1.1rem;
  }

  .platform-field span,
  .platform-field-label{
    color:var(--text);
    font-size:0.76rem;
    letter-spacing:0.18em;
    text-transform:uppercase;
  }

  .platform-input,
  .platform-textarea{
    width:100%;
    border-radius:20px;
    border:1px solid rgba(201,168,76,0.18);
    background:var(--panel-2);
    color:var(--text);
    font:inherit;
    padding:1rem 1.1rem;
  }

  .platform-textarea--hero{
    min-height:160px;
  }

  .platform-input:focus,
  .platform-textarea:focus,
  .platform-reference-card:focus-visible,
  .platform-color-card input:focus-visible,
  .platform-pill:focus-visible,
  .platform-chip:focus-visible,
  .platform-primary-btn:focus-visible,
  .platform-secondary-btn:focus-visible,
  .platform-text-link:focus-visible{
    outline:2px solid var(--gold);
    outline-offset:2px;
  }

  .platform-helper{
    color:var(--muted-2);
    font-size:0.9rem;
    line-height:1.7;
  }

  .platform-reference-grid{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:0.85rem;
  }

  .platform-reference-card{
    border:1px solid rgba(201,168,76,0.16);
    border-radius:20px;
    background:rgba(255,255,255,0.02);
    padding:1rem;
    text-align:left;
    color:var(--text);
    cursor:pointer;
    display:grid;
    gap:0.45rem;
  }

  .platform-reference-card strong{
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.05rem;
    font-weight:700;
  }

  .platform-reference-card span{
    color:var(--muted);
    font-size:0.92rem;
    line-height:1.6;
  }

  .platform-reference-card--active{
    border-color:var(--gold);
    background:rgba(201,168,76,0.08);
  }

  .platform-slider-grid{
    display:grid;
    gap:0.9rem;
  }

  .platform-slider{
    display:grid;
    gap:0.55rem;
    padding:1rem;
    border:1px solid rgba(201,168,76,0.12);
    border-radius:20px;
    background:rgba(255,255,255,0.02);
  }

  .platform-slider-head{
    display:flex;
    justify-content:space-between;
    gap:0.8rem;
    color:var(--text);
  }

  .platform-slider span:last-child{
    color:var(--muted);
    font-size:0.92rem;
    line-height:1.65;
  }

  .platform-slider input{
    accent-color:var(--gold);
  }

  .platform-color-grid{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:0.85rem;
  }

  .platform-color-card{
    display:grid;
    gap:0.7rem;
    border:1px solid rgba(201,168,76,0.12);
    border-radius:20px;
    padding:1rem;
    background:rgba(255,255,255,0.02);
  }

  .platform-color-card input{
    width:100%;
    min-height:54px;
    border:none;
    background:none;
  }

  .platform-color-card span{
    text-transform:uppercase;
    letter-spacing:0.16em;
    font-size:0.7rem;
    color:var(--muted);
  }

  .platform-color-card code{
    color:var(--gold);
    font-size:0.92rem;
  }

  .platform-build-card{
    display:grid;
    gap:0.75rem;
    padding:1rem 0 3rem;
    justify-items:start;
  }

  .platform-chat{
    display:grid;
    gap:0.9rem;
  }

  .platform-chat-messages{
    display:grid;
    gap:0.7rem;
    max-height:360px;
    overflow:auto;
    padding-right:0.25rem;
  }

  .platform-chat-bubble{
    max-width:min(720px, 100%);
    padding:0.95rem 1rem;
    border-radius:18px;
    line-height:1.7;
  }

  .platform-chat-bubble--ai{
    color:var(--gold);
    background:rgba(201,168,76,0.07);
  }

  .platform-chat-bubble--user{
    justify-self:end;
    background:rgba(255,255,255,0.06);
  }

  .platform-chat-typing{
    color:var(--gold);
    letter-spacing:0.3em;
  }

  .platform-chat-input-row,
  .platform-revision-row{
    display:grid;
    gap:0.9rem;
  }

  .platform-agent-panel{
    position:sticky;
    top:5.8rem;
    padding:1.25rem;
  }

  .platform-agent-list{
    list-style:none;
    display:grid;
    gap:0.75rem;
    margin:1.2rem 0 0;
    padding:0;
  }

  .platform-agent-row{
    display:grid;
    grid-template-columns:18px minmax(0, 1fr) auto;
    gap:0.75rem;
    align-items:start;
    padding:0.9rem;
    border-radius:18px;
    background:rgba(255,255,255,0.03);
    border:1px solid transparent;
  }

  .platform-agent-row--working{
    background:rgba(201,168,76,0.08);
    border-color:rgba(201,168,76,0.22);
  }

  .platform-agent-row--failed{
    border-color:rgba(227,114,114,0.22);
  }

  .platform-agent-dot{
    width:12px;
    height:12px;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:0.55rem;
    line-height:1;
    color:#0A0A0A;
    margin-top:0.2rem;
  }

  .platform-agent-dot--waiting{background:rgba(250,247,242,0.22)}
  .platform-agent-dot--working{background:var(--gold)}
  .platform-agent-dot--done{background:#6EE7A6}
  .platform-agent-dot--failed{background:#E37272}

  .platform-agent-copy{
    display:grid;
    gap:0.16rem;
  }

  .platform-agent-label{
    color:var(--text);
    font-size:0.94rem;
    font-weight:600;
  }

  .platform-agent-description,
  .platform-agent-recovery{
    color:var(--muted);
    font-size:0.78rem;
    line-height:1.55;
  }

  .platform-agent-recovery{
    color:var(--danger);
    text-transform:uppercase;
    letter-spacing:0.14em;
  }

  .platform-agent-state{
    font-size:0.62rem;
    text-transform:uppercase;
    letter-spacing:0.18em;
    color:var(--muted-2);
    padding-top:0.22rem;
  }

  .platform-agent-state--working{color:var(--gold)}
  .platform-agent-state--done{color:#6EE7A6}
  .platform-agent-state--failed{color:var(--danger)}

  .platform-generate-main{
    display:grid;
    gap:1rem;
  }

  .platform-toolbar{
    display:grid;
    gap:0.9rem;
    padding:1rem 1.15rem;
    border:1px solid var(--line);
    border-radius:24px;
    background:rgba(255,255,255,0.02);
  }

  .platform-toolbar-stats{
    display:grid;
    grid-template-columns:repeat(4, minmax(0, 1fr));
    gap:0.8rem;
  }

  .platform-toolbar-stats div{
    display:grid;
    gap:0.25rem;
    padding:0.85rem 0.95rem;
    border-radius:18px;
    background:rgba(255,255,255,0.03);
  }

  .platform-toolbar-stats span{
    color:var(--muted-2);
    font-size:0.66rem;
    text-transform:uppercase;
    letter-spacing:0.18em;
  }

  .platform-toolbar-stats strong{
    color:var(--text);
    font-size:0.92rem;
    text-transform:capitalize;
  }

  .platform-toolbar-actions{
    display:flex;
    gap:0.7rem;
    flex-wrap:wrap;
    align-items:center;
  }

  .platform-pill-row--compact{
    gap:0.4rem;
  }

  .platform-loading-stage,
  .platform-empty{
    display:grid;
    justify-items:start;
    gap:0.7rem;
    padding:2rem;
    border:1px dashed rgba(201,168,76,0.2);
    border-radius:24px;
    background:rgba(255,255,255,0.02);
  }

  .platform-empty--full{
    width:min(720px, calc(100% - 2rem));
    margin:6rem auto;
  }

  .platform-empty h2,
  .platform-empty h3{
    margin:0;
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.6rem;
  }

  .platform-loading-orb{
    width:44px;
    height:44px;
    border-radius:50%;
    background:var(--gold);
    box-shadow:0 0 40px rgba(201,168,76,0.45);
  }

  .platform-preview-single,
  .platform-preview-grid{
    display:grid;
    gap:1rem;
  }

  .platform-preview-grid{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }

  .platform-preview-grid--mobile{
    max-width:900px;
  }

  .platform-preview-panel,
  .platform-preview-single{
    border:1px solid var(--line);
    border-radius:24px;
    overflow:hidden;
    background:#050505;
  }

  .platform-preview-label{
    display:block;
    padding:0.8rem 1rem;
    border-bottom:1px solid var(--line);
    color:var(--gold);
    font-size:0.68rem;
    text-transform:uppercase;
    letter-spacing:0.18em;
  }

  .platform-preview-frame{
    width:100%;
    min-height:720px;
    border:none;
    background:white;
  }

  .platform-preview-single--mobile,
  .platform-preview-grid--mobile .platform-preview-panel{
    max-width:430px;
  }

  .platform-desktop-preview{
    display:grid;
    grid-template-columns:minmax(0,1fr) 280px;
    gap:1rem;
    padding:1rem;
  }

  .platform-mobile-card{
    display:grid;
    gap:0.65rem;
    padding:1rem;
    border:1px solid var(--line);
    border-radius:22px;
    background:rgba(255,255,255,0.03);
    align-content:start;
  }

  .platform-preview-frame--phone{
    min-height:560px;
    border-radius:22px;
    overflow:hidden;
  }

  .platform-review-actions{
    display:flex;
    gap:0.8rem;
    flex-wrap:wrap;
    align-items:center;
  }

  .platform-history-grid{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:1rem;
  }

  .platform-history-list,
  .platform-summary-list{
    display:grid;
    gap:0.8rem;
  }

  .platform-history-item{
    display:grid;
    gap:0.3rem;
    padding:0.95rem 1rem;
    border-radius:18px;
    border:1px solid rgba(201,168,76,0.12);
    background:rgba(255,255,255,0.02);
  }

  .platform-history-item strong,
  .platform-summary-list strong{
    color:var(--text);
    font-size:0.95rem;
  }

  .platform-section-card--error{
    border-color:rgba(227,114,114,0.24);
  }

  .platform-decisions-rail{
    position:sticky;
    top:5.8rem;
    padding:1rem;
    overflow:hidden;
  }

  .platform-decisions-rail--collapsed{
    padding:0.5rem;
  }

  .platform-rail-head{
    display:flex;
    justify-content:space-between;
    gap:0.8rem;
    align-items:flex-start;
  }

  .platform-rail-toggle{
    width:36px;
    border-radius:12px;
    border:1px solid var(--line);
    background:transparent;
    color:var(--gold);
    cursor:pointer;
  }

  .platform-rail-body{
    display:grid;
    gap:0.75rem;
    margin-top:1rem;
  }

  .platform-rail-card{
    display:grid;
    gap:0.35rem;
    padding:0.9rem;
    border-radius:18px;
    border:1px solid rgba(201,168,76,0.12);
    background:rgba(255,255,255,0.03);
  }

  .platform-rail-card strong{
    font-size:0.98rem;
    line-height:1.4;
  }

  .platform-rail-label{
    color:var(--gold);
    font-size:0.66rem;
    letter-spacing:0.18em;
    text-transform:uppercase;
  }

  .platform-rail-agent{
    color:var(--gold);
    font-size:0.7rem;
    letter-spacing:0.14em;
    text-transform:uppercase;
  }

  .platform-score-row{
    display:flex;
    justify-content:space-between;
    gap:0.6rem;
    color:var(--muted);
    font-size:0.85rem;
    border-top:1px solid rgba(201,168,76,0.08);
    padding-top:0.55rem;
    margin-top:0.25rem;
  }

  .platform-recent-card{
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:flex-start;
    padding:1rem 1.1rem;
    border-radius:22px;
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(201,168,76,0.14);
  }

  .platform-recent-card strong{
    display:block;
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.25rem;
    margin-bottom:0.35rem;
  }

  .platform-recent-card span{
    color:var(--muted-2);
    font-size:0.84rem;
  }

  @media (max-width: 1200px){
    .platform-page--generate,
    .platform-page--generate.platform-page--rail-collapsed{
      grid-template-columns:1fr;
    }

    .platform-agent-panel,
    .platform-decisions-rail{
      position:static;
    }

    .platform-decisions-rail--collapsed{
      padding:1rem;
    }

    .platform-desktop-preview{
      grid-template-columns:1fr;
    }
  }

  @media (max-width: 900px){
    .platform-preview-grid,
    .platform-history-grid,
    .platform-color-grid,
    .platform-reference-grid{
      grid-template-columns:1fr;
    }

    .platform-toolbar-stats{
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }

    .platform-page{
      width:min(100%, calc(100% - 1rem));
    }
  }

  @media (max-width: 640px){
    .platform-nav{
      align-items:flex-start;
      flex-direction:column;
    }

    .platform-nav-links{
      width:100%;
    }

    .platform-nav-links a{
      flex:1;
      justify-content:center;
    }

    .platform-toolbar-stats{
      grid-template-columns:1fr;
    }

    .platform-toolbar-actions{
      flex-direction:column;
      align-items:stretch;
    }

    .platform-toolbar-actions > *{
      width:100%;
    }

    .platform-build-card{
      justify-items:stretch;
    }

    .platform-review-actions{
      flex-direction:column;
      align-items:stretch;
    }
  }
`
