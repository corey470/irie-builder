import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildDesignSystemBlock } from '@/lib/designSystemPrompt'

export const runtime = 'nodejs'
export const maxDuration = 60

interface GenerateRequest {
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
  designDirection: 'auto' | 'nike' | 'apple' | 'vercel' | 'stripe' | 'framer' | 'notion' | 'spotify'
  styleBlend?: string
  referenceStyles?: string[]
  emotionalControls?: {
    authority: number
    desire: number
    warmth: number
    tension: number
    spectacle: number
  }
  sectionFocus?: string
  revisionDirective?: string
  carryForwardLocks?: string[]
  userFeedback?: string
  rawBrief?: string
  /**
   * Optional: override the platform's own DESIGN.md with the calling
   * platform's design system. Used by downstream proxies (e.g. Irie Threads
   * via /api/build-page) so that generated pages match the caller's brand,
   * not this builder's own brand.
   */
  brandDesignSystem?: string
}

interface CreativeDecision {
  label: string
  value: string
  reason: string
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

const PSYCHOLOGY_LAYER = `Psychology rules that must shape every output:
- Trust before ask: show value, proof, or feeling before any hard CTA.
- Momentum over friction: every section should naturally pull into the next.
- Specificity builds trust: replace generic adjectives with facts, scenes, or real constraints.
- Use real scarcity only when it is believable.
- Place proof where fear happens, especially near CTA moments.
- Follow the emotion sequence: recognition -> curiosity -> desire -> trust -> action.
- Voice should feel human, direct, and real. If it sounds like marketing sludge, rewrite it.
- Motion should reward attention. Every reveal should feel like discovering something.
- The page should feel like a story, not a stack of blocks.`

const DESIGN_DIRECTION_PROFILES: Record<Exclude<GenerateRequest['designDirection'], 'auto'>, {
  label: string
  mood: string
  typography: string
  layout: string
  motion: string
  notes: string
}> = {
  nike: {
    label: 'Nike-inspired',
    mood: 'high-contrast, image-led, athletic, assertive',
    typography: 'massive uppercase display type, compressed confidence, minimal secondary copy',
    layout: 'full-bleed photography, bold section breaks, hard visual pacing, product and identity first',
    motion: 'kinetic reveals, sharp transitions, momentum-heavy scroll energy',
    notes: 'Use as streetwear/sport/culture energy. Do not copy Nike literally. Translate that power into an original brand system.',
  },
  apple: {
    label: 'Apple-inspired',
    mood: 'premium, restrained, cinematic, polished',
    typography: 'clean display hierarchy, elegant restraint, ultra-legible body copy',
    layout: 'whitespace, centered focus, product hero framing, calm section rhythm',
    motion: 'subtle cinematic transitions, premium fades, softened depth',
    notes: 'Use for premium product storytelling and quiet confidence.',
  },
  vercel: {
    label: 'Vercel-inspired',
    mood: 'technical, sharp, black-and-white precision',
    typography: 'modern sans, crisp hierarchy, concise messaging',
    layout: 'editorial grids, terminal-like confidence, disciplined spacing',
    motion: 'restrained but intelligent, precise transitions, no fluff',
    notes: 'Use for technical products, developer tools, and high-confidence product marketing.',
  },
  stripe: {
    label: 'Stripe-inspired',
    mood: 'product-led, elegant, premium SaaS',
    typography: 'lighter refined headings, polished support copy, conversion-aware hierarchy',
    layout: 'smooth flow, polished card systems, premium conversion sections',
    motion: 'soft depth, elevated scroll reveals, controlled polish',
    notes: 'Use for conversion-driven products that still need elegance.',
  },
  framer: {
    label: 'Framer-inspired',
    mood: 'design-forward, motion-rich, bold and contemporary',
    typography: 'large display type, strong contrast, high visual confidence',
    layout: 'expressive hero sections, strong modular rhythm, dramatic pacing',
    motion: 'noticeable, immersive, design-led motion system',
    notes: 'Use when the site itself should feel like the product demo.',
  },
  notion: {
    label: 'Notion-inspired',
    mood: 'warm, clear, soft, reading-first',
    typography: 'calm hierarchy, generous readability, understated display moments',
    layout: 'quiet structure, comfortable sections, helpful framing',
    motion: 'minimal, supportive, subtle reveal pacing',
    notes: 'Use when trust, warmth, and clarity matter more than spectacle.',
  },
  spotify: {
    label: 'Spotify-inspired',
    mood: 'dark, youth-forward, culture-heavy, immersive',
    typography: 'bold type, punchy section labels, high-energy rhythm',
    layout: 'immersive cards, dark surfaces, culture-first hero treatment',
    motion: 'ambient movement, album-art-like pacing, energetic reveals',
    notes: 'Use for culture brands, music-adjacent products, and youth-driven identity sites.',
  },
}

const REFERENCE_STYLE_PROFILES: Record<string, {
  label: string
  mood: string
  typography: string
  layout: string
  motion: string
  notes: string
}> = {
  linear: {
    label: 'Linear-inspired',
    mood: 'dense, sleek, disciplined, product-confident',
    typography: 'sharp sans hierarchy with compact confidence and clean rhythm',
    layout: 'tight editorial grids, product screenshots, dark precision, zero wasted space',
    motion: 'restrained but premium, slide-like reveals, product-first movement',
    notes: 'Use when the brand needs modern software confidence without losing polish.',
  },
  supabase: {
    label: 'Supabase-inspired',
    mood: 'developer-friendly, open-source warmth, technical clarity',
    typography: 'clean sans with approachable code-tool energy',
    layout: 'balanced dark surfaces, practical structure, friendly product explanation',
    motion: 'subtle utility-led transitions with soft glow accents',
    notes: 'Good for technical brands that still want warmth and accessibility.',
  },
  raycast: {
    label: 'Raycast-inspired',
    mood: 'glossy, utility-rich, modern, dark premium',
    typography: 'crisp sans with compact, high-end software polish',
    layout: 'glass-adjacent depth, dark gradients, sleek utility framing',
    motion: 'fast, glossy, command-centered movement',
    notes: 'Use for tool-like products that should feel elite and current.',
  },
  cursor: {
    label: 'Cursor-inspired',
    mood: 'AI-native, dark, developer-sharp, minimal',
    typography: 'clean sans with editorial code-tool restraint',
    layout: 'dark spacious layouts with high-clarity content hierarchy',
    motion: 'quiet, precise, intelligence-signaling motion',
    notes: 'Use for AI tools, code products, and products that need modern technical edge.',
  },
  claude: {
    label: 'Claude-inspired',
    mood: 'thoughtful, warm, editorial, calm intelligence',
    typography: 'reading-friendly serif-sans pairing with human warmth',
    layout: 'airy editorial structure, warm surfaces, clear conversational flow',
    motion: 'gentle page-turn pacing and low-pressure reveals',
    notes: 'Use for thoughtful brands, editorial experiences, and human-centered AI products.',
  },
  airbnb: {
    label: 'Airbnb-inspired',
    mood: 'hospitality-led, lifestyle-rich, warm, trustworthy',
    typography: 'friendly modern sans with lifestyle confidence',
    layout: 'large photography moments, soft cards, trust-first storytelling',
    motion: 'welcoming transitions and calm depth shifts',
    notes: 'Use for experience brands, hospitality, travel, and trust-heavy consumer products.',
  },
  figma: {
    label: 'Figma-inspired',
    mood: 'creative, collaborative, bright-minded, product-forward',
    typography: 'playful but disciplined modern sans',
    layout: 'colorful systems, modular product storytelling, collaborative energy',
    motion: 'snappy, creative, system-revealing motion',
    notes: 'Use for creative tools and brands that need lively system confidence.',
  },
  runwayml: {
    label: 'Runway-inspired',
    mood: 'cinematic, experimental, art-tech, media-native',
    typography: 'elevated display type with dramatic editorial support text',
    layout: 'immersive frames, media-led storytelling, strong contrast',
    motion: 'cinematic sweeps, dramatic reveals, trailer-like pacing',
    notes: 'Use when visual drama, film energy, or art-tech tension matters.',
  },
  spacex: {
    label: 'SpaceX-inspired',
    mood: 'monumental, black-and-white, futuristic, high-gravity',
    typography: 'commanding uppercase display with stark support hierarchy',
    layout: 'giant image fields, stark contrast, monumental pacing',
    motion: 'slow-build gravitas with decisive transitions',
    notes: 'Use for brands that need scale, ambition, and mission-driven intensity.',
  },
  uber: {
    label: 'Uber-inspired',
    mood: 'urban, sharp, efficient, system-confident',
    typography: 'compressed modern sans with direct utility-first clarity',
    layout: 'grid-led, pragmatic, high-contrast, city-energy framing',
    motion: 'quick and efficient, never ornamental',
    notes: 'Use for logistics, urban consumer products, and system-heavy brands.',
  },
  ferrari: {
    label: 'Ferrari-inspired',
    mood: 'luxury heat, prestige, velocity, controlled drama',
    typography: 'elegant display with assertive modern support type',
    layout: 'large product hero moments, premium spacing, selective intensity',
    motion: 'measured drama with moments of acceleration',
    notes: 'Use for luxury brands that need passion and restraint together.',
  },
  lamborghini: {
    label: 'Lamborghini-inspired',
    mood: 'aggressive luxury, angular intensity, dark glamour',
    typography: 'hard-edged display hierarchy with high-drama contrast',
    layout: 'dark cinematic framing, sharp diagonals, dramatic product presence',
    motion: 'explosive reveals and hard-cut pacing',
    notes: 'Use when the brand should feel dangerous, premium, and loud in a controlled way.',
  },
  pinterest: {
    label: 'Pinterest-inspired',
    mood: 'visual discovery, playful curation, image-first inspiration',
    typography: 'friendly editorial sans with soft hierarchy',
    layout: 'image-led curation, masonry-like discovery energy, visual browsing',
    motion: 'light discovery motion and encouraging reveals',
    notes: 'Use for visually driven discovery brands, inspiration products, and galleries.',
  },
  webflow: {
    label: 'Webflow-inspired',
    mood: 'design-system confidence, premium web craft, polished boldness',
    typography: 'strong display sans with crisp web-native support copy',
    layout: 'bold showcase sections, polished grids, premium feature framing',
    motion: 'high-end web motion with clear structure',
    notes: 'Use when the site itself needs to feel expertly crafted and modern.',
  },
  notion: DESIGN_DIRECTION_PROFILES.notion,
  vercel: DESIGN_DIRECTION_PROFILES.vercel,
  stripe: DESIGN_DIRECTION_PROFILES.stripe,
  apple: DESIGN_DIRECTION_PROFILES.apple,
  nike: DESIGN_DIRECTION_PROFILES.nike,
  spotify: DESIGN_DIRECTION_PROFILES.spotify,
}

function inferDesignDirection(input: string, pageType: string): GenerateRequest['designDirection'] {
  const text = `${input} ${pageType}`.toLowerCase()

  if (/(streetwear|drop|culture|sneaker|athletic|sport)/.test(text)) return 'nike'
  if (/(premium|luxury|minimal|refined|timeless|product launch)/.test(text)) return 'apple'
  if (/(developer|technical|saas|platform|api|infrastructure)/.test(text)) return 'vercel'
  if (/(conversion|fintech|payments|polished saas|startup)/.test(text)) return 'stripe'
  if (/(creative|agency|portfolio|motion|immersive|experimental)/.test(text)) return 'framer'
  if (/(editorial|calm|soft|journal|reading|warm)/.test(text)) return 'notion'
  if (/(music|festival|event|club|artist|youth)/.test(text)) return 'spotify'

  return pageType === 'store' ? 'nike' : 'framer'
}

function buildReferenceStylesSection(referenceStyles: string[] | undefined): string {
  if (!referenceStyles || referenceStyles.length === 0) return ''

  const lines = referenceStyles
    .map(style => {
      const profile = REFERENCE_STYLE_PROFILES[style]
      if (!profile) return null
      return `- ${profile.label}
  - Mood: ${profile.mood}
  - Typography: ${profile.typography}
  - Layout: ${profile.layout}
  - Motion: ${profile.motion}
  - Notes: ${profile.notes}`
    })
    .filter(Boolean)

  if (lines.length === 0) return ''

  return `\nReference Style Library:
Use these as secondary creative ingredients to enrich the page. Blend them intentionally, never literally.
${lines.join('\n')}`
}

function buildEmotionalControlsSection(emotionalControls: GenerateRequest['emotionalControls']): string {
  if (!emotionalControls) return ''

  return `\nEmotional Controls:
- Authority: ${emotionalControls.authority}/100
- Desire: ${emotionalControls.desire}/100
- Warmth: ${emotionalControls.warmth}/100
- Tension: ${emotionalControls.tension}/100
- Spectacle: ${emotionalControls.spectacle}/100

Interpret these as direction weights for the output.`
}

function buildDirectingPassSection(sectionFocus?: string, revisionDirective?: string): string {
  if (!sectionFocus && !revisionDirective) return ''

  return `\nDirecting Pass:
- Section Focus: ${sectionFocus || 'whole-page'}
- Creative Note: ${revisionDirective || 'None'}

Treat this like a focused creative review. Preserve what is already working and push the targeted area harder.`
}

function buildCarryForwardSection(carryForwardLocks?: string[]): string {
  if (!carryForwardLocks || carryForwardLocks.length === 0) return ''

  return `\nCarry Forward Locks:
- Locked Systems: ${carryForwardLocks.join(', ')}

These systems are already considered strong. Preserve their spirit, structure, and overall direction while improving the rest of the page around them.`
}

function parseJsonObject<T>(input: string): T | null {
  const trimmed = input.trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
}

function createFallbackBlueprint(params: {
  body: GenerateRequest
  category: string
  resolvedDirection: GenerateRequest['designDirection']
  referenceStyles: string[]
}): GenerationBlueprint {
  const { body, category, resolvedDirection, referenceStyles } = params
  const brandName = body.brandName || 'Untitled Brand'
  const directionLabel = resolvedDirection === 'auto'
    ? 'Auto-selected'
    : DESIGN_DIRECTION_PROFILES[resolvedDirection].label
  const emotionalControls = body.emotionalControls || {
    authority: 70,
    desire: 75,
    warmth: 55,
    tension: 65,
    spectacle: 70,
  }
  const intensity =
    emotionalControls.spectacle >= 80 || emotionalControls.tension >= 80
      ? 'explosive'
      : emotionalControls.spectacle >= 65 || emotionalControls.tension >= 65
        ? 'cinematic'
        : emotionalControls.warmth >= 70
          ? 'subtle'
          : 'editorial'

  return {
    brandCore: {
      brandName,
      brandVoice: 'Warm, direct, specific, and alive.',
      emotionalPromise: body.vibe || body.rawBrief || 'Make the visitor feel like they found something real.',
      audienceLens: body.audience || `People drawn to ${category} culture and strong point of view.`,
    },
    storyArc: [
      { stage: 'recognition', objective: 'Make the visitor feel seen immediately.', execution: 'Lead with a strong emotional hit and unmistakable brand tone.' },
      { stage: 'curiosity', objective: 'Reward the first scroll.', execution: 'Reveal what makes the brand different with visual contrast and specificity.' },
      { stage: 'desire', objective: 'Create want.', execution: 'Put the hero product or offer in a high-intensity spotlight.' },
      { stage: 'trust', objective: 'Remove doubt.', execution: 'Use specificity, process, and proof right before the ask.' },
      { stage: 'action', objective: 'Make action feel inevitable.', execution: 'Close with a clear CTA that feels earned.' },
    ],
    designSystem: {
      primaryDirection: directionLabel,
      supportingDirections: referenceStyles,
      typographyStrategy: 'Big display type with support copy that feels human, not corporate.',
      paletteStrategy: `Build from ${body.colors.primary}, ${body.colors.accent}, and ${body.colors.background} with stronger contrast where emotion needs it.`,
      layoutRhythm: 'Alternate compression and release so each scroll feels like a reveal.',
    },
    motionSystem: {
      intensity,
      style: 'Motion should feel like page turns and reward attention.',
      revealBehavior: 'Use staggered reveals and atmosphere shifts to pace the story.',
      atmosphere: 'Subtle orbs, grain, and directional movement that reinforce the mood.',
    },
    persuasionSystem: {
      trustStrategy: 'Show specificity before the ask and place proof where hesitation appears.',
      proofPlacement: 'Near product conviction moments and directly above the final CTA.',
      ctaStrategy: 'One dominant action that lands after enough emotional setup.',
      specificityNotes: 'Replace generic premium language with scenes, process, and believable constraints.',
    },
    sections: [
      { id: 'hero', role: 'Feeling hit', heading: body.headline || 'Feel it first', purpose: 'Deliver recognition fast.', contentDirection: 'Large image-led hero with emotional copy and strong contrast.' },
      { id: 'difference', role: 'Brand distinction', heading: 'Why it hits different', purpose: 'Create curiosity.', contentDirection: 'Show process, quality, or philosophy with specifics.' },
      { id: 'feature', role: 'Desire engine', heading: 'What they want', purpose: 'Turn curiosity into desire.', contentDirection: 'Spotlight the offer with a strong visual and concise copy.' },
      { id: 'truth', role: 'Trust layer', heading: 'What makes it real', purpose: 'Build belief.', contentDirection: 'Use craft, process, origin, or proof.' },
      { id: 'cta', role: 'Close', heading: body.ctaText || 'Take the next step', purpose: 'Drive action.', contentDirection: 'Strong final CTA with low friction and clear emotional continuation.' },
    ],
  }
}

function blueprintToPromptSection(blueprint: GenerationBlueprint): string {
  const story = blueprint.storyArc
    .map(step => `- ${step.stage.toUpperCase()}: ${step.objective} | ${step.execution}`)
    .join('\n')
  const sections = blueprint.sections
    .map(section => `- ${section.id}: ${section.heading} | ${section.role} | ${section.purpose} | ${section.contentDirection}`)
    .join('\n')

  return `\nGeneration Blueprint:
Brand Core:
- Brand Name: ${blueprint.brandCore.brandName}
- Brand Voice: ${blueprint.brandCore.brandVoice}
- Emotional Promise: ${blueprint.brandCore.emotionalPromise}
- Audience Lens: ${blueprint.brandCore.audienceLens}

Story Arc:
${story}

Design System:
- Primary Direction: ${blueprint.designSystem.primaryDirection}
- Supporting Directions: ${blueprint.designSystem.supportingDirections.join(', ') || 'None'}
- Typography Strategy: ${blueprint.designSystem.typographyStrategy}
- Palette Strategy: ${blueprint.designSystem.paletteStrategy}
- Layout Rhythm: ${blueprint.designSystem.layoutRhythm}

Motion System:
- Intensity: ${blueprint.motionSystem.intensity}
- Style: ${blueprint.motionSystem.style}
- Reveal Behavior: ${blueprint.motionSystem.revealBehavior}
- Atmosphere: ${blueprint.motionSystem.atmosphere}

Persuasion System:
- Trust Strategy: ${blueprint.persuasionSystem.trustStrategy}
- Proof Placement: ${blueprint.persuasionSystem.proofPlacement}
- CTA Strategy: ${blueprint.persuasionSystem.ctaStrategy}
- Specificity Notes: ${blueprint.persuasionSystem.specificityNotes}

Section Plan:
${sections}`
}

function buildCritique(html: string, blueprint: GenerationBlueprint, emotionalControls?: GenerateRequest['emotionalControls']): GenerationCritique {
  const controls = emotionalControls || {
    authority: 70,
    desire: 75,
    warmth: 55,
    tension: 65,
    spectacle: 70,
  }

  const containsMarquee = html.includes('marquee-track')
  const containsOrb = html.includes('orb-1') || html.includes('orb-2') || html.includes('orb-3')
  const containsReveal = /reveal(?:-left|-right|-scale)?/.test(html)
  const hasMobileMediaQuery = /@media\s*\(\s*max-width:\s*(?:768|767|820|834)px\s*\)/.test(html)
  const hasClamp = html.includes('clamp(')
  const hasTouchTargets = /(min-height:\s*44px|min-width:\s*44px)/.test(html)

  const scores: CritiqueScore[] = [
    {
      label: 'First Impression Power',
      score: Math.min(100, Math.round((controls.authority + controls.spectacle) / 2) + (containsOrb ? 4 : -4)),
      note: 'Does the page hit with authority and visual force in the first 3 seconds?',
    },
    {
      label: 'Emotional Clarity',
      score: Math.min(100, Math.round((controls.desire + controls.warmth + controls.authority) / 3) + (blueprint.storyArc.length >= 5 ? 5 : -5)),
      note: 'Does the page feel emotionally intentional instead of just polished?',
    },
    {
      label: 'Trust Timing',
      score: Math.min(100, Math.round((controls.warmth + controls.authority) / 2) + (blueprint.persuasionSystem.proofPlacement.toLowerCase().includes('cta') ? 8 : 0)),
      note: 'Does trust arrive where hesitation is likely to happen?',
    },
    {
      label: 'Visual Distinctiveness',
      score: Math.min(100, Math.round((controls.spectacle + controls.tension) / 2) + (containsMarquee ? 5 : 0)),
      note: 'Does the page feel memorable rather than template-safe?',
    },
    {
      label: 'Motion Readiness',
      score: Math.min(100, Math.round((controls.spectacle + controls.tension) / 2) + (containsReveal ? 6 : -8)),
      note: 'Is motion likely reinforcing the story instead of decorating it?',
    },
    {
      label: 'Conversion Pressure',
      score: Math.min(100, Math.round((controls.desire + controls.authority) / 2) + (blueprint.sections.length >= 5 ? 4 : -4)),
      note: 'Does desire build enough before the ask to make action feel earned?',
    },
    {
      label: 'Mobile Impact',
      score: Math.min(100, (hasMobileMediaQuery ? 34 : 14) + (hasClamp ? 33 : 12) + (hasTouchTargets ? 33 : 12)),
      note: 'Does the page still feel intentional, readable, and tappable on a phone?',
    },
  ]

  const average = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length)
  const recommendations: string[] = []

