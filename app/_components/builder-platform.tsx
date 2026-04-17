'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChangeEvent, Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react'
import { PRESET_PLACEHOLDERS } from '@/lib/constants/presetPlaceholders'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  getCurrentEditorContext,
  diffEditorState,
  logEdits,
  logPublish,
  type EditorContext,
} from '@/lib/persistence'
import { emitPersistenceStatus, usePersistenceStatus } from '@/lib/persistence/status'

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

interface CloneAnalysis {
  sections: string[]
  style: string
  pacing: string
  colorMood: string
  typographyStyle: string
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
  cloneUrl: string
  cloneAnalysis: CloneAnalysis | null
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
const MAIN_CONTENT_ID = 'main-content'

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
    cloneUrl: '',
    cloneAnalysis: null,
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

function resolveBriefExcerpt(brief: BriefState | null) {
  if (!brief) return 'No saved vision yet.'
  const source = brief.briefInput.trim() || brief.vibeText.trim() || brief.answers[1]?.trim() || ''
  return source ? `${source.slice(0, 60)}${source.length > 60 ? '…' : ''}` : 'No saved vision yet.'
}

function summarizeCloneAnalysis(cloneAnalysis: CloneAnalysis) {
  return `Found: ${cloneAnalysis.sections.length} sections — ${cloneAnalysis.sections.join(', ')}. Style: ${cloneAnalysis.style}, ${cloneAnalysis.colorMood}, ${cloneAnalysis.typographyStyle}. Pacing: ${cloneAnalysis.pacing}.`
}

function buildCloneContext(brief: BriefState) {
  if (!brief.cloneAnalysis) return ''
  const summary = summarizeCloneAnalysis(brief.cloneAnalysis)
  const source = brief.cloneUrl.trim() ? `Reference URL: ${brief.cloneUrl.trim()}.` : ''
  return [source, 'Use this as structural and tonal guidance for the page, but express it with my brand.', summary]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function buildRawBriefInput(brief: BriefState) {
  const parts = [brief.briefInput.trim(), buildCloneContext(brief)].filter(Boolean)
  return parts.join('\n\n').slice(0, 1900)
}

function hasBriefContent(brief: BriefState): boolean {
  return Boolean(
    buildRawBriefInput(brief) ||
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

interface EditableTextItem {
  id: string
  tagName: string
  label: string
  text: string
  isAction: boolean
  kind: 'headline' | 'subheadline' | 'cta' | 'heading' | 'body'
  sectionId: string
  sectionLabel: string
  baseStyle: EditableTextStyle
}

interface EditableImageItem {
  id: string
  label: string
  src: string
  alt: string
  sectionId: string
  sectionLabel: string
  baseStyle: EditableImageStyle
}

interface EditableSectionItem {
  id: string
  label: string
  tagName: string
  baseStyle: EditableSectionStyle
}

interface EditableDocumentModel {
  annotatedHtml: string
  frameHtml: string
  textItems: EditableTextItem[]
  imageItems: EditableImageItem[]
  sectionItems: EditableSectionItem[]
}

interface EditableTextStyle {
  [key: string]: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  color: string
  textAlign: string
  textTransform: string
  backgroundColor: string
  borderColor: string
  borderRadius: string
  paddingInline: string
  paddingBlock: string
  boxShadow: string
}

interface EditableImageStyle {
  objectFit: 'cover' | 'contain' | 'fill'
  objectPosition: 'top' | 'center' | 'bottom'
  borderRadius: string
  alt: string
}

interface EditableSectionStyle {
  paddingTop: string
  paddingBottom: string
  backgroundColor: string
  backgroundImage: string
  overlayOpacity: string
  maxWidthMode: 'full' | 'constrained'
  hidden: boolean
}

const DEFAULT_TEXT_STYLE: EditableTextStyle = {
  fontFamily: '',
  fontSize: '',
  fontWeight: '',
  lineHeight: '',
  letterSpacing: '',
  color: '',
  textAlign: '',
  textTransform: '',
  backgroundColor: '',
  borderColor: '',
  borderRadius: '',
  paddingInline: '',
  paddingBlock: '',
  boxShadow: '',
}

const DEFAULT_IMAGE_STYLE: EditableImageStyle = {
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: '0px',
  alt: '',
}

const DEFAULT_SECTION_STYLE: EditableSectionStyle = {
  paddingTop: '',
  paddingBottom: '',
  backgroundColor: '',
  backgroundImage: '',
  overlayOpacity: '0.25',
  maxWidthMode: 'full',
  hidden: false,
}

const FONT_FAMILY_OPTIONS = [
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Syne', sans-serif", label: 'Syne' },
  { value: "system-ui, sans-serif", label: 'System Sans' },
] as const

type InspectorTab = 'content' | 'style' | 'layout'
type GenerateWorkbenchTab = 'revise' | 'history' | 'changes' | 'errors'
type DecisionsRailTab = 'blueprint' | 'critique' | 'decisions'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceColorTokens(input: string, fromColor: string, toColor: string) {
  if (!fromColor || !toColor || fromColor.toLowerCase() === toColor.toLowerCase()) return input
  return input.replace(new RegExp(escapeRegExp(fromColor), 'gi'), toColor)
}

function labelTextElement(tagName: string, index: number, text: string) {
  if (tagName === 'h1') return 'Headline'
  if (tagName === 'p' && index === 0) return 'Subheadline'
  if (tagName === 'button' || (tagName === 'a' && text.length <= 32)) return `CTA ${index + 1}`
  if (tagName === 'h2' || tagName === 'h3') return `Section Heading ${index + 1}`
  return `Body Copy ${index + 1}`
}

function classifyTextElement(tagName: string, index: number, text: string): EditableTextItem['kind'] {
  if (tagName === 'h1') return 'headline'
  if (tagName === 'p' && index === 0) return 'subheadline'
  if (tagName === 'button' || (tagName === 'a' && text.length <= 32)) return 'cta'
  if (tagName === 'h2' || tagName === 'h3') return 'heading'
  return 'body'
}

function isActionElement(tagName: string, text: string) {
  return tagName === 'button' || (tagName === 'a' && text.length <= 32)
}

function humanizeSectionTag(tagName: string) {
  switch (tagName) {
    case 'header':
      return 'Hero'
    case 'main':
      return 'Main'
    case 'footer':
      return 'Footer'
    case 'nav':
      return 'Navigation'
    case 'section':
      return 'Section'
    case 'article':
      return 'Story Block'
    default:
      return 'Canvas'
  }
}

function buildSectionMeta(doc: Document) {
  const sectionMap = new Map<Element, { id: string; label: string }>()
  const counters = new Map<string, number>()
  const candidates = Array.from(doc.querySelectorAll('header, main, section, article, footer, nav'))

  candidates.forEach(node => {
    const tagName = node.tagName.toLowerCase()
    const nextCount = (counters.get(tagName) || 0) + 1
    counters.set(tagName, nextCount)
    const baseLabel = humanizeSectionTag(tagName)
    const label = tagName === 'section' || tagName === 'article'
      ? `${baseLabel} ${nextCount}`
      : nextCount > 1 ? `${baseLabel} ${nextCount}` : baseLabel
    node.setAttribute('data-irie-section-id', `${tagName}-${nextCount}`)
    sectionMap.set(node, {
      id: `${tagName}-${nextCount}`,
      label,
    })
  })

  return sectionMap
}

function resolveSectionMeta(
  element: Element,
  sectionMap: Map<Element, { id: string; label: string }>,
) {
  const ancestor = element.closest('header, main, section, article, footer, nav')
  if (!ancestor) {
    return { id: 'canvas-1', label: 'Canvas' }
  }
  return sectionMap.get(ancestor) || { id: 'canvas-1', label: 'Canvas' }
}

function rgbChannelToHex(channel: string) {
  const value = Number.parseInt(channel, 10)
  if (Number.isNaN(value)) return '00'
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
}

function toHexColor(value: string) {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.startsWith('#')) {
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toUpperCase()
    }
    return normalized.toUpperCase()
  }
  const match = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return ''
  return `#${rgbChannelToHex(match[1])}${rgbChannelToHex(match[2])}${rgbChannelToHex(match[3])}`.toUpperCase()
}

function normalizeFontFamily(value: string) {
  if (value.includes('Playfair Display')) return "'Playfair Display', serif"
  if (value.includes('Syne')) return "'Syne', sans-serif"
  if (value.includes('system-ui')) return 'system-ui, sans-serif'
  return value
}

function normalizeComputedTextStyle(style: CSSStyleDeclaration): EditableTextStyle {
  return {
    fontFamily: normalizeFontFamily(style.fontFamily || ''),
    fontSize: style.fontSize || '',
    fontWeight: style.fontWeight || '',
    lineHeight: style.lineHeight === 'normal' ? '' : style.lineHeight || '',
    letterSpacing: style.letterSpacing === 'normal' ? '' : style.letterSpacing || '',
    color: toHexColor(style.color),
    textAlign: style.textAlign || '',
    textTransform: style.textTransform || '',
    backgroundColor: toHexColor(style.backgroundColor),
    borderColor: toHexColor(style.borderColor),
    borderRadius: style.borderRadius || '',
    paddingInline: style.paddingLeft === style.paddingRight ? style.paddingLeft || '' : '',
    paddingBlock: style.paddingTop === style.paddingBottom ? style.paddingTop || '' : '',
    boxShadow: style.boxShadow === 'none' ? '' : style.boxShadow || '',
  }
}

function normalizeComputedImageStyle(node: HTMLImageElement, style: CSSStyleDeclaration): EditableImageStyle {
  const objectPosition = style.objectPosition.includes('top')
    ? 'top'
    : style.objectPosition.includes('bottom')
      ? 'bottom'
      : 'center'

  return {
    objectFit: (style.objectFit as EditableImageStyle['objectFit']) || 'cover',
    objectPosition,
    borderRadius: style.borderRadius || '0px',
    alt: node.alt || '',
  }
}

function normalizeComputedSectionStyle(node: HTMLElement, style: CSSStyleDeclaration): EditableSectionStyle {
  return {
    paddingTop: style.paddingTop || '',
    paddingBottom: style.paddingBottom || '',
    backgroundColor: toHexColor(style.backgroundColor),
    backgroundImage: style.backgroundImage && style.backgroundImage !== 'none'
      ? style.backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
      : '',
    overlayOpacity: node.dataset.irieSectionOverlay || DEFAULT_SECTION_STYLE.overlayOpacity,
    maxWidthMode: node.dataset.irieSectionMaxWidth === 'constrained' ? 'constrained' : 'full',
    hidden: node.dataset.irieSectionHidden === 'true',
  }
}

function extractEditableTextStyles(doc: Document): Record<string, EditableTextStyle> {
  const next: Record<string, EditableTextStyle> = {}
  doc.querySelectorAll('[data-irie-edit-id]').forEach(node => {
    const id = node.getAttribute('data-irie-edit-id')
    if (!id || !(node instanceof HTMLElement)) return
    next[id] = normalizeComputedTextStyle(window.getComputedStyle(node))
  })
  return next
}

function extractEditableImageStyles(doc: Document): Record<string, EditableImageStyle> {
  const next: Record<string, EditableImageStyle> = {}
  doc.querySelectorAll('[data-irie-image-id]').forEach(node => {
    const id = node.getAttribute('data-irie-image-id')
    if (!id || !(node instanceof HTMLImageElement)) return
    next[id] = normalizeComputedImageStyle(node, window.getComputedStyle(node))
  })
  return next
}

function extractEditableSectionStyles(doc: Document): Record<string, EditableSectionStyle> {
  const next: Record<string, EditableSectionStyle> = {}
  doc.querySelectorAll('[data-irie-section-id]').forEach(node => {
    const id = node.getAttribute('data-irie-section-id')
    if (!id || !(node instanceof HTMLElement)) return
    next[id] = normalizeComputedSectionStyle(node, window.getComputedStyle(node))
  })
  return next
}

function applyTextStyleToElement(node: Element, style: EditableTextStyle) {
  if (!(node instanceof HTMLElement)) return
  node.style.fontFamily = style.fontFamily || ''
  node.style.fontSize = style.fontSize || ''
  node.style.fontWeight = style.fontWeight || ''
  node.style.lineHeight = style.lineHeight || ''
  node.style.letterSpacing = style.letterSpacing || ''
  node.style.color = style.color || ''
  node.style.textAlign = style.textAlign || ''
  node.style.textTransform = style.textTransform || ''
  node.style.backgroundColor = style.backgroundColor || ''
  node.style.borderColor = style.borderColor || ''
  node.style.borderRadius = style.borderRadius || ''
  node.style.paddingInline = style.paddingInline || ''
  node.style.paddingBlock = style.paddingBlock || ''
  node.style.boxShadow = style.boxShadow || ''
}

function applyImageStyleToElement(node: Element, style: EditableImageStyle) {
  if (!(node instanceof HTMLImageElement)) return
  node.style.objectFit = style.objectFit || DEFAULT_IMAGE_STYLE.objectFit
  node.style.objectPosition = style.objectPosition || DEFAULT_IMAGE_STYLE.objectPosition
  node.style.borderRadius = style.borderRadius || ''
  node.alt = style.alt || ''
}

function buildSectionBackground(style: EditableSectionStyle) {
  if (!style.backgroundImage) return ''
  const opacity = Number.parseFloat(style.overlayOpacity || DEFAULT_SECTION_STYLE.overlayOpacity)
  const safeOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0.25
  return `linear-gradient(rgba(8, 8, 8, ${safeOpacity}), rgba(8, 8, 8, ${safeOpacity})), url("${style.backgroundImage}")`
}

function applySectionStyleToElement(node: Element, style: EditableSectionStyle) {
  if (!(node instanceof HTMLElement)) return
  node.style.paddingTop = style.paddingTop || ''
  node.style.paddingBottom = style.paddingBottom || ''
  node.style.backgroundColor = style.backgroundColor || ''
  const background = buildSectionBackground(style)
  node.style.backgroundImage = background || ''
  node.style.backgroundSize = background ? 'cover' : ''
  node.style.backgroundPosition = background ? 'center' : ''
  node.style.maxWidth = style.maxWidthMode === 'constrained' ? '1200px' : ''
  node.style.marginInline = style.maxWidthMode === 'constrained' ? 'auto' : ''
  node.style.display = style.hidden ? 'none' : ''
  node.dataset.irieSectionOverlay = style.overlayOpacity || DEFAULT_SECTION_STYLE.overlayOpacity
  node.dataset.irieSectionMaxWidth = style.maxWidthMode
  node.dataset.irieSectionHidden = style.hidden ? 'true' : 'false'
}

function groupTextItemsBySection(items: EditableTextItem[]) {
  const grouped = new Map<string, { id: string; label: string; items: EditableTextItem[] }>()
  items.forEach(item => {
    const existing = grouped.get(item.sectionId)
    if (existing) {
      existing.items.push(item)
      return
    }
    grouped.set(item.sectionId, {
      id: item.sectionId,
      label: item.sectionLabel,
      items: [item],
    })
  })
  return Array.from(grouped.values())
}

function groupImageItemsBySection(items: EditableImageItem[]) {
  const grouped = new Map<string, { id: string; label: string; items: EditableImageItem[] }>()
  items.forEach(item => {
    const existing = grouped.get(item.sectionId)
    if (existing) {
      existing.items.push(item)
      return
    }
    grouped.set(item.sectionId, {
      id: item.sectionId,
      label: item.sectionLabel,
      items: [item],
    })
  })
  return Array.from(grouped.values())
}

function getAvailableInspectorTabs(selection: {
  selectedTextItem: EditableTextItem | null
  selectedImageItem: EditableImageItem | null
  selectedSectionItem: EditableSectionItem | null
}): InspectorTab[] {
  if (selection.selectedSectionItem) return ['content', 'style', 'layout']
  if (selection.selectedImageItem) return ['content', 'style']
  if (selection.selectedTextItem?.isAction) return ['content', 'style', 'layout']
  if (selection.selectedTextItem) return ['content', 'style']
  return ['content']
}

function buildEditableDocumentModel(html: string): EditableDocumentModel {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const textItems: EditableTextItem[] = []
  const imageItems: EditableImageItem[] = []
  const sectionItems: EditableSectionItem[] = []
  const sectionMap = buildSectionMeta(doc)

  sectionMap.forEach((section, node) => {
    sectionItems.push({
      id: section.id,
      label: section.label,
      tagName: node.tagName.toLowerCase(),
      baseStyle: DEFAULT_SECTION_STYLE,
    })
  })

  Array.from(doc.querySelectorAll('h1, h2, h3, p, button, a')).forEach((element, index) => {
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) return
    const id = `text-${index + 1}`
    const tagName = element.tagName.toLowerCase()
    const kind = classifyTextElement(tagName, index, text)
    const section = resolveSectionMeta(element, sectionMap)
    element.setAttribute('data-irie-edit-id', id)
    element.setAttribute('data-irie-editable', 'text')
    textItems.push({
      id,
      tagName,
      label: labelTextElement(tagName, index, text),
      text,
      isAction: isActionElement(tagName, text),
      kind,
      sectionId: section.id,
      sectionLabel: section.label,
      baseStyle: DEFAULT_TEXT_STYLE,
    })
  })

  Array.from(doc.querySelectorAll('img')).forEach((element, index) => {
    const id = `image-${index + 1}`
    const section = resolveSectionMeta(element, sectionMap)
    element.setAttribute('data-irie-image-id', id)
    imageItems.push({
      id,
      label: `Image ${index + 1}`,
      src: element.getAttribute('src') || '',
      alt: element.getAttribute('alt') || '',
      sectionId: section.id,
      sectionLabel: section.label,
      baseStyle: {
        ...DEFAULT_IMAGE_STYLE,
        alt: element.getAttribute('alt') || '',
      },
    })
  })

  const annotatedHtml = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`

  const style = doc.createElement('style')
  style.id = 'irie-editor-style'
  style.textContent = `
    [data-irie-editable="text"], [data-irie-image-id] { cursor: pointer; }
    .is-irie-editor-selected { outline: 2px solid #C9A84C !important; outline-offset: 6px !important; }
  `
  doc.head.appendChild(style)

  return {
    annotatedHtml,
    frameHtml: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`,
    textItems,
    imageItems,
    sectionItems,
  }
}

function buildEditedHtml(
  annotatedHtml: string,
  textValues: Record<string, string>,
  textStyles: Record<string, EditableTextStyle>,
  imageValues: Record<string, string>,
  imageStyles: Record<string, EditableImageStyle>,
  sectionStyles: Record<string, EditableSectionStyle>,
  sourceAccent: string,
  accentOverride: string,
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(annotatedHtml, 'text/html')

  Object.entries(textValues).forEach(([id, value]) => {
    const node = doc.querySelector(`[data-irie-edit-id="${id}"]`)
    if (node) node.textContent = value
  })

  Object.entries(textStyles).forEach(([id, style]) => {
    const node = doc.querySelector(`[data-irie-edit-id="${id}"]`)
    if (node) applyTextStyleToElement(node, style)
  })

  Object.entries(imageValues).forEach(([id, value]) => {
    const node = doc.querySelector(`[data-irie-image-id="${id}"]`)
    if (node instanceof HTMLImageElement && value) node.src = value
  })

  Object.entries(imageStyles).forEach(([id, style]) => {
    const node = doc.querySelector(`[data-irie-image-id="${id}"]`)
    if (node) applyImageStyleToElement(node, style)
  })

  Object.entries(sectionStyles).forEach(([id, style]) => {
    const node = doc.querySelector(`[data-irie-section-id="${id}"]`)
    if (node) applySectionStyleToElement(node, style)
  })

  doc.querySelectorAll('[data-irie-edit-id], [data-irie-editable], [data-irie-image-id], [data-irie-section-id], [contenteditable]').forEach(node => {
    node.removeAttribute('data-irie-edit-id')
    node.removeAttribute('data-irie-editable')
    node.removeAttribute('data-irie-image-id')
    node.removeAttribute('data-irie-section-id')
    node.removeAttribute('contenteditable')
  })

  let html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
  return replaceColorTokens(html, sourceAccent, accentOverride)
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
  return <iframe title={title} className={className} sandbox="allow-same-origin" srcDoc={html || ''} />
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

function PlatformNav({
  current,
  action,
}: {
  current: 'dashboard' | 'brief' | 'generate' | 'edit' | 'publish'
  action?: ReactNode
}) {
  const persistence = usePersistenceStatus()
  return (
    <header className="platform-nav">
      <Link href="/dashboard" className="platform-wordmark">IrieBuilder</Link>
      <div className="platform-nav-right">
        <nav className="platform-nav-links" aria-label="Platform">
          <Link href="/dashboard" className={current === 'dashboard' ? 'is-active' : ''}>Projects</Link>
        </nav>
        <PersistenceBadge status={persistence.status} message={persistence.message} />
        {action ? <div className="platform-nav-action">{action}</div> : null}
      </div>
    </header>
  )
}

const FLOW_STEPS = [
  { key: 'brief', label: 'Brief', href: '/brief' },
  { key: 'generate', label: 'Generate', href: '/generate' },
  { key: 'edit', label: 'Edit', href: '/edit' },
  { key: 'publish', label: 'Export', href: '/publish' },
] as const

function FlowIndicator({ current }: { current: 'brief' | 'generate' | 'edit' | 'publish' }) {
  return (
    <nav className="platform-flow-indicator" aria-label="Build flow">
      <div className="platform-flow-tablist" role="tablist" aria-label="Build flow steps">
        {FLOW_STEPS.map((step, index) => (
          <span key={step.key} className="platform-flow-step-wrap">
          <Link
            href={step.href}
            className={`platform-flow-step ${step.key === current ? 'is-active' : ''}`}
            role="tab"
            aria-selected={step.key === current}
            aria-controls={MAIN_CONTENT_ID}
            aria-label={`${step.label} step`}
            aria-current={step.key === current ? 'step' : undefined}
          >
            <span>{step.label}</span>
          </Link>
          {index < FLOW_STEPS.length - 1 && <span className="platform-flow-separator">→</span>}
          </span>
        ))}
      </div>
    </nav>
  )
}

function FlowHeader({
  current,
  backHref,
  backLabel,
  right,
}: {
  current: 'brief' | 'generate' | 'edit' | 'publish'
  backHref: string
  backLabel: string
  right?: ReactNode
}) {
  const persistence = usePersistenceStatus()
  return (
    <header className="platform-flow-header">
      <Link href={backHref} className="platform-text-link">{backLabel}</Link>
      <FlowIndicator current={current} />
      <div className="platform-flow-header-actions">
        <PersistenceBadge status={persistence.status} message={persistence.message} />
        {right}
      </div>
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
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function PersistenceBadge({
  status,
  message,
}: {
  status: ReturnType<typeof usePersistenceStatus>['status']
  message?: string
}) {
  const label = message || (
    status === 'saving'
      ? 'Saving…'
      : status === 'unsaved'
        ? 'Unsaved changes'
        : status === 'offline'
          ? 'Offline — local only'
          : status === 'local-only'
            ? 'Local-only mode'
            : status === 'error'
              ? 'Sync issue — local only'
              : status === 'booting'
                ? 'Connecting…'
                : 'Saved'
  )

  return (
    <div
      className={`platform-status-chip platform-status-chip--${status}`}
      aria-live="polite"
    >
      {label}
    </div>
  )
}

function FullscreenPreviewOverlay({
  html,
  title,
  onClose,
}: {
  html: string
  title: string
  onClose: () => void
}) {
  return (
    <div className="platform-fullscreen-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="platform-fullscreen-bar">
        <strong>{title}</strong>
        <button type="button" className="platform-secondary-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <iframe
        title={title}
        className="platform-fullscreen-frame"
        sandbox="allow-same-origin"
        srcDoc={html}
      />
    </div>
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

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function AccordionCard({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`platform-accordion ${open ? 'is-open' : ''}`}>
      <button type="button" className="platform-accordion-toggle" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span className="platform-accordion-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open ? <div className="platform-accordion-body">{children}</div> : null}
    </section>
  )
}

export function ProjectsHomePage() {
  const [lastGeneration, setLastGeneration] = useState<GenerationSnapshot | null>(null)
  const [savedBrief, setSavedBrief] = useState<BriefState | null>(null)

  useEffect(() => {
    const sync = () => {
      setLastGeneration(readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null))
      setSavedBrief(readStorage<BriefState | null>(BRIEF_STORAGE_KEY, null))
    }

    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(STORAGE_EVENT_NAME, sync as EventListener)

    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(STORAGE_EVENT_NAME, sync as EventListener)
    }
  }, [])

  const projectCards = lastGeneration ? [{
    id: 'current-project',
    title: lastGeneration.blueprint?.brandCore?.brandName || 'Current Project',
    status: 'Draft',
    updatedAt: lastGeneration.createdAt,
    summary: resolveBriefExcerpt(savedBrief),
    html: lastGeneration.html,
  }] : []

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <PlatformNav
          current="dashboard"
          action={<Link href="/brief" className="platform-primary-btn platform-primary-btn--nav">New Project +</Link>}
        />
        <main id={MAIN_CONTENT_ID} className="platform-page platform-page--dashboard">
          <section className="platform-dashboard-hero">
            <div className="platform-section-card">
              <span className="platform-kicker">Studio</span>
              <h1>Build faster. Keep the site in motion.</h1>
              <p>Start a new site, reopen a draft, or jump straight back into editing without hunting for the last pass.</p>
              <div className="platform-hero-actions">
                <Link href="/brief" className="platform-primary-btn">Start New Project</Link>
                {lastGeneration ? <Link href="/edit" className="platform-secondary-btn">Resume Editing</Link> : null}
              </div>
            </div>

            <div className="platform-dashboard-stats">
              <div className="platform-stat-card">
                <span>Projects</span>
                <strong>{projectCards.length || 0}</strong>
              </div>
              <div className="platform-stat-card">
                <span>Drafts</span>
                <strong>{projectCards.length || 0}</strong>
              </div>
              <div className="platform-stat-card">
                <span>Published</span>
                <strong>0</strong>
              </div>
            </div>
          </section>

          <section className="platform-section-card platform-section-card--recent">
            <div className="platform-section-head">
              <span className="platform-kicker">Recent projects</span>
              <h2>Pick up where you left off.</h2>
            </div>
            {projectCards.length ? (
              <div className="platform-project-grid platform-project-grid--cards">
                {projectCards.map(project => (
                  <article key={project.id} className="platform-project-card platform-project-card--studio">
                    <div className="platform-project-thumb">
                      <PreviewFrame
                        html={project.html}
                        title={`${project.title} preview`}
                        className="platform-preview-frame platform-preview-frame--thumb"
                      />
                    </div>
                    <div className="platform-project-copy">
                      <div className="platform-project-meta">
                        <strong>{project.title}</strong>
                        <span className="platform-status-chip platform-status-chip--saved">{project.status}</span>
                      </div>
                      <p>{project.summary}</p>
                      <span className="platform-helper">Last edited {new Date(project.updatedAt).toLocaleString()}</span>
                    </div>
                    <div className="platform-recent-actions">
                      <Link href="/edit" className="platform-primary-btn">Resume Editing</Link>
                      <Link href="/generate" className="platform-secondary-btn">Open Preview</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="platform-empty">
                <h3>Create your first site.</h3>
                <p>Brief it once, generate a direction, then refine it inside the editor.</p>
                <Link href="/brief" className="platform-primary-btn">Create Your First Site</Link>
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
  const [hasGeneration, setHasGeneration] = useState(false)
  const [cloneLoading, setCloneLoading] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState({
    direction: false,
    advanced: false,
  })
  const conversationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = readStorage<BriefState>(BRIEF_STORAGE_KEY, defaultBriefState())
    setBrief({ ...defaultBriefState(), ...saved })
    setHasGeneration(Boolean(readStorage(LAST_GENERATION_STORAGE_KEY, null)))
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

  useEffect(() => {
    const sync = () => setHasGeneration(Boolean(readStorage(LAST_GENERATION_STORAGE_KEY, null)))
    window.addEventListener('storage', sync)
    window.addEventListener(STORAGE_EVENT_NAME, sync as EventListener)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(STORAGE_EVENT_NAME, sync as EventListener)
    }
  }, [])

  function updateBrief<K extends keyof BriefState>(key: K, value: BriefState[K]) {
    setBrief(prev => ({ ...prev, [key]: value }))
  }

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
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

  function closeConversation() {
    setBrief(prev => ({ ...prev, chatExpanded: false }))
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
      chatExpanded: false,
      messages: [...messages, { role: 'ai', text: 'Preset loaded. Adjust the brief and hit Build It when you are ready.' }],
      answers: [...preset.answers],
      currentStep: CHAT_QUESTIONS.length,
      presetLabel: preset.label,
      inputValue: '',
      cloneAnalysis: prev.cloneAnalysis,
      cloneUrl: prev.cloneUrl,
    }))
  }

  function queueBuild() {
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

  function revealLookStage() {
    setOpenSections(prev => ({ ...prev, direction: true }))
  }

  async function analyzeCloneUrl() {
    const url = brief.cloneUrl.trim()
    if (!url) {
      setCloneError('Paste a URL first.')
      return
    }

    setCloneLoading(true)
    setCloneError(null)
    try {
      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = isObject(result) && typeof result.message === 'string' ? result.message : 'Analysis failed.'
        throw new Error(message)
      }
      if (
        !isObject(result) ||
        !Array.isArray(result.sections) ||
        typeof result.style !== 'string' ||
        typeof result.pacing !== 'string' ||
        typeof result.colorMood !== 'string' ||
        typeof result.typographyStyle !== 'string'
      ) {
        throw new Error('Analysis returned an unexpected shape.')
      }
      updateBrief('cloneAnalysis', {
        sections: result.sections.filter(section => typeof section === 'string') as string[],
        style: result.style,
        pacing: result.pacing,
        colorMood: result.colorMood,
        typographyStyle: result.typographyStyle,
      })
    } catch (error) {
      setCloneError(error instanceof Error ? error.message : 'Analysis failed.')
      updateBrief('cloneAnalysis', null)
    } finally {
      setCloneLoading(false)
    }
  }

  const canBuild = hasBriefContent(brief)

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <FlowHeader
          current="brief"
          backHref="/dashboard"
          backLabel="← Projects"
          right={hasGeneration ? <Link href="/generate" className="platform-text-link">Continue →</Link> : null}
        />
        <main id={MAIN_CONTENT_ID} className="platform-page platform-page--brief">
          <header className="platform-brief-label-row">
            <span className="platform-kicker">New Brief</span>
          </header>

          <section className="platform-section-card platform-section-card--presets">
            <div className="platform-section-head">
              <span className="platform-kicker">Presets</span>
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

          <section className="platform-section-card platform-section-card--vision">
            <div className="platform-section-head">
              <span className="platform-kicker">Stage 1 · Core brief</span>
              <h2>Start with the feeling and the core prompt.</h2>
            </div>
            <textarea
              className="platform-textarea platform-textarea--hero"
              rows={5}
              value={brief.briefInput}
              onChange={event => updateBrief('briefInput', event.target.value)}
              placeholder="Describe the feeling, the brand, the world you want to build."
            />
            <div className="platform-hero-actions">
              <button type="button" className="platform-secondary-btn" onClick={revealLookStage}>
                Continue to Look →
              </button>
            </div>
          </section>

          <AccordionCard title="Stage 2 · More options" open={openSections.direction} onToggle={() => toggleSection('direction')}>
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
          </AccordionCard>

          <AccordionCard title="Stage 3 · Advanced" open={openSections.advanced} onToggle={() => toggleSection('advanced')}>
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

            <div className="platform-slider-grid platform-slider-grid--compact">
              {EMOTIONAL_SLIDERS.map(slider => (
                <label key={slider.key} className="platform-slider platform-slider--compact">
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
                </label>
              ))}
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

            <div
              className="platform-clone-dropzone"
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault()
                const droppedUrl = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
                if (droppedUrl) updateBrief('cloneUrl', droppedUrl.trim())
              }}
            >
              <p>Clone a site structure by dropping or pasting a URL.</p>
              <div className="platform-clone-input-row">
                <input
                  type="url"
                  className="platform-input"
                  value={brief.cloneUrl}
                  onChange={event => updateBrief('cloneUrl', event.target.value)}
                  placeholder="Paste any URL to study its structure and rhythm"
                />
                <button type="button" className="platform-secondary-btn" onClick={analyzeCloneUrl} disabled={cloneLoading}>
                  {cloneLoading ? 'Analyzing…' : 'Analyze →'}
                </button>
              </div>
              {cloneLoading ? <span className="platform-helper">Analyzing site...</span> : null}
              {cloneError ? <span className="platform-error-inline">{cloneError}</span> : null}
              {brief.cloneAnalysis ? (
                <div className="platform-clone-result">
                  <p>{summarizeCloneAnalysis(brief.cloneAnalysis)}</p>
                  <button type="button" className="platform-primary-btn" onClick={queueBuild}>
                    Clone with my brand →
                  </button>
                </div>
              ) : null}
            </div>
          </AccordionCard>

          <section className="platform-build-card platform-build-card--sticky">
            <button type="button" className="platform-primary-btn platform-primary-btn--wide" onClick={queueBuild} disabled={!canBuild}>
              Build It →
            </button>
            <button type="button" className="platform-text-link" onClick={openConversation}>
              or have a conversation →
            </button>
            <Link href="/dashboard" className="platform-text-link">← Projects</Link>
          </section>

          {brief.chatExpanded ? (
            <section ref={conversationRef} className="platform-section-card platform-section-card--conversation">
              <div className="platform-section-head platform-section-head--compact">
                <span className="platform-kicker">Conversation</span>
                <button type="button" className="platform-close-btn" onClick={closeConversation} aria-label="Close conversation">
                  ✕
                </button>
              </div>
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
            </section>
          ) : null}
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
  const [railCollapsed, setRailCollapsed] = useState(true)
  const [workbenchTab, setWorkbenchTab] = useState<GenerateWorkbenchTab>('revise')
  const [decisionsTab, setDecisionsTab] = useState<DecisionsRailTab>('blueprint')
  const [revisionInput, setRevisionInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [generationCount, setGenerationCount] = useState(0)
  const [errorLog, setErrorLog] = useState<Array<{ time: string; message: string }>>([])
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false)
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
      ...(buildRawBriefInput(brief) ? { rawBrief: buildRawBriefInput(brief) } : {}),
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
    setIsFullscreenPreviewOpen(true)
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
        <FlowHeader
          current="generate"
          backHref="/brief"
          backLabel="← Brief"
          right={html && !loading ? <Link href="/edit" className="platform-primary-btn">Edit →</Link> : null}
        />
        <main id={MAIN_CONTENT_ID} className="platform-page platform-page--generate">
          <section className="platform-generate-main">
            <section className="platform-preview-stage">
              {loading ? (
                <div className="platform-loading-stage platform-loading-stage--preview">
                  <div className="platform-loading-orb" />
                  <div className="platform-preview-stage-copy" aria-live="polite">
                    <span className="platform-kicker">Generation Status</span>
                    <h2>{LOADING_MESSAGES[loadingMessageIndex]}</h2>
                    <p>The preview stays center stage while the agent pipeline finishes the build.</p>
                  </div>
                </div>
              ) : null}

              {!html && !loading && loaded ? (
                <div className="platform-empty platform-empty--preview">
                  <h2>No active generation yet.</h2>
                  <p>Head back to the brief, fill in the direction, and hit Build It to start the agent pipeline.</p>
                  <Link href="/brief" className="platform-primary-btn">Go to Brief →</Link>
                </div>
              ) : null}

              {html && !loading ? (
                <>
                  {previewMode === 'before-after' && previousGeneration ? (
                    <div
                      id="generate-preview-panel"
                      className={`platform-preview-grid platform-preview-grid--${viewportMode}`}
                    >
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
                    <div
                      id="generate-preview-panel"
                      className={`platform-preview-single platform-preview-single--${viewportMode}`}
                    >
                      {viewportMode === 'desktop' ? (
                        <div className="platform-desktop-preview">
                          <PreviewFrame html={html} title="Generated site preview" className="platform-preview-frame" />
                          <div className="platform-mobile-card">
                            <span className="platform-kicker">Phone Preview</span>
                            <p>Keep the handheld view visible without giving up the full desktop composition.</p>
                            <PreviewFrame html={html} title="Generated mobile site preview" className="platform-preview-frame platform-preview-frame--phone" />
                          </div>
                        </div>
                      ) : (
                        <PreviewFrame html={html} title="Generated site preview" className="platform-preview-frame" />
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <div className="platform-toolbar platform-toolbar--generate">
              <div className="platform-toolbar-stats">
                <div><span>Brand</span><strong>{resolveBrandName(brief, currentSnapshot)}</strong></div>
                <div><span>Direction</span><strong>{blueprint?.designSystem?.primaryDirection || brief.designDirection}</strong></div>
                <div><span>Motion</span><strong>{blueprint?.motionSystem?.intensity || 'editorial'}</strong></div>
                <div><span>Mobile</span><strong>{mobileImpactScore ?? '—'}</strong></div>
              </div>
              <div className="platform-toolbar-actions">
                <button type="button" className="platform-secondary-btn" onClick={openFullscreen} disabled={!html}>View Full Screen</button>
                <button type="button" className="platform-secondary-btn" onClick={() => html && downloadHtml(html, resolveBrandName(brief, currentSnapshot))} disabled={!html}>Download HTML</button>
                <div className="platform-pill-row platform-pill-row--compact" role="tablist" aria-label="Preview viewport modes">
                  <button
                    id="generate-viewport-mobile-tab"
                    type="button"
                    role="tab"
                    aria-label="Switch preview to mobile viewport"
                    aria-selected={viewportMode === 'mobile'}
                    aria-controls="generate-preview-panel"
                    className={`platform-pill ${viewportMode === 'mobile' ? 'platform-pill--active' : ''}`}
                    onClick={() => setViewportMode('mobile')}
                  >
                    Mobile
                  </button>
                  <button
                    id="generate-viewport-desktop-tab"
                    type="button"
                    role="tab"
                    aria-label="Switch preview to desktop viewport"
                    aria-selected={viewportMode === 'desktop'}
                    aria-controls="generate-preview-panel"
                    className={`platform-pill ${viewportMode === 'desktop' ? 'platform-pill--active' : ''}`}
                    onClick={() => setViewportMode('desktop')}
                  >
                    Desktop
                  </button>
                </div>
                <button type="button" className="platform-secondary-btn" onClick={handleRegenerate} disabled={loading || !hasBriefContent(brief)}>Regenerate</button>
                <button type="button" className="platform-secondary-btn" onClick={toggleRail} aria-expanded={!railCollapsed} aria-controls="generate-insights-drawer">
                  {railCollapsed ? 'Open Insights' : 'Close Insights'}
                </button>
              </div>
            </div>

            <section className="platform-status-strip" aria-live="polite">
              <div className="platform-status-strip-copy">
                <span className="platform-kicker">Agent Status</span>
                <strong>{loading ? 'Live build in progress' : 'Generation pipeline ready'}</strong>
                <span>{loading ? 'Each specialist reports here while the preview stays uninterrupted.' : 'Review the compact status strip or open insights when you want the deeper rationale.'}</span>
              </div>
              <ul className="platform-status-strip-list">
                {agentRows.map(agent => (
                  <li key={agent.key} className={`platform-status-pill platform-status-pill--${agent.state}`}>
                    <span>{agent.label}</span>
                    <strong>{stateLabel(agent.state)}</strong>
                  </li>
                ))}
              </ul>
            </section>

            {html && !loading ? (
              <div className="platform-review-actions">
                <Link href="/edit" className="platform-primary-btn">Edit this page →</Link>
                <button
                  type="button"
                  className="platform-secondary-btn"
                  onClick={() => html && downloadHtml(html, resolveBrandName(brief, currentSnapshot))}
                >
                  Download HTML
                </button>
                <Link href="/brief" className="platform-text-link">Start over</Link>
                {previousGeneration ? (
                  <button type="button" className="platform-secondary-btn" onClick={() => setPreviewMode(prev => prev === 'current' ? 'before-after' : 'current')}>
                    {previewMode === 'before-after' ? 'Current Only' : 'Before / After'}
                  </button>
                ) : null}
              </div>
            ) : null}

            <section className="platform-section-card platform-section-card--workbench">
              <div className="platform-section-head platform-section-head--compact">
                <div>
                  <span className="platform-kicker">Workbench</span>
                  <h2>Refine this pass</h2>
                </div>
                <div className="platform-pill-row platform-pill-row--compact" role="tablist" aria-label="Workbench panels">
                  <button type="button" id="workbench-tab-revise" role="tab" aria-label="Open revise workbench panel" aria-selected={workbenchTab === 'revise'} aria-controls="workbench-panel-revise" className={`platform-pill ${workbenchTab === 'revise' ? 'platform-pill--active' : ''}`} onClick={() => setWorkbenchTab('revise')}>Revise</button>
                  <button type="button" id="workbench-tab-history" role="tab" aria-label="Open history workbench panel" aria-selected={workbenchTab === 'history'} aria-controls="workbench-panel-history" className={`platform-pill ${workbenchTab === 'history' ? 'platform-pill--active' : ''}`} onClick={() => setWorkbenchTab('history')}>History</button>
                  <button type="button" id="workbench-tab-changes" role="tab" aria-label="Open changes workbench panel" aria-selected={workbenchTab === 'changes'} aria-controls="workbench-panel-changes" className={`platform-pill ${workbenchTab === 'changes' ? 'platform-pill--active' : ''}`} onClick={() => setWorkbenchTab('changes')}>Changes</button>
                  {(error || errorLog.length > 0) ? (
                    <button type="button" id="workbench-tab-errors" role="tab" aria-label="Open errors workbench panel" aria-selected={workbenchTab === 'errors'} aria-controls="workbench-panel-errors" className={`platform-pill ${workbenchTab === 'errors' ? 'platform-pill--active' : ''}`} onClick={() => setWorkbenchTab('errors')}>Errors</button>
                  ) : null}
                </div>
              </div>

              {workbenchTab === 'revise' ? (
                <div id="workbench-panel-revise" role="tabpanel" aria-labelledby="workbench-tab-revise" className="platform-revision-row">
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
              ) : null}

              {workbenchTab === 'history' ? (
                passHistory.length > 0 ? (
                  <div id="workbench-panel-history" role="tabpanel" aria-labelledby="workbench-tab-history" className="platform-history-list">
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
                )
              ) : null}

              {workbenchTab === 'changes' ? (
                changeSummary ? (
                  <div id="workbench-panel-changes" role="tabpanel" aria-labelledby="workbench-tab-changes" className="platform-summary-list">
                    <strong>{changeSummary.headline}</strong>
                    {changeSummary.improvements.map(item => <p key={item}>{item}</p>)}
                    {changeSummary.shifts.map(item => <p key={item}>{item}</p>)}
                  </div>
                ) : (
                  <div className="platform-empty">
                    <h3>No compare story yet.</h3>
                    <p>Run another pass and this panel will tell you what actually shifted.</p>
                  </div>
                )
              ) : null}

              {workbenchTab === 'errors' ? (
                error || errorLog.length > 0 ? (
                  <div id="workbench-panel-errors" role="tabpanel" aria-labelledby="workbench-tab-errors" className="platform-history-list">
                    {error ? (
                      <article className="platform-history-item platform-history-item--error">
                        <strong>Latest error</strong>
                        <p>{error}</p>
                      </article>
                    ) : null}
                    {errorLog.map(entry => (
                      <article key={`${entry.time}-${entry.message}`} className="platform-history-item">
                        <strong>{entry.time}</strong>
                        <p>{entry.message}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="platform-empty">
                    <h3>No errors logged.</h3>
                    <p>Generation issues will show up here if the pipeline hits a snag.</p>
                  </div>
                )
              ) : null}
            </section>
          </section>

          {!railCollapsed ? <button type="button" className="platform-drawer-backdrop" aria-label="Close insights drawer" onClick={toggleRail} /> : null}
          <aside id="generate-insights-drawer" className={`platform-decisions-rail ${railCollapsed ? 'platform-decisions-rail--collapsed' : 'platform-decisions-rail--open'}`}>
            <div className="platform-rail-head">
              <div>
                <span className="platform-kicker">Insights</span>
                <h2>Blueprint + critique</h2>
              </div>
              <button type="button" className="platform-rail-toggle" onClick={toggleRail} aria-label={railCollapsed ? 'Open insights drawer' : 'Close insights drawer'}>
                {railCollapsed ? '›' : '×'}
              </button>
            </div>

            <div className="platform-rail-body">
              <div className="platform-pill-row platform-pill-row--compact" role="tablist" aria-label="Creative review panels">
                <button type="button" id="insights-tab-blueprint" role="tab" aria-label="Open blueprint insights" aria-selected={decisionsTab === 'blueprint'} aria-controls="insights-panel-blueprint" className={`platform-pill ${decisionsTab === 'blueprint' ? 'platform-pill--active' : ''}`} onClick={() => setDecisionsTab('blueprint')}>Blueprint</button>
                <button type="button" id="insights-tab-critique" role="tab" aria-label="Open critique insights" aria-selected={decisionsTab === 'critique'} aria-controls="insights-panel-critique" className={`platform-pill ${decisionsTab === 'critique' ? 'platform-pill--active' : ''}`} onClick={() => setDecisionsTab('critique')}>Critique</button>
                <button type="button" id="insights-tab-decisions" role="tab" aria-label="Open decisions insights" aria-selected={decisionsTab === 'decisions'} aria-controls="insights-panel-decisions" className={`platform-pill ${decisionsTab === 'decisions' ? 'platform-pill--active' : ''}`} onClick={() => setDecisionsTab('decisions')}>Decisions</button>
              </div>

              {decisionsTab === 'blueprint' ? (
                blueprint ? (
                  <div id="insights-panel-blueprint" role="tabpanel" aria-labelledby="insights-tab-blueprint">
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
                  </div>
                ) : (
                  <article id="insights-panel-blueprint" role="tabpanel" aria-labelledby="insights-tab-blueprint" className="platform-rail-card">
                    <span className="platform-rail-label">No blueprint yet</span>
                    <strong>Generate a pass to inspect the system.</strong>
                    <p>This drawer will show the brand, design, and motion plan once the preview is ready.</p>
                  </article>
                )
              ) : null}

              {decisionsTab === 'critique' ? (
                critique ? (
                  <article id="insights-panel-critique" role="tabpanel" aria-labelledby="insights-tab-critique" className="platform-rail-card">
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
                ) : (
                  <article id="insights-panel-critique" role="tabpanel" aria-labelledby="insights-tab-critique" className="platform-rail-card">
                    <span className="platform-rail-label">No critique yet</span>
                    <strong>Run a pass to review the critic notes.</strong>
                    <p>The critique summary and scores will appear here after generation finishes.</p>
                  </article>
                )
              ) : null}

              {decisionsTab === 'decisions' ? (
                decisions.length > 0 ? (
                  <div id="insights-panel-decisions" role="tabpanel" aria-labelledby="insights-tab-decisions">
                    {decisions.map(decision => (
                      <article key={`${decision.label}-${decision.value}`} className="platform-rail-card">
                        <span className="platform-rail-label">{decision.label}</span>
                        <strong>{decision.value}</strong>
                        {decision.agent ? <span className="platform-rail-agent">↳ {decision.agent}</span> : null}
                        <p>{decision.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <article id="insights-panel-decisions" role="tabpanel" aria-labelledby="insights-tab-decisions" className="platform-rail-card">
                    <span className="platform-rail-label">No decisions yet</span>
                    <strong>Open this tab after a pass completes.</strong>
                    <p>Agent-attributed decisions will collect here once the generation is finished.</p>
                  </article>
                )
              ) : null}
            </div>
          </aside>
        </main>
        {isFullscreenPreviewOpen && html ? (
          <FullscreenPreviewOverlay
            html={html}
            title="Fullscreen preview"
            onClose={() => setIsFullscreenPreviewOpen(false)}
          />
        ) : null}
      </div>
    </BuilderErrorBoundary>
  )
}

export function EditorPage() {
  const [generation, setGeneration] = useState<GenerationSnapshot | null>(null)
  const [editorModel, setEditorModel] = useState<EditableDocumentModel | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'content' | 'media' | 'theme'>('content')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('content')
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  const [textStyles, setTextStyles] = useState<Record<string, EditableTextStyle>>({})
  const [imageValues, setImageValues] = useState<Record<string, string>>({})
  const [imageStyles, setImageStyles] = useState<Record<string, EditableImageStyle>>({})
  const [sectionStyles, setSectionStyles] = useState<Record<string, EditableSectionStyle>>({})
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [accentOverride, setAccentOverride] = useState('#C9A84C')
  const [editorReady, setEditorReady] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<'sections' | 'inspector' | 'theme' | null>(null)
  const [isFullscreenPreviewOpen, setIsFullscreenPreviewOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const editorContextRef = useRef<EditorContext | null>(null)
  const prevEditStateRef = useRef<
    | { text: Record<string, string>; styles: Record<string, EditableTextStyle>; image: Record<string, string>; accent: string }
    | null
  >(null)
  const editLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null)
    setGeneration(saved)
    if (!saved?.html) {
      setLoaded(true)
      return
    }

    const nextModel = buildEditableDocumentModel(saved.html)
    setEditorModel(nextModel)
    const initialText = Object.fromEntries(nextModel.textItems.map(item => [item.id, item.text]))
    const initialImage = Object.fromEntries(nextModel.imageItems.map(item => [item.id, item.src]))
    const initialImageStyles = Object.fromEntries(nextModel.imageItems.map(item => [item.id, item.baseStyle]))
    const initialSectionStyles = Object.fromEntries(nextModel.sectionItems.map(item => [item.id, item.baseStyle]))
    const initialAccent = saved.metadata?.palette?.accent || '#C9A84C'
    setTextValues(initialText)
    setTextStyles(Object.fromEntries(nextModel.textItems.map(item => [item.id, item.baseStyle])))
    setImageValues(initialImage)
    setImageStyles(initialImageStyles)
    setSectionStyles(initialSectionStyles)
    setAccentOverride(initialAccent)
    // Seed the edit-log baseline so the initial hydrated values aren't logged
    // as spurious edits on first render.
    prevEditStateRef.current = {
      text: initialText,
      styles: Object.fromEntries(nextModel.textItems.map(item => [item.id, item.baseStyle])),
      image: initialImage,
      accent: initialAccent,
    }
    setEditorReady(true)
    setLoaded(true)
  }, [])

  // Resolve ownerId / projectId / generationId for builder_edits inserts.
  // Runs once; null result disables edit logging (user anonymous or no gen yet).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getCurrentEditorContext(supabase)
      .then(ctx => {
        editorContextRef.current = ctx
      })
      .catch(() => {
        editorContextRef.current = null
      })
  }, [])

  function withEditorDocument(callback: (doc: Document) => void) {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    callback(doc)
  }

  function clearFrameSelection(doc: Document) {
    doc.querySelectorAll('.is-irie-editor-selected').forEach(node => node.classList.remove('is-irie-editor-selected'))
  }

  function selectFrameNode(node: HTMLElement | null) {
    withEditorDocument(doc => {
      clearFrameSelection(doc)
      if (!node) return
      node.classList.add('is-irie-editor-selected')
      node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    })
  }

  useEffect(() => {
    withEditorDocument(doc => {
      const previous = doc.documentElement.getAttribute('data-irie-current-accent') || generation?.metadata?.palette?.accent || '#C9A84C'
      const html = replaceColorTokens(doc.documentElement.outerHTML, previous, accentOverride)
      doc.open()
      doc.write(`<!DOCTYPE html>\n${html}`)
      doc.close()
      doc.documentElement.setAttribute('data-irie-current-accent', accentOverride)
      syncComputedStylesFromFrame()
    })
  }, [accentOverride])

  useEffect(() => {
    if (!editorReady || !generation || !editorModel) return
    const baseAccent = generation.metadata?.palette?.accent || '#C9A84C'
    const nextHtml = buildEditedHtml(
      editorModel.annotatedHtml,
      textValues,
      textStyles,
      imageValues,
      imageStyles,
      sectionStyles,
      baseAccent,
      accentOverride,
    )
    const nextSnapshot: GenerationSnapshot = {
      ...generation,
      html: nextHtml,
      metadata: generation.metadata
        ? { ...generation.metadata, palette: { ...generation.metadata.palette, accent: accentOverride } }
        : generation.metadata,
    }
    writeStorage(LAST_GENERATION_STORAGE_KEY, nextSnapshot)
  }, [accentOverride, editorModel, editorReady, generation, imageStyles, imageValues, sectionStyles, textStyles, textValues])

  // Debounced edit logger: diffs the current editor state against the last
  // logged baseline, INSERTs one builder_edits row per change, and UPDATEs the
  // current builder_generations.final_html so refresh-persistence works.
  // No-op if editor hasn't initialized, no generation id resolved, or there
  // are no diffs.
  useEffect(() => {
    if (!editorReady || !editorModel || !generation) return
    if (!prevEditStateRef.current) return
    if (editLogTimerRef.current) clearTimeout(editLogTimerRef.current)
    editLogTimerRef.current = setTimeout(() => {
      const ctx = editorContextRef.current
      if (!ctx) return
      const prev = prevEditStateRef.current
      if (!prev) return
      const next = { text: textValues, styles: textStyles, image: imageValues, accent: accentOverride }
      const diffs = diffEditorState(prev, next)
      if (diffs.length === 0) return
      prevEditStateRef.current = {
        text: { ...textValues },
        styles: { ...textStyles },
        image: { ...imageValues },
        accent: accentOverride,
      }
      const baseAccent = generation.metadata?.palette?.accent || '#C9A84C'
      const currentHtml = buildEditedHtml(
        editorModel.annotatedHtml,
        textValues,
        textStyles,
        imageValues,
        imageStyles,
        sectionStyles,
        baseAccent,
        accentOverride,
      )
      // Build the agent_outputs_json that should live alongside the edited
      // final_html: same metadata shape as the seed but with palette.accent
      // patched to the current override so hydrate re-populates the picker
      // correctly on refresh.
      const nextAgentOutputs = {
        metadata: generation.metadata
          ? {
              ...generation.metadata,
              palette: { ...generation.metadata.palette, accent: accentOverride },
            }
          : null,
        blueprint: generation.blueprint,
        critique: generation.critique,
        decisions: generation.decisions,
        label: generation.label,
      }
      const supabase = createSupabaseBrowserClient()
      void logEdits(supabase, ctx, diffs, currentHtml, nextAgentOutputs)
    }, 500)
    return () => {
      if (editLogTimerRef.current) clearTimeout(editLogTimerRef.current)
    }
  }, [accentOverride, editorModel, editorReady, generation, imageStyles, imageValues, sectionStyles, textStyles, textValues])

  function isMobileReviewViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= 640
  }

  function focusTextItem(id: string) {
    setSelectedTextId(id)
    setSelectedImageId(null)
    setSelectedSectionId(null)
    setInspectorTab('content')
    if (isMobileReviewViewport()) setMobileSheet('inspector')
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-edit-id="${id}"]`)
      if (node instanceof HTMLElement) {
        clearFrameSelection(doc)
        node.classList.add('is-irie-editor-selected')
        node.setAttribute('contenteditable', 'true')
        node.focus()
      }
    })
  }

  function updateSelectedTextValue(value: string) {
    if (!selectedTextId) return
    setTextValues(prev => ({ ...prev, [selectedTextId]: value }))
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-edit-id="${selectedTextId}"]`)
      if (node instanceof HTMLElement) node.textContent = value
    })
  }

  function updateSelectedTextStyle<K extends keyof EditableTextStyle>(key: K, value: EditableTextStyle[K]) {
    if (!selectedTextId) return
    const nextStyle = { ...(textStyles[selectedTextId] || DEFAULT_TEXT_STYLE), [key]: value }
    setTextStyles(prev => ({ ...prev, [selectedTextId]: nextStyle }))
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-edit-id="${selectedTextId}"]`)
      if (node) applyTextStyleToElement(node, nextStyle)
    })
  }

  function focusImageItem(id: string) {
    setSelectedImageId(id)
    setSelectedTextId(null)
    setSelectedSectionId(null)
    setInspectorTab('content')
    if (isMobileReviewViewport()) setMobileSheet('inspector')
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-image-id="${id}"]`)
      if (node instanceof HTMLElement) {
        clearFrameSelection(doc)
        node.classList.add('is-irie-editor-selected')
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    })
  }

  function focusSectionItem(id: string) {
    setSelectedSectionId(id)
    setSelectedTextId(null)
    setSelectedImageId(null)
    setInspectorTab('style')
    if (isMobileReviewViewport()) setMobileSheet('inspector')
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-section-id="${id}"]`)
      if (node instanceof HTMLElement) {
        clearFrameSelection(doc)
        node.classList.add('is-irie-editor-selected')
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      }
    })
  }

  function triggerImageReplace() {
    if (isMobileReviewViewport()) setMobileSheet('inspector')
    uploadRef.current?.click()
  }

  function updateSelectedImageStyle<K extends keyof EditableImageStyle>(key: K, value: EditableImageStyle[K]) {
    if (!selectedImageId) return
    const nextStyle = { ...(imageStyles[selectedImageId] || DEFAULT_IMAGE_STYLE), [key]: value }
    setImageStyles(prev => ({ ...prev, [selectedImageId]: nextStyle }))
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-image-id="${selectedImageId}"]`)
      if (node) applyImageStyleToElement(node, nextStyle)
    })
  }

  function updateSelectedSectionStyle<K extends keyof EditableSectionStyle>(key: K, value: EditableSectionStyle[K]) {
    if (!selectedSectionId) return
    const nextStyle = { ...(sectionStyles[selectedSectionId] || DEFAULT_SECTION_STYLE), [key]: value }
    setSectionStyles(prev => ({ ...prev, [selectedSectionId]: nextStyle }))
    withEditorDocument(doc => {
      const node = doc.querySelector(`[data-irie-section-id="${selectedSectionId}"]`)
      if (node) applySectionStyleToElement(node, nextStyle)
    })
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selectedImageId) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      setImageValues(prev => ({ ...prev, [selectedImageId]: result }))
      withEditorDocument(doc => {
        const node = doc.querySelector(`[data-irie-image-id="${selectedImageId}"]`)
        if (node instanceof HTMLImageElement) node.src = result
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function downloadEditedHtml() {
    if (!generation?.html || !editorModel) return
    const baseAccent = generation.metadata?.palette?.accent || '#C9A84C'
    const html = buildEditedHtml(
      editorModel.annotatedHtml,
      textValues,
      textStyles,
      imageValues,
      imageStyles,
      sectionStyles,
      baseAccent,
      accentOverride,
    )
    downloadHtml(html, generation.blueprint?.brandCore?.brandName || 'irie-page')
    const ctx = editorContextRef.current
    if (ctx) {
      const supabase = createSupabaseBrowserClient()
      void logPublish(supabase, ctx, html)
    }
  }

  function syncComputedStylesFromFrame() {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !editorModel) return
    const computedStyles = extractEditableTextStyles(doc)
    const computedImageStyles = extractEditableImageStyles(doc)
    const computedSectionStyles = extractEditableSectionStyles(doc)
    setTextStyles(computedStyles)
    setImageStyles(computedImageStyles)
    setSectionStyles(computedSectionStyles)
    if (prevEditStateRef.current) {
      prevEditStateRef.current = {
        ...prevEditStateRef.current,
        styles: computedStyles,
      }
    }
    setEditorModel(prev => (
      prev
        ? {
            ...prev,
            textItems: prev.textItems.map(item => ({
              ...item,
              baseStyle: computedStyles[item.id] || item.baseStyle,
            })),
            imageItems: prev.imageItems.map(item => ({
              ...item,
              baseStyle: computedImageStyles[item.id] || item.baseStyle,
            })),
            sectionItems: prev.sectionItems.map(item => ({
              ...item,
              baseStyle: computedSectionStyles[item.id] || item.baseStyle,
            })),
          }
        : prev
    ))
    doc.removeEventListener('click', handleFrameClick)
    doc.removeEventListener('input', handleFrameInput)
    doc.addEventListener('click', handleFrameClick)
    doc.addEventListener('input', handleFrameInput)
    setLoaded(true)
  }

  function handleFrameClick(event: Event) {
    const target = event.target
    if (!(target instanceof Element)) return

    const textNode = target.closest('[data-irie-editable="text"]')
    if (textNode instanceof HTMLElement) {
      const id = textNode.getAttribute('data-irie-edit-id')
      if (!id) return
      focusTextItem(id)
      return
    }

    const imageNode = target.closest('[data-irie-image-id]')
    if (imageNode instanceof HTMLElement) {
      const id = imageNode.getAttribute('data-irie-image-id')
      if (!id) return
      focusImageItem(id)
      return
    }

    const sectionNode = target.closest('[data-irie-section-id]')
    if (sectionNode instanceof HTMLElement) {
      const id = sectionNode.getAttribute('data-irie-section-id')
      if (!id) return
      focusSectionItem(id)
    }
  }

  function handleFrameInput(event: Event) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const textNode = target.closest('[data-irie-editable="text"]')
    if (!(textNode instanceof HTMLElement)) return
    const id = textNode.getAttribute('data-irie-edit-id')
    if (!id) return
    setTextValues(prev => ({ ...prev, [id]: textNode.textContent || '' }))
  }

  const selectedTextItem = editorModel?.textItems.find(item => item.id === selectedTextId) || null
  const selectedImageItem = editorModel?.imageItems.find(item => item.id === selectedImageId) || null
  const selectedSectionItem = editorModel?.sectionItems.find(item => item.id === selectedSectionId) || null
  const selectedTextStyle = selectedTextId ? (textStyles[selectedTextId] || DEFAULT_TEXT_STYLE) : DEFAULT_TEXT_STYLE
  const selectedImageStyle = selectedImageId ? (imageStyles[selectedImageId] || DEFAULT_IMAGE_STYLE) : DEFAULT_IMAGE_STYLE
  const selectedSectionStyle = selectedSectionId ? (sectionStyles[selectedSectionId] || DEFAULT_SECTION_STYLE) : DEFAULT_SECTION_STYLE
  const sectionGroups = editorModel ? groupTextItemsBySection(editorModel.textItems) : []
  const imageSectionGroups = editorModel ? groupImageItemsBySection(editorModel.imageItems) : []
  const editorObjectCount = (editorModel?.textItems.length || 0) + (editorModel?.imageItems.length || 0)
  const availableInspectorTabs = getAvailableInspectorTabs({ selectedTextItem, selectedImageItem, selectedSectionItem })

  useEffect(() => {
    if (!availableInspectorTabs.includes(inspectorTab)) {
      setInspectorTab(availableInspectorTabs[0] || 'content')
    }
  }, [availableInspectorTabs, inspectorTab])

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <FlowHeader
          current="edit"
          backHref="/generate"
          backLabel="← Generate"
          right={(
            <div className="platform-flow-header-button-row">
              <button type="button" className="platform-secondary-btn" onClick={downloadEditedHtml} disabled={!editorModel}>
                Download HTML
              </button>
              <Link href="/publish" className="platform-primary-btn">Export →</Link>
            </div>
          )}
        />
        <main id={MAIN_CONTENT_ID} className="platform-page platform-page--editor">
          {generation?.html && editorModel ? (
            <section className="platform-editor-layout">
              {mobileSheet ? <button type="button" className="platform-drawer-backdrop platform-drawer-backdrop--mobile" aria-label="Close mobile editor panel" onClick={() => setMobileSheet(null)} /> : null}
              <aside className={`platform-editor-sidebar ${mobileSheet === 'sections' || mobileSheet === 'theme' ? 'is-mobile-open' : ''}`}>
                <div className="platform-editor-header">
                  <div className="platform-editor-workspace">
                    <strong>{generation.blueprint?.brandCore?.brandName || 'Current Site'}</strong>
                    <span>{sectionGroups.length} sections · {editorObjectCount} editable objects</span>
                  </div>
                  <div className="platform-editor-header-actions">
                    <span className="platform-kicker">Editor</span>
                    <button type="button" className="platform-sheet-close" onClick={() => setMobileSheet(null)} aria-label="Close section panel">
                      Close
                    </button>
                  </div>
                </div>

                <div className="platform-pill-row platform-pill-row--compact" role="tablist" aria-label="Editor panels">
                  <button type="button" id="editor-tab-content" role="tab" aria-label="Open content panel" aria-selected={sidebarTab === 'content'} aria-controls="editor-panel-content" className={`platform-pill ${sidebarTab === 'content' ? 'platform-pill--active' : ''}`} onClick={() => setSidebarTab('content')}>Content</button>
                  <button type="button" id="editor-tab-media" role="tab" aria-label="Open media panel" aria-selected={sidebarTab === 'media'} aria-controls="editor-panel-media" className={`platform-pill ${sidebarTab === 'media' ? 'platform-pill--active' : ''}`} onClick={() => setSidebarTab('media')}>Media</button>
                  <button type="button" id="editor-tab-theme" role="tab" aria-label="Open theme panel" aria-selected={sidebarTab === 'theme'} aria-controls="editor-panel-theme" className={`platform-pill ${sidebarTab === 'theme' ? 'platform-pill--active' : ''}`} onClick={() => setSidebarTab('theme')}>Theme</button>
                </div>

                {sidebarTab === 'content' ? (
                <div id="editor-panel-content" role="tabpanel" aria-labelledby="editor-tab-content" className="platform-editor-panel">
                  <span className="platform-kicker">Structure</span>
                  <div className="platform-editor-sections">
                    {sectionGroups.map(section => (
                      <div key={section.id} className="platform-editor-section-group">
                        <button type="button" className={`platform-editor-section-head ${selectedSectionId === section.id ? 'is-active' : ''}`} onClick={() => focusSectionItem(section.id)}>
                          <strong>{section.label}</strong>
                          <span>{section.items.length} text objects</span>
                        </button>
                        <div className="platform-editor-list">
                          {section.items.map(item => (
                            <button
                              key={item.id}
                            type="button"
                            className={`platform-editor-item ${selectedTextId === item.id ? 'is-active' : ''}`}
                            onClick={() => focusTextItem(item.id)}
                          >
                              <strong>{item.label}</strong>
                              <span>{item.kind} · {(textValues[item.id] || item.text).slice(0, 42)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                ) : null}

                {sidebarTab === 'media' ? (
                <div id="editor-panel-media" role="tabpanel" aria-labelledby="editor-tab-media" className="platform-editor-panel">
                  <span className="platform-kicker">Images</span>
                  <div className="platform-editor-sections">
                    {editorModel.imageItems.length ? imageSectionGroups.map(section => (
                      <div key={section.id} className="platform-editor-section-group">
                        <div className="platform-editor-section-head">
                          <strong>{section.label}</strong>
                          <span>{section.items.length} media objects</span>
                        </div>
                        <div className="platform-editor-list">
                          {section.items.map(item => (
                            <button
                              key={item.id}
                            type="button"
                            className={`platform-editor-item ${selectedImageId === item.id ? 'is-active' : ''}`}
                            onClick={() => focusImageItem(item.id)}
                          >
                              <strong>{item.label}</strong>
                              <span>image slot · replace asset</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )) : <span className="platform-helper">No image slots detected.</span>}
                  </div>
                </div>
                ) : null}

                {sidebarTab === 'theme' ? (
                <div id="editor-panel-theme" role="tabpanel" aria-labelledby="editor-tab-theme" className="platform-editor-panel">
                  <span className="platform-kicker">Theme</span>
                  <div className="platform-color-grid platform-color-grid--editor">
                    <div className="platform-color-card platform-color-card--editor is-readonly">
                      <span>Primary</span>
                      <code>{generation.metadata?.palette?.primary || '—'}</code>
                    </div>
                    <div className="platform-color-card platform-color-card--editor is-readonly">
                      <span>Background</span>
                      <code>{generation.metadata?.palette?.background || '—'}</code>
                    </div>
                    <div className="platform-color-card platform-color-card--editor is-readonly">
                      <span>Accent</span>
                      <code>{generation.metadata?.palette?.accent || accentOverride}</code>
                    </div>
                  </div>
                  <label className="platform-color-card platform-color-card--editor">
                    <input type="color" value={accentOverride} onChange={event => setAccentOverride(event.target.value)} />
                    <span>Live Accent</span>
                    <code>{accentOverride}</code>
                  </label>
                  <p className="platform-helper">Live accent updates branded highlights across the generated page. Object-level text and CTA colors live in the inspector.</p>
                </div>
                ) : null}

                <input ref={uploadRef} type="file" accept="image/*" className="platform-hidden-input" onChange={handleImageUpload} />
              </aside>

              <div className="platform-editor-preview">
                <div className="platform-editor-preview-toolbar">
                  <div className="platform-editor-preview-head">
                    <span className="platform-kicker">Preview</span>
                    <span className="platform-mobile-review-note">For full editing controls, switch to desktop.</span>
                  </div>
                  <div className="platform-flow-header-button-row">
                    <button type="button" className="platform-secondary-btn" onClick={() => setIsFullscreenPreviewOpen(true)}>
                      Fullscreen
                    </button>
                  </div>
                </div>
                <iframe
                  ref={iframeRef}
                  title="Editable preview"
                  className="platform-preview-frame platform-preview-frame--editor"
                  sandbox="allow-same-origin"
                  srcDoc={editorModel.frameHtml}
                  onLoad={syncComputedStylesFromFrame}
                />
              </div>

              <aside className={`platform-editor-inspector ${mobileSheet === 'inspector' ? 'is-mobile-open' : ''}`}>
                <div className="platform-editor-panel">
                  <div className="platform-editor-header-actions">
                    <span className="platform-kicker">Inspector</span>
                    <button type="button" className="platform-sheet-close" onClick={() => setMobileSheet(null)} aria-label="Close inspector panel">
                      Close
                    </button>
                  </div>
                  <div className="platform-pill-row platform-pill-row--compact" role="tablist" aria-label="Inspector panels">
                    {availableInspectorTabs.map(tab => (
                      <button
                        key={tab}
                        id={`inspector-tab-${tab}`}
                        type="button"
                        role="tab"
                        aria-label={`Open ${tab} inspector panel`}
                        aria-selected={inspectorTab === tab}
                        aria-controls={`inspector-panel-${tab}`}
                        className={`platform-pill ${inspectorTab === tab ? 'platform-pill--active' : ''}`}
                        onClick={() => setInspectorTab(tab)}
                      >
                        {tab[0].toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {selectedSectionItem ? (
                    <div id={`inspector-panel-${inspectorTab}`} role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`} className="platform-editor-controls">
                      <div className="platform-editor-selected">
                        <strong>{selectedSectionItem.label}</strong>
                        <span>{selectedSectionItem.tagName.toUpperCase()} · SECTION</span>
                      </div>

                      {inspectorTab === 'content' ? (
                        <div className="platform-control-grid">
                          <label className="platform-field">
                            <span className="platform-field-label">Visibility</span>
                            <div className="platform-segmented">
                              <button type="button" className={`platform-segmented-btn ${!selectedSectionStyle.hidden ? 'is-active' : ''}`} onClick={() => updateSelectedSectionStyle('hidden', false)}>Show</button>
                              <button type="button" className={`platform-segmented-btn ${selectedSectionStyle.hidden ? 'is-active' : ''}`} onClick={() => updateSelectedSectionStyle('hidden', true)}>Hide</button>
                            </div>
                          </label>
                          <label className="platform-field">
                            <span className="platform-field-label">Max Width</span>
                            <div className="platform-segmented">
                              <button type="button" className={`platform-segmented-btn ${selectedSectionStyle.maxWidthMode === 'full' ? 'is-active' : ''}`} onClick={() => updateSelectedSectionStyle('maxWidthMode', 'full')}>Full</button>
                              <button type="button" className={`platform-segmented-btn ${selectedSectionStyle.maxWidthMode === 'constrained' ? 'is-active' : ''}`} onClick={() => updateSelectedSectionStyle('maxWidthMode', 'constrained')}>Constrained</button>
                            </div>
                          </label>
                        </div>
                      ) : null}

                      {inspectorTab === 'style' ? (
                        <>
                          <div className="platform-control-grid">
                            <label className="platform-field">
                              <span className="platform-field-label">Padding Top</span>
                              <input className="platform-input" type="text" value={selectedSectionStyle.paddingTop} placeholder="e.g. 72px" onChange={event => updateSelectedSectionStyle('paddingTop', event.target.value)} />
                            </label>
                            <label className="platform-field">
                              <span className="platform-field-label">Padding Bottom</span>
                              <input className="platform-input" type="text" value={selectedSectionStyle.paddingBottom} placeholder="e.g. 72px" onChange={event => updateSelectedSectionStyle('paddingBottom', event.target.value)} />
                            </label>
                          </div>
                          <label className="platform-field">
                            <span className="platform-field-label">Background</span>
                            <div className="platform-color-input">
                              <input type="color" value={selectedSectionStyle.backgroundColor || '#080808'} onChange={event => updateSelectedSectionStyle('backgroundColor', event.target.value)} />
                              <input className="platform-input" type="text" value={selectedSectionStyle.backgroundColor} placeholder="#080808" onChange={event => updateSelectedSectionStyle('backgroundColor', event.target.value)} />
                            </div>
                          </label>
                        </>
                      ) : null}

                      {inspectorTab === 'layout' ? (
                        <>
                          <label className="platform-field">
                            <span className="platform-field-label">Background Image URL</span>
                            <input className="platform-input" type="url" value={selectedSectionStyle.backgroundImage} placeholder="https://…" onChange={event => updateSelectedSectionStyle('backgroundImage', event.target.value)} />
                          </label>
                          <label className="platform-field">
                            <span className="platform-field-label">Overlay Opacity</span>
                            <input className="platform-input" type="range" min="0" max="1" step="0.05" value={selectedSectionStyle.overlayOpacity} onChange={event => updateSelectedSectionStyle('overlayOpacity', event.target.value)} />
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : selectedTextItem ? (
                    <div id={`inspector-panel-${inspectorTab}`} role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`} className="platform-editor-controls">
                      <div className="platform-editor-selected">
                        <strong>{selectedTextItem.label}</strong>
                        <span>{selectedTextItem.sectionLabel} · {selectedTextItem.tagName.toUpperCase()}</span>
                      </div>

                      {inspectorTab === 'content' ? (
                        <label className="platform-field">
                          <span className="platform-field-label">Content</span>
                          <textarea
                            className="platform-textarea"
                            rows={selectedTextItem.isAction ? 3 : 6}
                            value={textValues[selectedTextItem.id] || selectedTextItem.text}
                            onChange={event => updateSelectedTextValue(event.target.value)}
                          />
                        </label>
                      ) : null}

                      {inspectorTab === 'style' ? (
                        <>
                          <div className="platform-control-grid">
                            <label className="platform-field">
                              <span className="platform-field-label">Font</span>
                              <select
                                className="platform-select"
                                value={selectedTextStyle.fontFamily}
                                onChange={event => updateSelectedTextStyle('fontFamily', event.target.value)}
                              >
                                <option value="">Keep original</option>
                                {FONT_FAMILY_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Weight</span>
                              <select
                                className="platform-select"
                                value={selectedTextStyle.fontWeight}
                                onChange={event => updateSelectedTextStyle('fontWeight', event.target.value)}
                              >
                                <option value="">Keep original</option>
                                <option value="300">300</option>
                                <option value="400">400</option>
                                <option value="500">500</option>
                                <option value="600">600</option>
                                <option value="700">700</option>
                                <option value="800">800</option>
                                <option value="900">900</option>
                              </select>
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Size</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.fontSize}
                                placeholder="e.g. 24px"
                                onChange={event => updateSelectedTextStyle('fontSize', event.target.value)}
                              />
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Line Height</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.lineHeight}
                                placeholder="e.g. 1.4"
                                onChange={event => updateSelectedTextStyle('lineHeight', event.target.value)}
                              />
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Letter Spacing</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.letterSpacing}
                                placeholder="e.g. 0.04em"
                                onChange={event => updateSelectedTextStyle('letterSpacing', event.target.value)}
                              />
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Text Transform</span>
                              <select
                                className="platform-select"
                                value={selectedTextStyle.textTransform}
                                onChange={event => updateSelectedTextStyle('textTransform', event.target.value)}
                              >
                                <option value="">Keep original</option>
                                <option value="none">None</option>
                                <option value="uppercase">Uppercase</option>
                                <option value="lowercase">Lowercase</option>
                                <option value="capitalize">Capitalize</option>
                              </select>
                            </label>

                            {selectedTextItem.isAction ? (
                              <>
                                <label className="platform-field">
                                  <span className="platform-field-label">Background</span>
                                  <div className="platform-color-input">
                                    <input
                                      type="color"
                                      value={selectedTextStyle.backgroundColor || '#C9A84C'}
                                      onChange={event => updateSelectedTextStyle('backgroundColor', event.target.value)}
                                    />
                                    <input
                                      className="platform-input"
                                      type="text"
                                      value={selectedTextStyle.backgroundColor}
                                      placeholder="#C9A84C"
                                      onChange={event => updateSelectedTextStyle('backgroundColor', event.target.value)}
                                    />
                                  </div>
                                </label>

                                <label className="platform-field">
                                  <span className="platform-field-label">Border</span>
                                  <div className="platform-color-input">
                                    <input
                                      type="color"
                                      value={selectedTextStyle.borderColor || '#C9A84C'}
                                      onChange={event => updateSelectedTextStyle('borderColor', event.target.value)}
                                    />
                                    <input
                                      className="platform-input"
                                      type="text"
                                      value={selectedTextStyle.borderColor}
                                      placeholder="#C9A84C"
                                      onChange={event => updateSelectedTextStyle('borderColor', event.target.value)}
                                    />
                                  </div>
                                </label>
                              </>
                            ) : null}
                          </div>

                          <div className="platform-control-grid platform-control-grid--tight">
                            <label className="platform-field">
                              <span className="platform-field-label">Color</span>
                              <div className="platform-color-input">
                                <input
                                  type="color"
                                  value={selectedTextStyle.color || '#F2EDE4'}
                                  onChange={event => updateSelectedTextStyle('color', event.target.value)}
                                />
                                <input
                                  className="platform-input"
                                  type="text"
                                  value={selectedTextStyle.color}
                                  placeholder="#F2EDE4"
                                  onChange={event => updateSelectedTextStyle('color', event.target.value)}
                                />
                              </div>
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Align</span>
                              <div className="platform-segmented">
                                {['left', 'center', 'right'].map(option => (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`platform-segmented-btn ${selectedTextStyle.textAlign === option ? 'is-active' : ''}`}
                                    onClick={() => updateSelectedTextStyle('textAlign', option)}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </label>
                          </div>

                          {selectedTextItem.isAction ? (
                            <label className="platform-field">
                              <span className="platform-field-label">Shadow</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.boxShadow}
                                placeholder="e.g. 0 8px 24px rgba(0,0,0,0.18)"
                                onChange={event => updateSelectedTextStyle('boxShadow', event.target.value)}
                              />
                            </label>
                          ) : null}
                        </>
                      ) : null}

                      {inspectorTab === 'layout' && selectedTextItem.isAction ? (
                          <div className="platform-control-grid">
                            <label className="platform-field">
                              <span className="platform-field-label">Radius</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.borderRadius}
                                placeholder="e.g. 18px"
                                onChange={event => updateSelectedTextStyle('borderRadius', event.target.value)}
                              />
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Horizontal Padding</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.paddingInline}
                                placeholder="e.g. 24px"
                                onChange={event => updateSelectedTextStyle('paddingInline', event.target.value)}
                              />
                            </label>

                            <label className="platform-field">
                              <span className="platform-field-label">Vertical Padding</span>
                              <input
                                className="platform-input"
                                type="text"
                                value={selectedTextStyle.paddingBlock}
                                placeholder="e.g. 14px"
                                onChange={event => updateSelectedTextStyle('paddingBlock', event.target.value)}
                              />
                            </label>
                          </div>
                      ) : null}
                    </div>
                  ) : selectedImageItem ? (
                    <div id={`inspector-panel-${inspectorTab}`} role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`} className="platform-editor-controls">
                      <div className="platform-editor-selected">
                        <strong>{selectedImageItem.label}</strong>
                        <span>{selectedImageItem.sectionLabel} · IMAGE</span>
                      </div>

                      {inspectorTab === 'content' ? (
                        <>
                          <div className="platform-image-thumb">
                            <img src={imageValues[selectedImageItem.id] || selectedImageItem.src} alt={selectedImageStyle.alt || selectedImageItem.alt || ''} />
                          </div>
                          <label className="platform-field">
                            <span className="platform-field-label">Alt text</span>
                            <input className="platform-input" type="text" value={selectedImageStyle.alt} onChange={event => updateSelectedImageStyle('alt', event.target.value)} />
                          </label>
                          <button type="button" className="platform-primary-btn" onClick={triggerImageReplace}>
                            Replace image
                          </button>
                        </>
                      ) : null}

                      {inspectorTab === 'style' ? (
                        <>
                          <label className="platform-field">
                            <span className="platform-field-label">Fit</span>
                            <div className="platform-segmented">
                              {(['cover', 'contain', 'fill'] as const).map(option => (
                                <button key={option} type="button" className={`platform-segmented-btn ${selectedImageStyle.objectFit === option ? 'is-active' : ''}`} onClick={() => updateSelectedImageStyle('objectFit', option)}>
                                  {option}
                                </button>
                              ))}
                            </div>
                          </label>
                          <label className="platform-field">
                            <span className="platform-field-label">Position</span>
                            <div className="platform-segmented">
                              {(['top', 'center', 'bottom'] as const).map(option => (
                                <button key={option} type="button" className={`platform-segmented-btn ${selectedImageStyle.objectPosition === option ? 'is-active' : ''}`} onClick={() => updateSelectedImageStyle('objectPosition', option)}>
                                  {option}
                                </button>
                              ))}
                            </div>
                          </label>
                          <label className="platform-field">
                            <span className="platform-field-label">Radius</span>
                            <input className="platform-input" type="range" min="0" max="24" step="1" value={parseInt(selectedImageStyle.borderRadius || '0', 10) || 0} onChange={event => updateSelectedImageStyle('borderRadius', `${event.target.value}px`)} />
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div id={`inspector-panel-${inspectorTab}`} role="tabpanel" aria-labelledby={`inspector-tab-${inspectorTab}`} className="platform-editor-empty">
                      <strong>Select an object.</strong>
                      <span>Pick a section, text block, or image from the left rail or click the preview to edit it.</span>
                    </div>
                  )}
                </div>
              </aside>
            </section>
          ) : loaded ? (
            <section className="platform-empty">
              <h2>Nothing to edit yet.</h2>
              <p><Link href="/brief" className="platform-text-link">← Start a brief</Link></p>
            </section>
          ) : null}
          {generation?.html && editorModel ? (
            <div className="platform-mobile-editor-dock safe-bottom">
              <button type="button" className="platform-primary-btn" onClick={() => { setSidebarTab('content'); setMobileSheet('sections') }}>
                Sections
              </button>
              <button type="button" className="platform-secondary-btn" onClick={() => setMobileSheet('inspector')}>
                Inspector
              </button>
              <button type="button" className="platform-secondary-btn" onClick={() => { setSidebarTab('theme'); setMobileSheet('theme') }}>
                Theme
              </button>
            </div>
          ) : null}
        </main>
        {isFullscreenPreviewOpen && editorModel ? (
          <FullscreenPreviewOverlay
            html={buildEditedHtml(
              editorModel.annotatedHtml,
              textValues,
              textStyles,
              imageValues,
              imageStyles,
              sectionStyles,
              generation?.metadata?.palette?.accent || '#C9A84C',
              accentOverride,
            )}
            title="Edited preview"
            onClose={() => setIsFullscreenPreviewOpen(false)}
          />
        ) : null}
      </div>
    </BuilderErrorBoundary>
  )
}

export function PublishPage() {
  const [generation, setGeneration] = useState<GenerationSnapshot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const publishContextRef = useRef<EditorContext | null>(null)

  useEffect(() => {
    setGeneration(readStorage<GenerationSnapshot | null>(LAST_GENERATION_STORAGE_KEY, null))
    setLoaded(true)
  }, [])

  // Resolve the editor context for logging publish events. Runs once; null
  // result silently disables publish logging (anonymous user or no gen yet).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    getCurrentEditorContext(supabase)
      .then(ctx => {
        publishContextRef.current = ctx
      })
      .catch(() => {
        publishContextRef.current = null
      })
  }, [])

  function handleDownload() {
    if (!generation?.html) return
    downloadHtml(generation.html, generation.blueprint?.brandCore?.brandName || 'irie-page')
    const ctx = publishContextRef.current
    if (ctx) {
      const supabase = createSupabaseBrowserClient()
      void logPublish(supabase, ctx, generation.html)
    }
  }

  const htmlSize = generation?.html ? new Blob([generation.html], { type: 'text/html' }).size : 0

  return (
    <BuilderErrorBoundary>
      <BuilderPlatformStyles />
      <div className="platform-shell">
        <FlowHeader current="publish" backHref="/edit" backLabel="← Edit" />
        <main id={MAIN_CONTENT_ID} className="platform-page platform-page--placeholder">
          {generation?.html ? (
            <>
              <section className="platform-section-card">
                <div className="platform-section-head">
                  <span className="platform-kicker">Export</span>
                  <h2>Download the site and host it anywhere.</h2>
                </div>
                <div className="platform-publish-actions">
                  <button
                    type="button"
                    className="platform-primary-btn"
                    onClick={handleDownload}
                  >
                    Download HTML
                  </button>
                  <span className="platform-helper">File size: {formatFileSize(htmlSize)}</span>
                </div>
              </section>

              <section className="platform-section-card">
                <div className="platform-section-head">
                  <span className="platform-kicker">What you get</span>
                  <h2>An honest export for this pass.</h2>
                </div>
                <div className="platform-export-list">
                  <div className="platform-export-item">
                    <strong>Downloadable HTML</strong>
                    <span>Take the finished markup and host it on any static platform.</span>
                  </div>
                  <div className="platform-export-item">
                    <strong>Keep the design intact</strong>
                    <span>The export preserves your copy, styling, image swaps, and section refinements.</span>
                  </div>
                  <div className="platform-export-item">
                    <strong>Host it wherever you want</strong>
                    <span>Use the downloaded file with Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host you trust.</span>
                  </div>
                </div>
              </section>
            </>
          ) : loaded ? (
            <section className="platform-empty">
              <h2>Nothing to export yet.</h2>
              <p><Link href="/brief" className="platform-text-link">← Start a brief</Link></p>
            </section>
          ) : null}
        </main>
      </div>
    </BuilderErrorBoundary>
  )
}

const platformCss = `
  *,*::before,*::after{box-sizing:border-box}
  :root{
    --bg:#080808;
    --panel:#0f0f0f;
    --panel-2:#131313;
    --line:rgba(201,168,76,0.18);
    --gold:#C9A84C;
    --gold-soft:rgba(201,168,76,0.08);
    --gold-dim:rgba(201,168,76,0.15);
    --text:#F2EDE4;
    --cream:#F2EDE4;
    --muted:rgba(242,237,228,0.68);
    --muted-2:rgba(242,237,228,0.45);
    --danger:#E37272;
    --radius:6px;
    --radius-sm:4px;
    --radius-lg:10px;
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
    border-bottom:1px solid var(--line);
    background:rgba(8,8,8,0.96);
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
    padding:1rem 0 1.5rem;
  }

  .platform-page--dashboard,
  .platform-page--brief,
  .platform-page--placeholder{
    display:grid;
    gap:1.25rem;
  }

  .platform-page--brief{
    width:100%;
    max-width:860px;
    margin:0 auto;
    padding:1.5rem 24px 3rem;
    box-sizing:border-box;
  }

  .platform-page--generate{
    display:grid;
    grid-template-columns:220px minmax(0,1fr) 320px;
    gap:0.8rem;
    align-items:stretch;
    min-height:calc(100dvh - 8rem);
  }

  .platform-page--generate.platform-page--rail-collapsed{
    grid-template-columns:72px minmax(0,1fr) 56px;
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
    background:var(--panel);
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
    border-radius:6px;
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
    border-radius:6px;
    background:transparent;
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

  .platform-section-head--compact{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.8rem;
    margin-bottom:0.75rem;
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
    border-radius:6px;
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
    border-radius:6px;
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
    border-radius:8px;
    background:var(--panel-2);
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
    border-radius:8px;
    background:var(--panel-2);
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
    border-radius:8px;
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

  .platform-close-btn{
    border:none;
    background:none;
    color:var(--muted-2);
    padding:0.1rem;
    font:inherit;
    font-size:0.88rem;
    line-height:1;
    cursor:pointer;
  }

  .platform-close-btn:hover{
    color:var(--gold);
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
    border-radius:8px;
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
    display:grid;
    grid-template-rows:auto auto auto minmax(0,1fr);
    gap:0.9rem;
    padding:1rem;
    min-height:0;
    overflow:hidden;
  }

  .platform-agent-panel h1{
    font-size:clamp(1.35rem, 2vw, 2.1rem);
    line-height:1;
    margin:0.25rem 0 0.45rem;
  }

  .platform-agent-panel p{
    font-size:0.9rem;
    line-height:1.6;
  }

  .platform-agent-list{
    list-style:none;
    display:grid;
    gap:0.75rem;
    margin:0;
    padding:0;
    min-height:0;
    overflow:auto;
    padding-right:0.25rem;
  }

  .platform-agent-row{
    display:grid;
    grid-template-columns:18px minmax(0, 1fr) auto;
    gap:0.75rem;
    align-items:start;
    padding:0.9rem;
    border-radius:8px;
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
    grid-template-rows:auto auto minmax(0, 1fr);
    min-height:0;
  }

  .platform-toolbar{
    display:grid;
    gap:0.9rem;
    padding:1rem 1.15rem;
    border:1px solid var(--line);
    border-radius:10px;
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
    border-radius:8px;
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
    border-radius:10px;
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
    min-height:0;
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
    border-radius:10px;
    overflow:hidden;
    background:#050505;
    min-height:0;
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
    min-height:min(62dvh, 720px);
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
    padding:0.85rem;
    border:1px solid var(--line);
    border-radius:8px;
    background:rgba(255,255,255,0.03);
    align-content:start;
  }

  .platform-preview-frame--phone{
    min-height:min(48dvh, 420px);
    border-radius:8px;
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
    border-radius:8px;
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
    display:grid;
    grid-template-rows:auto minmax(0,1fr);
    padding:0.9rem;
    overflow:hidden;
    min-height:0;
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

  .platform-rail-body{
    display:grid;
    gap:0.75rem;
    min-height:0;
    overflow:auto;
    align-content:start;
    padding-right:0.2rem;
  }

  .platform-rail-toggle{
    width:36px;
    border-radius:6px;
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
    border-radius:8px;
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

  .platform-nav-right{
    display:flex;
    align-items:center;
    gap:0.9rem;
    flex-wrap:wrap;
    justify-content:flex-end;
  }

  .platform-flow-header{
    position:sticky;
    top:0;
    z-index:40;
    display:grid;
    grid-template-columns:1fr auto 1fr;
    gap:1rem;
    align-items:center;
    padding:1rem clamp(1rem, 3vw, 2.4rem);
    border-bottom:1px solid rgba(201,168,76,0.08);
    background:rgba(8,8,8,0.88);
    backdrop-filter:blur(8px);
  }

  .platform-flow-header > .platform-text-link{
    justify-self:start;
  }

  .platform-flow-header-actions{
    display:flex;
    justify-content:flex-end;
    min-width:140px;
  }

  .platform-flow-header-button-row{
    display:flex;
    gap:0.75rem;
    flex-wrap:wrap;
    justify-content:flex-end;
  }

  .platform-flow-indicator{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.55rem;
    flex-wrap:wrap;
  }

  .platform-flow-step{
    display:flex;
    align-items:center;
    gap:0.55rem;
    color:var(--muted-2);
    font-size:0.72rem;
    letter-spacing:0.14em;
    text-transform:uppercase;
  }

  .platform-flow-step.is-active{
    color:var(--gold);
  }

  .platform-flow-separator{
    color:rgba(201,168,76,0.3);
  }

  .platform-primary-btn--nav{
    padding:0.78rem 1.1rem;
    font-size:0.68rem;
  }

  .platform-project-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(260px, 320px));
    gap:1.1rem;
  }

  .platform-project-card{
    display:grid;
    gap:0.55rem;
    min-height:260px;
    padding:1.4rem;
    border-radius:10px;
    border:1px solid rgba(201,168,76,0.18);
    background:
      radial-gradient(circle at top right, rgba(201,168,76,0.14), transparent 38%),
      rgba(255,255,255,0.02);
    color:var(--text);
    text-decoration:none;
    box-shadow:var(--shadow);
    align-content:space-between;
  }

  .platform-project-card strong{
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.6rem;
  }

  .platform-project-card span:last-child{
    color:var(--muted);
    line-height:1.7;
  }

  .platform-project-plus{
    width:64px;
    height:64px;
    border-radius:8px;
    display:grid;
    place-items:center;
    font-size:2rem;
    color:#0A0A0A;
    background:var(--gold);
  }

  .platform-section-card--recent{
    overflow:hidden;
  }

  .platform-recent-layout{
    display:grid;
    grid-template-columns:minmax(0, 240px) minmax(0, 1fr);
    gap:1rem;
    align-items:stretch;
  }

  .platform-recent-thumb{
    min-height:180px;
    border-radius:8px;
    overflow:hidden;
    border:1px solid rgba(201,168,76,0.16);
    background:#050505;
  }

  .platform-preview-frame--thumb{
    height:180px;
    width:114%;
    border:none;
    transform:scale(0.88);
    transform-origin:top left;
  }

  .platform-recent-card{
    display:flex;
    flex-direction:column;
    gap:1rem;
    align-items:flex-start;
    padding:1rem 1.1rem;
    border-radius:8px;
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

  .platform-recent-label{
    color:var(--gold) !important;
    text-transform:uppercase;
    letter-spacing:0.18em;
    font-size:0.66rem !important;
  }

  .platform-recent-actions{
    display:flex;
    gap:0.9rem;
    flex-wrap:wrap;
    align-items:center;
  }

  .platform-brief-label-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0.35rem 0 0.15rem;
  }

  .platform-slider-grid--compact{
    grid-template-columns:repeat(5, minmax(0, 1fr));
    margin-top:1rem;
  }

  .platform-slider--compact{
    padding:0.85rem 0.9rem;
  }

  .platform-slider--compact .platform-slider-head{
    flex-direction:column;
    align-items:flex-start;
    gap:0.25rem;
  }

  .platform-clone-dropzone{
    display:grid;
    gap:0.85rem;
    padding:1rem;
    border-radius:10px;
    border:1px dashed rgba(201,168,76,0.28);
    background:rgba(255,255,255,0.02);
  }

  .platform-clone-dropzone > p{
    margin:0;
    color:var(--muted);
  }

  .platform-clone-input-row{
    display:grid;
    grid-template-columns:minmax(0, 1fr) auto;
    gap:0.8rem;
  }

  .platform-clone-result{
    display:grid;
    gap:0.9rem;
    padding:1rem;
    border-radius:8px;
    background:rgba(201,168,76,0.08);
    border:1px solid rgba(201,168,76,0.18);
  }

  .platform-error-inline{
    color:#F2A4A4;
    font-size:0.88rem;
  }

  .platform-accordion{
    border:1px solid rgba(201,168,76,0.16);
    border-radius:10px;
    background:rgba(255,255,255,0.02);
    overflow:hidden;
  }

  .platform-accordion.is-open{
    background:rgba(201,168,76,0.05);
    border-color:rgba(201,168,76,0.28);
  }

  .platform-accordion-toggle{
    width:100%;
    min-height:52px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    padding:1rem 1.15rem;
    border:none;
    background:none;
    color:var(--text);
    font:inherit;
    font-size:0.82rem;
    letter-spacing:0.18em;
    text-transform:uppercase;
    cursor:pointer;
  }

  .platform-accordion-body{
    padding:0 1.15rem 1.15rem;
  }

  .platform-build-card--sticky{
    position:sticky;
    bottom:1rem;
    z-index:20;
    border:1px solid rgba(201,168,76,0.2);
    border-radius:10px;
    background:rgba(10,10,10,0.94);
    backdrop-filter:blur(8px);
  }

  .platform-page--editor{
    display:grid;
    gap:1rem;
  }

  .platform-editor-layout{
    display:grid;
    grid-template-columns:220px minmax(0, 1fr) 300px;
    gap:1rem;
    min-height:calc(100dvh - 8.5rem);
  }

  .platform-editor-sidebar,
  .platform-editor-inspector,
  .platform-editor-preview{
    border:1px solid var(--line);
    border-radius:10px;
    background:
      linear-gradient(180deg, rgba(201,168,76,0.04), rgba(255,255,255,0.01)),
      var(--panel);
    box-shadow:var(--shadow);
  }

  .platform-editor-sidebar{
    display:grid;
    gap:0.75rem;
    padding:0.85rem;
    align-content:start;
    min-height:0;
    overflow:auto;
  }

  .platform-editor-header{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:0.8rem;
    padding:0.15rem 0.1rem 0.25rem;
  }

  .platform-editor-inspector{
    display:grid;
    gap:1rem;
    padding:1rem;
    align-content:start;
    min-height:0;
    overflow:hidden;
  }

  .platform-editor-inspector .platform-pill-row{
    position:sticky;
    top:0;
    z-index:2;
    padding-bottom:0.2rem;
    background:linear-gradient(180deg, rgba(10,10,10,0.96), rgba(10,10,10,0.82));
  }

  .platform-editor-panel{
    display:grid;
    gap:0.75rem;
    padding:0.85rem 0.9rem;
    border-radius:8px;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(201,168,76,0.12);
  }

  .platform-editor-workspace{
    display:grid;
    gap:0.3rem;
  }

  .platform-editor-workspace strong{
    font-family:'Playfair Display', Georgia, serif;
    font-size:1rem;
  }

  .platform-editor-workspace span{
    color:var(--muted);
    font-size:0.78rem;
  }

  .platform-editor-sections{
    display:grid;
    gap:0.65rem;
  }

  .platform-editor-section-group{
    display:grid;
    gap:0.4rem;
  }

  .platform-editor-section-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
  }

  .platform-editor-section-head strong{
    font-size:0.74rem;
    letter-spacing:0.1em;
    text-transform:uppercase;
  }

  .platform-editor-section-head span{
    color:var(--muted);
    font-size:0.7rem;
  }

  .platform-editor-list{
    display:grid;
    gap:0.45rem;
  }

  .platform-editor-item{
    width:100%;
    display:grid;
    gap:0.18rem;
    padding:0.62rem 0.72rem;
    text-align:left;
    color:var(--text);
    border-radius:6px;
    border:1px solid rgba(201,168,76,0.14);
    background:rgba(255,255,255,0.02);
    cursor:pointer;
  }

  .platform-editor-item.is-active{
    border-color:var(--gold);
    background:rgba(201,168,76,0.09);
  }

  .platform-editor-item strong{
    font-size:0.76rem;
    letter-spacing:0.04em;
    text-transform:none;
  }

  .platform-editor-item span{
    color:var(--muted);
    line-height:1.35;
    font-size:0.72rem;
  }

  .platform-color-card--editor{
    margin:0;
  }

  .platform-editor-preview{
    overflow:hidden;
    background:#050505;
    min-height:0;
  }

  .platform-editor-controls{
    display:grid;
    gap:0.85rem;
    min-height:0;
    overflow:auto;
    align-content:start;
    padding-right:0.2rem;
  }

  .platform-editor-selected{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.8rem;
    padding:0.75rem 0.9rem;
    border-radius:6px;
    border:1px solid rgba(201,168,76,0.14);
    background:rgba(255,255,255,0.02);
  }

  .platform-editor-selected strong{
    font-size:0.92rem;
    letter-spacing:0.08em;
    text-transform:uppercase;
  }

  .platform-editor-selected span{
    color:var(--muted);
    font-size:0.82rem;
    letter-spacing:0.12em;
    text-transform:uppercase;
  }

  .platform-control-grid{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:0.7rem;
  }

  .platform-control-grid--tight{
    grid-template-columns:1fr;
  }

  .platform-field{
    display:grid;
    gap:0.35rem;
  }

  .platform-field-label{
    color:var(--muted);
    font-size:0.76rem;
    letter-spacing:0.14em;
    text-transform:uppercase;
  }

  .platform-input,
  .platform-select,
  .platform-textarea{
    width:100%;
    border-radius:6px;
    border:1px solid rgba(201,168,76,0.14);
    background:rgba(255,255,255,0.03);
    color:var(--text);
    font:inherit;
    padding:0.72rem 0.85rem;
  }

  .platform-textarea{
    resize:vertical;
    min-height:96px;
    line-height:1.55;
  }

  .platform-input:focus,
  .platform-select:focus,
  .platform-textarea:focus{
    outline:none;
    border-color:rgba(201,168,76,0.46);
    box-shadow:0 0 0 1px rgba(201,168,76,0.22);
  }

  .platform-color-input{
    display:grid;
    grid-template-columns:56px minmax(0, 1fr);
    gap:0.65rem;
    align-items:center;
  }

  .platform-color-input input[type="color"]{
    width:56px;
    height:48px;
    border:none;
    border-radius:6px;
    background:none;
    padding:0;
    cursor:pointer;
  }

  .platform-segmented{
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:0.5rem;
  }

  .platform-segmented-btn{
    min-height:44px;
    border-radius:6px;
    border:1px solid rgba(201,168,76,0.14);
    background:rgba(255,255,255,0.02);
    color:var(--text);
    text-transform:capitalize;
    cursor:pointer;
  }

  .platform-segmented-btn.is-active{
    border-color:var(--gold);
    background:rgba(201,168,76,0.11);
  }

  .platform-editor-empty{
    display:grid;
    gap:0.55rem;
    padding:0.8rem 0.9rem;
    border-radius:6px;
    border:1px dashed rgba(201,168,76,0.18);
    color:var(--muted);
    line-height:1.6;
  }

  .platform-preview-frame--editor{
    width:100%;
    min-height:calc(100dvh - 10rem);
    border:none;
  }

  .platform-color-grid--editor{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }

  .platform-color-card--editor.is-readonly{
    gap:0.35rem;
    min-height:unset;
  }

  .platform-color-card--editor.is-readonly code{
    font-size:0.82rem;
  }

  .platform-section-card--workbench{
    min-height:0;
    overflow:auto;
  }

  .platform-history-item--error{
    border-color:rgba(227,114,114,0.22);
  }

  .platform-hidden-input{
    display:none;
  }

  .platform-publish-actions{
    display:grid;
    gap:0.7rem;
    justify-items:start;
  }

  .platform-code-card{
    padding:1rem;
    border-radius:8px;
    border:1px solid rgba(201,168,76,0.14);
    background:rgba(255,255,255,0.02);
    overflow:auto;
  }

  .platform-code-card code{
    color:var(--cream);
    font-size:0.92rem;
    white-space:pre-wrap;
    word-break:break-word;
  }

  .platform-section-card--muted{
    opacity:0.82;
  }

  .platform-page--brief .platform-section-card{
    padding:16px 20px;
  }

  .platform-page--brief .platform-section-head{
    margin-bottom:0.8rem;
  }

  .platform-page--brief .platform-accordion-toggle{
    padding:16px 20px;
  }

  .platform-page--brief .platform-accordion-body{
    padding:0 20px 16px;
  }

  .platform-page--brief .platform-build-card{
    padding:0.8rem 0 2rem;
  }

  .platform-page--brief .platform-slider-grid--compact{
    margin-top:0.8rem;
  }

  .platform-page--brief .platform-slider--compact{
    padding:0.75rem 0.85rem;
  }

  .platform-page--brief .platform-clone-dropzone{
    padding:0.9rem;
  }

  .platform-page--brief .platform-section-card--conversation{
    max-height:300px;
    overflow-y:auto;
  }

  .platform-page--brief .platform-chat-messages{
    max-height:160px;
  }

  .platform-status-chip{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:40px;
    padding:0.45rem 0.75rem;
    border:1px solid var(--line);
    border-radius:6px;
    background:rgba(201,168,76,0.04);
    color:var(--cream);
    font-size:0.78rem;
    letter-spacing:0.08em;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .platform-status-chip--offline,
  .platform-status-chip--local-only,
  .platform-status-chip--error{
    background:rgba(201,168,76,0.12);
  }

  .platform-dashboard-hero{
    display:grid;
    grid-template-columns:minmax(0, 1.6fr) minmax(280px, 0.8fr);
    gap:1rem;
  }

  .platform-dashboard-stats{
    display:grid;
    gap:0.8rem;
  }

  .platform-stat-card,
  .platform-project-card--studio{
    border:1px solid var(--line);
    border-radius:10px;
    background:var(--panel);
    padding:1rem;
  }

  .platform-stat-card span{
    color:var(--muted);
    font-size:0.8rem;
    text-transform:uppercase;
    letter-spacing:0.12em;
  }

  .platform-stat-card strong{
    display:block;
    margin-top:0.35rem;
    font-family:'Playfair Display', Georgia, serif;
    font-size:2rem;
  }

  .platform-project-grid--cards{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }

  .platform-project-thumb,
  .platform-image-thumb{
    overflow:hidden;
    border:1px solid rgba(201,168,76,0.12);
    border-radius:8px;
    background:#050505;
  }

  .platform-project-copy{
    display:grid;
    gap:0.45rem;
    margin-top:0.85rem;
  }

  .platform-project-meta{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
  }

  .platform-editor-layout{
    grid-template-columns:220px minmax(0,1fr) 320px;
    height:calc(100dvh - 9rem);
    overflow:hidden;
  }

  .platform-page--editor{
    height:calc(100dvh - 7rem);
    overflow:hidden;
  }

  .platform-editor-sidebar,
  .platform-editor-inspector{
    overflow-y:auto;
  }

  .platform-editor-preview{
    display:grid;
    grid-template-rows:auto minmax(0,1fr);
  }

  .platform-editor-preview-toolbar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.8rem;
    padding:0.75rem 0.9rem;
    border-bottom:1px solid var(--line);
  }

  .platform-editor-section-head{
    width:100%;
    padding:0.4rem 0;
    border:none;
    background:none;
    color:var(--cream);
    cursor:pointer;
    text-align:left;
  }

  .platform-editor-section-head.is-active{
    color:var(--gold);
  }

  .platform-preview-frame--editor{
    min-height:100%;
  }

  .platform-export-list{
    display:grid;
    gap:0.8rem;
  }

  .platform-export-item{
    display:grid;
    gap:0.3rem;
    padding:0.9rem 1rem;
    border:1px solid rgba(201,168,76,0.12);
    border-radius:8px;
    background:var(--panel-2);
  }

  .platform-image-thumb{
    min-height:160px;
  }

  .platform-image-thumb img{
    display:block;
    width:100%;
    height:160px;
    object-fit:cover;
  }

  .platform-fullscreen-overlay{
    position:fixed;
    inset:0;
    z-index:120;
    display:grid;
    grid-template-rows:auto minmax(0,1fr);
    background:rgba(8,8,8,0.94);
    padding:1rem;
  }

  .platform-fullscreen-bar{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    padding:0.75rem 0 1rem;
  }

  .platform-fullscreen-frame{
    width:100%;
    height:100%;
    border:none;
    border-radius:10px;
    background:#050505;
  }

  @media (max-width: 1200px){
    .platform-page--generate,
    .platform-page--generate.platform-page--rail-collapsed{
      grid-template-columns:1fr;
      min-height:auto;
    }

    .platform-agent-panel,
    .platform-decisions-rail{
      min-height:auto;
      overflow:visible;
    }

    .platform-decisions-rail--collapsed{
      padding:1rem;
    }

    .platform-desktop-preview{
      grid-template-columns:1fr;
    }

    .platform-slider-grid--compact,
    .platform-editor-layout,
    .platform-recent-layout{
      grid-template-columns:1fr;
      min-height:auto;
    }

    .platform-control-grid{
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }

    .platform-editor-sidebar,
    .platform-editor-inspector,
    .platform-editor-controls,
    .platform-rail-body,
    .platform-agent-list,
    .platform-section-card--workbench{
      overflow:visible;
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

    .platform-page--brief{
      width:100%;
      max-width:860px;
      padding:1.5rem 24px 3rem;
    }

    .platform-clone-input-row{
      grid-template-columns:1fr;
    }

    .platform-control-grid,
    .platform-segmented{
      grid-template-columns:1fr;
    }
  }

  @media (max-width: 768px){
    .platform-page--generate{
      display:flex;
      flex-direction:column;
    }

    .platform-generate-main{
      order:1;
    }

    .platform-agent-panel{
      order:2;
    }

    .platform-decisions-rail{
      order:3;
    }

    .platform-dashboard-hero,
    .platform-project-grid--cards{
      grid-template-columns:1fr;
    }
  }

  @media (max-width: 640px){
    .platform-nav{
      align-items:flex-start;
      flex-direction:column;
    }

    .platform-flow-header{
      grid-template-columns:1fr;
      justify-items:start;
    }

    .platform-nav-links{
      width:100%;
    }

    .platform-nav-right{
      width:100%;
    }

    .platform-flow-header-actions{
      width:100%;
      justify-content:flex-start;
      min-width:0;
    }

    .platform-flow-header-button-row{
      width:100%;
      justify-content:flex-start;
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

    .platform-editor-preview{
      order:1;
      min-height:360px;
    }

    .platform-editor-sidebar{
      order:2;
    }

    .platform-editor-inspector{
      order:3;
    }
  }

  @media (max-width: 480px){
    /* iOS zoom prevention. .platform-input / .platform-textarea use font:inherit
       which can erase the globals.css max(16px, 1rem) safeguard — pin it here. */
    .platform-input,
    .platform-textarea{
      font-size:16px;
    }

    /* Brief page — accordion rows, pills, flow indicator, sticky CTA */
    .platform-accordion-toggle{
      min-height:44px;
    }

    .platform-chip-grid,
    .platform-pill-row{
      flex-wrap:nowrap;
      overflow-x:auto;
      -webkit-overflow-scrolling:touch;
      padding-bottom:0.5rem;
      scroll-snap-type:x proximity;
    }
    .platform-chip-grid > *,
    .platform-pill-row > *{
      flex:0 0 auto;
      scroll-snap-align:start;
    }

    .platform-flow-indicator{
      overflow-x:auto;
      -webkit-overflow-scrolling:touch;
      white-space:nowrap;
      scrollbar-width:none;
    }
    .platform-flow-indicator::-webkit-scrollbar{
      display:none;
    }

    .platform-page--brief .platform-build-card--sticky{
      bottom:0;
      margin-left:-20px;
      margin-right:-20px;
      border-radius:0;
      border-left:none;
      border-right:none;
      padding-left:20px;
      padding-right:20px;
      padding-bottom:calc(1rem + env(safe-area-inset-bottom, 0px));
    }
    .platform-page--brief .platform-build-card--sticky .platform-primary-btn{
      width:100%;
      min-height:48px;
    }

    /* Generate page — stack order: preview first, then agents, then decisions.
       Preview iframe fills the viewport width with no side padding. */
    .platform-page--generate .platform-editor-preview,
    .platform-page--generate .platform-desktop-preview{
      order:1;
    }
    .platform-page--generate .platform-agent-panel{
      order:2;
    }
    .platform-page--generate .platform-decisions-rail{
      order:3;
    }
    .platform-page--generate .platform-preview-frame{
      margin-left:-20px;
      margin-right:-20px;
      width:calc(100% + 40px);
      border-radius:0;
    }

    /* Edit page — stack sidebar under iframe + subtle desktop nudge via ::before
       so we don't change the DOM. Existing text / accent edits still work. */
    .platform-editor-layout{
      display:flex;
      flex-direction:column;
    }
    .platform-editor-layout::before{
      content:"Mobile review mode is active. For the full editing stack, switch to desktop.";
      order:0;
      display:block;
      padding:0.75rem 1rem;
      border:1px solid var(--line);
      border-radius:10px;
      background:var(--gold-soft);
      color:var(--muted);
      font-size:13px;
      line-height:1.45;
      letter-spacing:0.02em;
    }
    .platform-editor-preview{
      order:1;
      min-height:360px;
    }
    .platform-editor-sidebar{
      order:2;
    }
    .platform-editor-item{
      min-height:44px;
    }
    .platform-color-card--editor{
      min-height:48px;
    }
    .platform-color-card--editor input[type="color"]{
      width:44px;
      height:44px;
    }

    /* Publish page — stacked actions, scrollable code block */
    .platform-publish-actions{
      flex-direction:column;
      align-items:stretch;
    }
    .platform-publish-actions > *{
      width:100%;
    }
    .platform-code-card{
      overflow-x:auto;
      -webkit-overflow-scrolling:touch;
    }
  }

  /* Irie overhaul overrides */
  :root{
    --panel:#101010;
    --panel-2:#141414;
    --gold-soft:rgba(201,168,76,0.06);
    --gold-dim:rgba(201,168,76,0.12);
    --radius:6px;
  }

  .platform-shell{
    background:
      radial-gradient(circle at top right, rgba(201,168,76,0.08), transparent 24%),
      radial-gradient(circle at bottom left, rgba(201,168,76,0.05), transparent 20%),
      var(--bg);
  }

  .platform-hero-card,
  .platform-section-card,
  .platform-toolbar,
  .platform-preview-panel,
  .platform-preview-single,
  .platform-loading-stage,
  .platform-empty,
  .platform-project-card--studio,
  .platform-stat-card,
  .platform-accordion,
  .platform-editor-sidebar,
  .platform-editor-inspector,
  .platform-editor-preview,
  .platform-editor-panel,
  .platform-color-card,
  .platform-clone-dropzone,
  .platform-clone-result,
  .platform-history-item,
  .platform-rail-card,
  .platform-mobile-card,
  .platform-export-item,
  .platform-status-strip{
    border-radius:6px;
    box-shadow:none;
    backdrop-filter:none;
  }

  .platform-toolbar,
  .platform-loading-stage,
  .platform-empty,
  .platform-color-card,
  .platform-clone-dropzone,
  .platform-editor-panel,
  .platform-mobile-card,
  .platform-export-item,
  .platform-stat-card,
  .platform-project-card--studio{
    background:var(--panel);
  }

  .platform-pill,
  .platform-chip,
  .platform-segmented-btn,
  .platform-editor-item,
  .platform-status-chip{
    border-radius:6px;
  }

  .platform-toolbar{
    border-color:var(--line);
  }

  .platform-status-chip{
    min-height:44px;
    background:rgba(201,168,76,0.04);
  }

  .platform-status-chip--offline,
  .platform-status-chip--local-only,
  .platform-status-chip--error{
    background:rgba(201,168,76,0.16);
    color:var(--gold);
  }

  .platform-flow-tablist{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.55rem;
    flex-wrap:wrap;
  }

  .platform-page--generate{
    position:relative;
    display:block;
    padding:1rem 0 2rem;
  }

  .platform-generate-main{
    grid-template-rows:auto auto auto auto;
  }

  .platform-preview-stage{
    display:grid;
    min-height:min(72dvh, 920px);
  }

  .platform-empty--preview,
  .platform-loading-stage--preview{
    min-height:min(72dvh, 920px);
    align-content:center;
    justify-items:center;
    text-align:center;
  }

  .platform-preview-stage-copy{
    display:grid;
    gap:0.65rem;
    max-width:42rem;
  }

  .platform-preview-stage-copy h2{
    margin:0;
    font-family:'Playfair Display', Georgia, serif;
    font-size:clamp(1.8rem, 4vw, 3rem);
    line-height:0.98;
  }

  .platform-toolbar--generate{
    padding:0.9rem 1rem;
  }

  .platform-status-strip{
    display:grid;
    gap:0.85rem;
    padding:0.9rem 1rem;
    border:1px solid var(--line);
  }

  .platform-status-strip-copy{
    display:grid;
    gap:0.35rem;
  }

  .platform-status-strip-copy strong{
    font-family:'Playfair Display', Georgia, serif;
    font-size:1.25rem;
    color:var(--cream);
  }

  .platform-status-strip-copy span:last-child{
    color:var(--muted);
    line-height:1.65;
    font-size:0.92rem;
  }

  .platform-status-strip-list{
    list-style:none;
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));
    gap:0.6rem;
    margin:0;
    padding:0;
  }

  .platform-status-pill{
    display:grid;
    gap:0.2rem;
    padding:0.75rem 0.85rem;
    border:1px solid rgba(201,168,76,0.16);
    border-radius:6px;
    background:var(--panel-2);
  }

  .platform-status-pill span{
    color:var(--muted);
    font-size:0.7rem;
    letter-spacing:0.12em;
    text-transform:uppercase;
  }

  .platform-status-pill strong{
    color:var(--cream);
    font-size:0.86rem;
    text-transform:capitalize;
  }

  .platform-status-pill--working{
    border-color:rgba(201,168,76,0.34);
    background:rgba(201,168,76,0.08);
  }

  .platform-status-pill--done strong{
    color:var(--gold);
  }

  .platform-drawer-backdrop{
    position:fixed;
    inset:0;
    z-index:94;
    border:none;
    background:rgba(0,0,0,0.4);
  }

  .platform-decisions-rail{
    position:fixed;
    top:5.5rem;
    right:1rem;
    bottom:1rem;
    width:min(320px, calc(100vw - 2rem));
    z-index:95;
    border:1px solid var(--line);
    border-radius:6px;
    background:rgba(8,8,8,0.98);
    transform:translateX(calc(100% + 1rem));
    transition:transform 180ms ease;
    box-shadow:none;
  }

  .platform-decisions-rail--open{
    transform:translateX(0);
  }

  .platform-decisions-rail--collapsed{
    pointer-events:none;
  }

  .platform-rail-toggle{
    width:44px;
    min-height:44px;
  }

  .platform-editor-header-actions{
    display:flex;
    align-items:center;
    gap:0.75rem;
  }

  .platform-sheet-close{
    display:none;
    min-height:44px;
    border:1px solid var(--line);
    border-radius:6px;
    background:transparent;
    color:var(--gold);
    padding:0.7rem 0.9rem;
    text-transform:uppercase;
    letter-spacing:0.12em;
    font-size:0.7rem;
    cursor:pointer;
  }

  .platform-editor-preview-head{
    display:grid;
    gap:0.3rem;
  }

  .platform-mobile-review-note{
    display:none;
    color:var(--muted);
    font-size:0.78rem;
    line-height:1.45;
  }

  .platform-mobile-editor-dock{
    display:none;
  }

  .platform-editor-sidebar,
  .platform-editor-inspector,
  .platform-editor-preview{
    border-radius:6px;
    background:var(--panel);
  }

  .platform-editor-item{
    min-height:44px;
  }

  .platform-editor-selected{
    border-radius:6px;
    background:var(--panel-2);
  }

  @media (max-width: 900px){
    .platform-preview-stage{
      min-height:min(62dvh, 760px);
    }
  }

  @media (max-width: 768px){
    .platform-toolbar--generate{
      order:2;
    }

    .platform-status-strip{
      order:3;
    }

    .platform-section-card--workbench{
      order:4;
    }
  }

  @media (max-width: 640px){
    .platform-flow-tablist{
      justify-content:flex-start;
    }

    .platform-preview-stage{
      min-height:min(60dvh, 680px);
    }

    .platform-page--generate .platform-preview-frame{
      margin-left:0;
      margin-right:0;
      width:100%;
      border-radius:0;
    }

    .platform-decisions-rail{
      top:auto;
      left:0.75rem;
      right:0.75rem;
      bottom:0.75rem;
      width:auto;
      max-height:min(78dvh, 680px);
    }

    .platform-page--editor{
      height:auto;
      overflow:visible;
      padding-bottom:5.5rem;
    }

    .platform-editor-layout{
      display:block;
      height:auto;
      min-height:0;
      overflow:visible;
    }

    .platform-editor-layout::before{
      content:none;
    }

    .platform-editor-preview{
      min-height:calc(100dvh - 15rem);
    }

    .platform-editor-preview-toolbar{
      align-items:flex-start;
    }

    .platform-mobile-review-note{
      display:block;
    }

    .platform-editor-sidebar,
    .platform-editor-inspector{
      position:fixed;
      left:0.75rem;
      right:0.75rem;
      bottom:0;
      top:auto;
      max-height:min(78dvh, 680px);
      z-index:130;
      transform:translateY(calc(100% + 1rem));
      transition:transform 180ms ease;
      overflow:auto;
      border-radius:8px 18px 0 0;
      padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
    }

    .platform-editor-sidebar.is-mobile-open,
    .platform-editor-inspector.is-mobile-open{
      transform:translateY(0);
    }

    .platform-sheet-close{
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    .platform-mobile-editor-dock{
      position:fixed;
      left:0;
      right:0;
      bottom:0;
      z-index:125;
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:0.6rem;
      padding:0.75rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
      border-top:1px solid var(--line);
      background:rgba(8,8,8,0.98);
    }

    .platform-mobile-editor-dock .platform-primary-btn,
    .platform-mobile-editor-dock .platform-secondary-btn{
      width:100%;
      padding-inline:0.6rem;
    }

    .platform-drawer-backdrop--mobile{
      z-index:120;
    }
  }
`