  if (controls.desire < 70) recommendations.push('Raise desire if you want the product or offer to feel more magnetic before the CTA.')
  if (controls.tension < 60) recommendations.push('Increase tension if you want stronger page-turn energy and more dramatic reveals.')
  if (controls.warmth < 45) recommendations.push('Increase warmth if the page needs to feel more human before asking for action.')
  if (controls.spectacle < 65) recommendations.push('Increase spectacle if you want the output to feel less safe and more unforgettable.')
  if (!containsMarquee && controls.spectacle >= 70) recommendations.push('Add a stronger moving keyword or brand band to keep high-spectacle pages feeling alive.')
  if (!hasMobileMediaQuery || !hasClamp || !hasTouchTargets) recommendations.push('Strengthen the mobile pass so the page still hits emotionally on phones with better hierarchy, touch targets, and responsive rhythm.')

  return {
    summary: average >= 85
      ? 'The page has strong creative gravity and a believable emotional arc.'
      : 'The page has the right ingredients, but one or two emotional systems still need more force.',
    verdict: average >= 88
      ? 'This feels category-defining and close to launch-ready.'
      : average >= 78
        ? 'This is strong, but one system still wants more pressure.'
        : 'This has potential, but it is not fully locked in yet.',
    scores,
    recommendations,
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status })
}

/* ── Hero Image Selection ─────────────────────── */

const IMAGE_MAP: Record<string, string[]> = {
  dj:       ['photo-1470229722913', 'photo-1493225457124', 'photo-1501386761578'],
  fashion:  ['photo-1558618666-fcd25c85cd64', 'photo-1529139574466-a303027c1d8b', 'photo-1515886657613-9f3515b0c78f'],
  luxury:   ['photo-1441986300917-64674bd600d8', 'photo-1524253482453-3fed8d2fe12b', 'photo-1507003211169-0a1dd7228f2d'],
  food:     ['photo-1414235077428', 'photo-1504674900247-0877df9cc836', 'photo-1466637574441-749b8f19452f'],
  cannabis: ['photo-1506905925637', 'photo-1518531933037-91b2f5f229cc', 'photo-1464822759023-fed622ff2c3b'],
  creative: ['photo-1499781350541', 'photo-1542831371-29b0f74f9713', 'photo-1558591710-4b4a1ae0f435'],
  event:    ['photo-1492684223066-81342ee5ff30', 'photo-1540575467063-178a50c2df87', 'photo-1429962714451-bb934ecdc4ec'],
  beach:    ['photo-1507525428034-b723cf961d3e', 'photo-1506905925637', 'photo-1519046904884-53103b34b206'],
}

/* Content images per category for use in sections */
const CONTENT_IMAGES: Record<string, string[]> = {
  dj:       ['photo-1598488035467', 'photo-1571266752482', 'photo-1516450360452', 'photo-1429962714451'],
  fashion:  ['photo-1469334031218-e382a71b716b', 'photo-1558618666-fcd25c85cd64', 'photo-1529139574466-a303027c1d8b'],
  luxury:   ['photo-1524253482453-3fed8d2fe12b', 'photo-1441986300917-64674bd600d8', 'photo-1507003211169-0a1dd7228f2d'],
  food:     ['photo-1424847651672-bf20a4b0982b', 'photo-1414235077428', 'photo-1504674900247-0877df9cc836'],
  cannabis: ['photo-1464822759023-fed622ff2c3b', 'photo-1506905925637', 'photo-1518531933037-91b2f5f229cc'],
  creative: ['photo-1558591710-4b4a1ae0f435', 'photo-1499781350541', 'photo-1542831371-29b0f74f9713'],
  event:    ['photo-1429962714451-bb934ecdc4ec', 'photo-1492684223066-81342ee5ff30', 'photo-1540575467063-178a50c2df87'],
  beach:    ['photo-1519046904884-53103b34b206', 'photo-1507525428034-b723cf961d3e'],
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  dj:       ['dj', 'music', 'concert', 'festival', 'nightlife', 'electronic', 'beats', 'bokeh', 'crowd', 'stage', 'golden hour'],
  fashion:  ['fashion', 'streetwear', 'clothing', 'apparel', 'style', 'brand', 'wear', 'outfit', 'threads', 'drip'],
  luxury:   ['luxury', 'premium', 'high-end', 'refined', 'minimal', 'elegant', 'sophisticated', 'candle'],
  food:     ['restaurant', 'food', 'dining', 'cafe', 'kitchen', 'chef', 'cook', 'dish', 'menu', 'table', 'farm'],
  cannabis: ['cannabis', 'wellness', 'nature', 'organic', 'plant', 'herb', 'holistic', 'healing', 'zen'],
  creative: ['creative', 'portfolio', 'art', 'design', 'photography', 'agency', 'studio', 'work'],
  event:    ['event', 'party', 'celebration', 'experience', 'exclusive', 'ticket', 'night', 'launch'],
  beach:    ['beach', 'coastal', 'surf', 'ocean', 'outdoor', 'tropical', 'island', 'sea', 'wave'],
}

const DEFAULT_IMAGE = 'photo-1493225457124'

function detectCategory(text: string): string {
  let bestCategory = ''
  let bestScore = 0
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) { if (text.includes(kw)) score++ }
    if (score > bestScore) { bestScore = score; bestCategory = category }
  }
  return bestCategory || 'creative'
}

function selectHeroImage(vibe: string, heroImageDescription: string, pageType: string, mood: string, brandName: string): string {
  const text = `${heroImageDescription} ${vibe} ${pageType} ${mood}`.toLowerCase()
  const category = detectCategory(text)
  const photos = IMAGE_MAP[category] || [DEFAULT_IMAGE]
  const index = (brandName || '').length % photos.length
  return `https://images.unsplash.com/${photos[index]}?auto=format&fit=crop&w=1920&q=80`
}

function getContentImageUrls(category: string): string[] {
  const ids = CONTENT_IMAGES[category] || CONTENT_IMAGES.creative
  return ids.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`)
}

/* ── Extract Creative Decisions from HTML comment ── */

function extractDecisions(html: string): CreativeDecision[] {
  const decisions: CreativeDecision[] = []
  const match = html.match(/<!--\s*CREATIVE DECISIONS\s*([\s\S]*?)-->/)
  if (!match) return decisions
  const lines = match[1].split('\n').filter(l => l.trim())
  for (const line of lines) {
    const m = line.match(/^\s*(?:[*\-\u2726]\s*)?([^:]+):\s*(.+)$/)
    if (!m) continue
    const label = m[1].trim()
    const rest = m[2].trim()
    const dashIdx = rest.indexOf(' \u2014 ')
    if (dashIdx > -1) {
      decisions.push({ label, value: rest.slice(0, dashIdx).trim(), reason: rest.slice(dashIdx + 3).trim() })
    } else {
      decisions.push({ label, value: rest, reason: '' })
    }
  }
  return decisions
}

/* ── FIX 1: Post-process injection of guaranteed animation system ── */

const MOTION_CSS = `<style id="irie-motion-system">
.reveal{opacity:0;transform:translateY(24px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
.reveal.visible{opacity:1;transform:translateY(0)}
.reveal-left{opacity:0;transform:translateX(-40px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
.reveal-left.visible{opacity:1;transform:translateX(0)}
.reveal-right{opacity:0;transform:translateX(40px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
.reveal-right.visible{opacity:1;transform:translateX(0)}
.reveal-scale{opacity:0;transform:scale(.94);transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
.reveal-scale.visible{opacity:1;transform:scale(1)}
.stagger>*{opacity:0;transform:translateY(20px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
.stagger.visible>*:nth-child(1){opacity:1;transform:translateY(0);transition-delay:0ms}
.stagger.visible>*:nth-child(2){opacity:1;transform:translateY(0);transition-delay:100ms}
.stagger.visible>*:nth-child(3){opacity:1;transform:translateY(0);transition-delay:200ms}
.stagger.visible>*:nth-child(4){opacity:1;transform:translateY(0);transition-delay:300ms}
.stagger.visible>*:nth-child(5){opacity:1;transform:translateY(0);transition-delay:400ms}
.stagger.visible>*:nth-child(6){opacity:1;transform:translateY(0);transition-delay:500ms}
.marquee-track{display:flex;width:max-content;animation:marquee 30s linear infinite}
.marquee-track:hover{animation-duration:60s}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.1;pointer-events:none}
.orb-1{width:120px;height:120px;animation:float1 10s ease-in-out infinite}
.orb-2{width:80px;height:80px;animation:float2 8s ease-in-out infinite}
.orb-3{width:100px;height:100px;animation:float3 12s ease-in-out infinite}
@keyframes float1{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(30px,-20px) rotate(180deg)}}
@keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,30px)}}
@keyframes float3{0%,100%{transform:translate(0,0) rotate(0deg)}33%{transform:translate(20px,20px)}66%{transform:translate(-10px,-20px) rotate(120deg)}}
.grain::after{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");opacity:.04;pointer-events:none;z-index:9999;animation:grain .5s steps(2) infinite}
@keyframes grain{0%{transform:translate(0,0)}25%{transform:translate(-2%,-1%)}50%{transform:translate(1%,2%)}75%{transform:translate(-1%,1%)}100%{transform:translate(2%,-2%)}}
#cursor{width:8px;height:8px;background:#C9A84C;border-radius:50%;position:fixed;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);transition:transform .1s,background .2s;display:none}
#cursor-ring{width:28px;height:28px;border:1.5px solid #C9A84C;border-radius:50%;position:fixed;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);transition:width .3s,height .3s,background .3s;display:none}
.split-word{display:inline-block;overflow:hidden}
.split-word span{display:inline-block;opacity:0;transform:translateY(100%);animation:wordUp .7s cubic-bezier(.16,1,.3,1) forwards}
@keyframes wordUp{to{opacity:1;transform:translateY(0)}}
section{transition:background-color 1s ease}
.ai-generated{position:relative;transition:outline .2s}
.ai-generated:hover{outline:1px dashed rgba(201,168,76,.3);outline-offset:4px}
@media(prefers-reduced-motion:reduce){.reveal,.reveal-left,.reveal-right,.reveal-scale{opacity:1;transform:none;transition:none}.stagger>*{opacity:1;transform:none;transition:none}.marquee-track{animation:none}.orb{animation:none}.grain::after{animation:none}.split-word span{opacity:1;transform:none;animation:none}}
</style>`

const MOTION_JS = `<script id="irie-motion-js">
(function(){
var dot=document.createElement('div');dot.id='cursor';
var ring=document.createElement('div');ring.id='cursor-ring';
document.body.appendChild(dot);document.body.appendChild(ring);
if(window.matchMedia('(pointer:fine)').matches){dot.style.display='block';ring.style.display='block'}
var mx=0,my=0,rx=0,ry=0,dx=0,dy=0;
document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY});
function lerp(a,b,t){return a+(b-a)*t}
function animC(){dx=lerp(dx,mx,.15);dy=lerp(dy,my,.15);rx=lerp(rx,mx,.08);ry=lerp(ry,my,.08);dot.style.left=dx+'px';dot.style.top=dy+'px';ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(animC)}
animC();
document.querySelectorAll('a,button').forEach(function(el){
el.addEventListener('mouseenter',function(){dot.style.transform='translate(-50%,-50%) scale(0)';ring.style.width='48px';ring.style.height='48px';ring.style.background='rgba(201,168,76,.15)'});
el.addEventListener('mouseleave',function(){dot.style.transform='translate(-50%,-50%) scale(1)';ring.style.width='28px';ring.style.height='28px';ring.style.background='transparent'});
});
var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible')})},{threshold:.15});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.stagger').forEach(function(el){obs.observe(el)});
var hero=document.querySelector('[class*="hero"],section:first-of-type');
var heroH=hero?hero.querySelector('h1'):null;
window.addEventListener('scroll',function(){var sy=window.scrollY;if(hero){hero.style.backgroundPositionY=(sy*.4)+'px'}if(heroH){heroH.style.transform='translateY('+(sy*.15)+'px)'}},{passive:true});
var h1=document.querySelector('h1');
if(h1&&!h1.querySelector('.split-word')){var w=h1.innerText.split(' ');h1.innerHTML=w.map(function(word,i){return '<span class="split-word"><span style="animation-delay:'+(i*80)+'ms">'+word+'</span></span>'}).join(' ')}
document.querySelectorAll('section').forEach(function(sec){
var els=sec.querySelectorAll('h2,h3,p,img,.card,[class*="card"],[class*="grid"]>*,blockquote,figure');
var cls=['reveal','reveal-left','reveal-right','reveal-scale'];
els.forEach(function(el,j){if(!el.classList.contains('reveal')&&!el.classList.contains('reveal-left')&&!el.classList.contains('reveal-right')&&!el.classList.contains('reveal-scale')){el.classList.add(cls[j%cls.length]);obs.observe(el)}});
});
if(!document.body.classList.contains('grain'))document.body.classList.add('grain');
})();
</script>`

function postProcess(html: string): string {
  // Inject motion CSS if missing
  if (!html.includes('id="irie-motion-system"')) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', MOTION_CSS + '\n</head>')
    } else if (html.includes('</style>')) {
      // No </head> — inject after the last </style>
      const lastStyleIdx = html.lastIndexOf('</style>')
      html = html.slice(0, lastStyleIdx + 8) + '\n' + MOTION_CSS + html.slice(lastStyleIdx + 8)
    } else {
      // No structure at all — prepend
      html = MOTION_CSS + '\n' + html
    }
  }

  // Inject motion JS if missing
  if (!html.includes('id="irie-motion-js"')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', MOTION_JS + '\n</body>')
    } else {
      html += '\n' + MOTION_JS
    }
  }

  // Ensure body has grain class
  if (html.includes('<body') && !html.includes('class="grain"') && !html.includes("class='grain'")) {
    html = html.replace(/<body([^>]*)>/, (match, attrs) => {
      if (attrs.includes('class=')) {
        return match.replace(/class="([^"]*)"/, 'class="$1 grain"')
      }
      return `<body${attrs} class="grain">`
    })
  }

  return html
}

/* ── System Prompt ────────────────────────────── */

const SYSTEM_PROMPT = `You are the AI Creative Director for Irie Builder. Not a site builder — a creative director with taste, experience, and a point of view. Every generation must look like a REAL launched website from the first second it loads.

BRAND DESIGN SYSTEM — HIGHEST PRIORITY:
A full DESIGN.md may be provided above this prompt. It is the authoritative source for canvas color, accent color, display font, body font, motion signatures, and do's/don'ts. The colors/fonts/mood fields in the user message are SECONDARY — if they conflict with DESIGN.md, DESIGN.md wins. Never emit generic blue/white/gray palettes. Never substitute the specified fonts.

You are combining four systems every time:
1. Emotional brief
2. Psychology layer
3. Design direction layer
4. Motion / story arc layer

${PSYCHOLOGY_LAYER}

DESIGN DIRECTION RULES:
- Use brand-inspired directions as creative input, never as literal clones.
- Translate the reference into a fresh visual system that fits the user's brand.
- Let design direction influence typography, spacing, section rhythm, contrast, image treatment, and motion energy.
- Let psychology influence section order, CTA timing, proof placement, and copy specificity.

COPY RULES — absolute:
1. If the user provided a headline — use it VERBATIM
2. If the user provided an about/brand story — use it VERBATIM
3. If the user provided a CTA — use it VERBATIM
4. Everything else — you write in the brand voice you decide on
5. Copy must never sound like a template

RAWBRIEF MODE:
When a rawBrief is the only input — extract or invent: brand name, type, mood, audience, color direction, typography, sections. Build a complete site as if you had a full brief.

AUTONOMOUS MODE:
When input is sparse, make bold decisions:
- Invent a compelling brand name (e.g. "AXIOM" for DJ, "The Grove" for restaurant)
- Write a compelling headline, tagline, brand story (2 paragraphs)
- Choose conversion-optimized CTA
- Build a 5-color palette: background, surface, text, accent, highlight
- Add class="ai-generated" to content you invent

CONTENT MANDATE — ABSOLUTE:
You are building a REAL website that looks fully launched. NEVER generate placeholder text. Every element must have real content.

HERO SECTION — must have:
- Full screen background image: background-image:url('[provided-unsplash-url]'); background-size:cover; background-position:center; min-height:100vh
- Real headline text (never "Your Headline Here")
- Real subheadline
- Real CTA button
- At least one .orb div for atmosphere

EVERY IMAGE — must use a real Unsplash URL. Format: https://images.unsplash.com/photo-[ID]?auto=format&fit=crop&w=800&q=80
CONTENT_IMAGES are provided below — use them in feature cards, about sections, and atmosphere sections. NEVER output <img src=""> or <img src="placeholder">.

MARQUEE — must have 8-12 real brand keywords (repeated twice for seamless loop) inside a .marquee-track div.

FEATURES/CARDS — minimum 3 cards. Each: real heading, real 1-2 sentence description, and either an inline SVG icon or a real image.

ABOUT/STORY — write a compelling 2-paragraph brand story (or use user's text verbatim if provided). Never empty.
- This story must move through recognition, curiosity, desire, trust, and action.
- Never rush the CTA before enough emotional and narrative setup.

EMAIL CAPTURE — real heading, real subheading, input field, CTA button.

FOOTER — brand name, tagline, copyright 2025, at least 3 nav links.

ANIMATION CLASSES — apply to every content element in the HTML:
- First element in section: class="reveal"
- Second element: class="reveal-left"
- Third element: class="reveal-right"
- Fourth element: class="reveal-scale"
- Repeat pattern. Never two adjacent elements with same class.
- Section containers with multiple children: add class="stagger"
A post-processor will inject the animation CSS/JS automatically, but you MUST apply these classes in the HTML for it to work.

REQUIRED CREATIVE DECISIONS (announce in HTML comment at top):
<!-- CREATIVE DECISIONS
Typography: [fonts] — [why]
Color system: [palette name] — [mood]
Motion personality: [chosen] — [feel]
Atmosphere: [layer] — [effect]
Sections: [names in order]
Section headings: [actual headings]
Unexpected detail: [what and why]
Brand voice: [adjectives]
Hero treatment: [layout and why]
Overall direction: [one sentence brief]
-->

TYPOGRAPHY: Two Google Fonts loaded via <link>. clamp() for fluid sizing.
- Use display typography like a creative director, not a theme generator.
- Streetwear / culture outputs should hit harder and feel more alive.

MOTION — the post-processor guarantees animation CSS/JS. Your job is to apply classes: .reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger, .orb, .orb-1/.orb-2/.orb-3, .marquee-track, .grain (on body). The JS handles cursor, parallax, text split, and IntersectionObserver automatically.
- Motion should create anticipation and release. Not decorative movement.
- Think page-turn energy, tension, atmosphere, reward.

MOBILE-FIRST IMPACT — non-negotiable:
- The page must feel just as intentional on a phone as it does on desktop.
- Compress the story without flattening it.
- Make the first mobile viewport emotionally decisive: one strong image moment, one strong headline moment, one clear next step.
- Use mobile-specific spacing and type rhythm so the page still feels premium, not crowded.
- Motion on mobile should feel tactile and rewarding, never heavy or laggy.
- CTA blocks, cards, and key interactions must feel made for thumbs.

RESPONSIVE: grids→1col 768px, clamp() typography, 44px touch targets, overflow-x:hidden
ACCESSIBILITY: prefers-reduced-motion handled by injected CSS, heading hierarchy, alt text, 4.5:1 contrast, focus indicators
META: DOCTYPE, lang, charset, viewport, OG tags, title

End with: <!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->

OUTPUT: ONLY complete HTML. No markdown. No backticks. No explanation. Inline <style> and <script>. External: Google Fonts <link> only. Under 8000 tokens.`

export async function POST(request: Request) {
  try {
    let body: GenerateRequest
    try {
      body = (await request.json()) as GenerateRequest
    } catch {
      return jsonError('Invalid JSON in request body', 400)
    }

    if (!body.rawBrief && !body.brandName && !body.vibe) {
      return jsonError('Please provide at least a vision, brand name, or vibe', 400)
    }
    if (!body.colors?.primary) {
      body.colors = { primary: '#111111', accent: '#C9A84C', background: '#F5F0E8' }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return jsonError('ANTHROPIC_API_KEY not configured on server', 500)
    }

    const client = new Anthropic({ apiKey, timeout: 40000 })

    // Resolve the design system: caller-supplied wins (proxies forward their
    // own platform DESIGN.md), else fall back to this repo's DESIGN.md.
    const designSystemBlock = buildDesignSystemBlock(body.brandDesignSystem)

    // Detect category for image selection
    const vibeText = (body.rawBrief || body.vibe || '').toLowerCase()
    const category = detectCategory(vibeText + ' ' + (body.heroImageDescription || '') + ' ' + (body.pageType || ''))
    const resolvedDirection = body.designDirection === 'auto'
      ? inferDesignDirection(`${body.rawBrief || ''} ${body.vibe || ''} ${body.audience || ''}`, body.pageType || 'landing')
      : body.designDirection
    const directionProfile = resolvedDirection === 'auto' ? null : DESIGN_DIRECTION_PROFILES[resolvedDirection]

    // Hero image selection
    let heroImage = ''
    if (body.heroImageUrl && body.heroImageUrl.match(/^https?:\/\//i)) {
      heroImage = body.heroImageUrl
    } else {
      heroImage = selectHeroImage(
        body.vibe || body.rawBrief || '',
        body.heroImageDescription || '',
        body.pageType || 'landing',
        body.mood || 'dark',
        body.brandName || body.rawBrief || '',
      )
    }

    // Get content images for this category
    const contentImages = getContentImageUrls(category)

    const feedbackLine = body.userFeedback
      ? `\nUSER FEEDBACK (HIGHEST PRIORITY): ${body.userFeedback}`
      : ''

    const heroDescLine = body.heroImageDescription
      ? `\nHero Image Description: ${body.heroImageDescription}`
      : ''
    const designDirectionLine = directionProfile
      ? `\nDesign Direction: ${directionProfile.label}
- Mood: ${directionProfile.mood}
- Typography: ${directionProfile.typography}
- Layout: ${directionProfile.layout}
- Motion: ${directionProfile.motion}
- Notes: ${directionProfile.notes}`
      : ''
    const referenceStyleLine = buildReferenceStylesSection(body.referenceStyles)
    const emotionalControlsLine = buildEmotionalControlsSection(body.emotionalControls)
    const directingPassLine = buildDirectingPassSection(body.sectionFocus, body.revisionDirective)
    const carryForwardLine = buildCarryForwardSection(body.carryForwardLocks)
    const styleBlendLine = body.styleBlend
      ? `\nStyle Blend: ${body.styleBlend}`
      : ''
    const psychologyLine = `\nPsychology Layer (must shape structure and copy): ${PSYCHOLOGY_LAYER}`

    let blueprint = createFallbackBlueprint({
      body,
      category,
      resolvedDirection,
      referenceStyles: body.referenceStyles || [],
    })

    let userPrompt: string
    const blueprintSection = blueprintToPromptSection(blueprint)

    if (body.rawBrief) {
      userPrompt = `RAW BRIEF: "${body.rawBrief}"

Hero Background Image URL (USE THIS): ${heroImage}
Content images to use in sections: ${contentImages.join(', ')}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${designDirectionLine}${referenceStyleLine}${emotionalControlsLine}${directingPassLine}${carryForwardLine}${styleBlendLine}${psychologyLine}${blueprintSection}${feedbackLine}

This is a raw brief — one sentence. Invent everything: brand name, headlines, story, sections. Build a COMPLETE site that looks like a real launched business.
- Hero MUST use background-image:url('${heroImage}') with background-size:cover
- Use the content images above for feature cards and atmosphere sections
- Every section must have REAL content — never placeholder
- Apply .reveal / .reveal-left / .reveal-right / .reveal-scale classes to all content elements
- Add .stagger to containers with multiple children
- Include .orb-1, .orb-2, .orb-3 divs in hero section
- Add class="grain" to <body>
- Include .marquee-track with 8-12 brand keywords repeated twice
- Make the whole page feel like a story with momentum, not a layout with sections
- Pull from the reference-style library to add more taste, contrast, and originality
- Put proof near the moment of doubt, not randomly at the top
- Streetwear and culture brands should hit harder, feel alive, and reward scroll depth
- Include CREATIVE DECISIONS comment at top
- Output ONLY HTML`
    } else {
      userPrompt = `Create a complete website:

Brand Name: ${body.brandName || '(invent one)'}
Hero Headline: ${body.headline || '(write a compelling one)'}
CTA Button Text: ${body.ctaText || '(choose the best)'}
Hero Background Image URL (USE THIS): ${heroImage}${heroDescLine}
Content images to use in sections: ${contentImages.join(', ')}
Vibe: ${body.vibe || '(use creative judgment)'}
Audience: ${body.audience || '(infer from vibe)'}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${designDirectionLine}${referenceStyleLine}${emotionalControlsLine}${directingPassLine}${carryForwardLine}${styleBlendLine}${psychologyLine}${blueprintSection}${feedbackLine}

${(!body.headline || !body.audience || !body.ctaText) ? 'Input is sparse — AUTONOMOUS MODE. Invent all missing content. Mark with class="ai-generated".' : 'Use user headline/CTA VERBATIM.'}

REQUIREMENTS:
- Hero MUST use background-image:url('${heroImage}') with background-size:cover; min-height:100vh
- Use content images above for feature cards and sections — NEVER empty src
- Every section: REAL content, never placeholder
- Apply .reveal / .reveal-left / .reveal-right / .reveal-scale to all content elements
- .stagger on containers with multiple children
- .orb-1, .orb-2, .orb-3 in hero
- class="grain" on body
- .marquee-track with 8-12 keywords repeated twice
- The page must behave like a creative director built it, not a template engine
- Use the selected reference styles to sharpen taste, tension, and visual point of view
- Respect the psychology sequence: recognition -> curiosity -> desire -> trust -> action
- Use specificity over generic premium language
- If the chosen direction is streetwear / Nike-like, make it more cinematic, more alive, and more physically felt
- CREATIVE DECISIONS comment at top
- Output ONLY HTML`
    }

    let html: string
    try {
      const systemWithDesign = designSystemBlock
        ? `${designSystemBlock}\n\n${SYSTEM_PROMPT}`
        : SYSTEM_PROMPT

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6500,
        system: systemWithDesign,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const textBlock = response.content.find(b => b.type === 'text')
      html = textBlock?.text ?? ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown API error'
      if (msg.includes('timeout') || msg.includes('abort') || msg.includes('ETIMEDOUT')) {
        return jsonError('Generation timed out. The AI took too long \u2014 please try again.', 504)
      }
      if (msg.includes('rate_limit')) {
        return jsonError('Rate limited by AI provider. Please wait 60 seconds and try again.', 429)
      }
      if (msg.includes('authentication') || msg.includes('401')) {
        return jsonError('API key is invalid or expired. Contact support.', 401)
      }
      return jsonError(`AI generation failed: ${msg}`, 502)
    }

    if (!html || html.length < 100) {
      return jsonError('AI returned an empty or invalid response. Please try again.', 502)
    }

    html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    // FIX 1: Post-process — inject guaranteed animation system
    html = postProcess(html)

    // Extract creative decisions
    const decisions = extractDecisions(html)
    const critique = buildCritique(html, blueprint, body.emotionalControls)

    // Extract metadata
    const fonts: string[] = []
    const sections: string[] = []
    const motionVocabulary: string[] = []

    const fontMatch = html.match(/fonts\.googleapis\.com\/css2\?family=([^"&]+)/)
    if (fontMatch) {
      fontMatch[1].split('&family=').forEach(f => {
        fonts.push(decodeURIComponent(f.split(':')[0].replace(/\+/g, ' ')))
      })
    }

    for (const m of html.matchAll(/data-animate="([^"]+)"/g)) {
      if (!motionVocabulary.includes(m[1])) motionVocabulary.push(m[1])
    }

    for (const m of html.matchAll(/<section[^>]*(?:id="([^"]+)"|class="[^"]*([^"]*section[^"]*)")/gi)) {
      const name = m[1] || 'section'
      if (!sections.includes(name)) sections.push(name)
    }

    return NextResponse.json({
      html,
      metadata: { fonts, sections, palette: body.colors, motionVocabulary },
      designDirection: resolvedDirection,
      referenceStyles: body.referenceStyles || [],
      blueprint,
      critique,
      decisions,
      sparse: !!body.rawBrief || !body.headline || !body.audience,
    })
  } catch (err: unknown) {
    console.error('[generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return jsonError(message, 500)
  }
}
