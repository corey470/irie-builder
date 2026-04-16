import { callJsonAgent } from './anthropic'
import { AGENT_CONFIG } from './config'
import { artDirectionFallback } from './fallbacks'
import { loadReferenceDocs } from './md-loader'
import type { BriefInput, CreativeDirection, ArtDirection } from './types'

/**
 * Art Director — owns typography, palette, layout rhythm, and the
 * atmosphere summary. Injects DESIGN.md + DESIGN_DIRECTIONS.md so every
 * decision respects the Irie Builder brand tokens and translates reference
 * styles into original visual language.
 */

function buildSystem(): string {
  const { design, designDirections } = loadReferenceDocs()
  const designExcerpt = buildArtDesignBrief(design)
  const directionExcerpt = buildDirectionBrief(designDirections)
  return `You are the Art Director for Irie Builder.

Your job: translate the brief, the creative thesis, and the chosen reference styles into ORIGINAL visual decisions. Never clone — translate.

Rules:
- Typography: two Google Fonts max. Display should pair with a contrasting body sans.
- Palette: ONE accent color on the canvas. Never dilute the accent on body elements.
- Layout: alternate compression and release so each scroll feels like a reveal.
- Contrast: reserve the accent for headlines, CTAs, and hairline dividers only.
- Atmosphere: describe the depth system (orbs, grain, gradients, texture) in one sentence.
- If DESIGN.md (below) specifies specific tokens (near-black canvas, gold accent, Playfair + Syne), honor them unless the user's explicit palette overrides.

Design reference (palette + typography slices):
${designExcerpt || 'Palette and typography guidance unavailable.'}

Reference style library (core references):
${directionExcerpt || 'Core references guidance unavailable.'}

Output ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "typographySystem": {
    "displayFont": string,
    "bodyFont": string,
    "scale": string,
    "pairing": string
  },
  "colorPalette": {
    "canvas": string,
    "accent": string,
    "text": string,
    "muted": string,
    "highlight": string,
    "notes": string
  },
  "layoutRhythm": string,
  "contrastStrategy": string,
  "atmosphereSummary": string
}`
}

export async function runArtDirector(
  brief: BriefInput,
  direction: CreativeDirection,
  requestId: string,
): Promise<ArtDirection> {
  const user = `Creative thesis: ${direction.overallDirection}
Emotional target: ${direction.emotionalTarget}
Energy level: ${direction.energyLevel}

Brief:
Brand: ${brief.brandName || '(unnamed)'}
Vibe: ${brief.vibe || brief.rawBrief || ''}
Mood: ${brief.mood}
Page type: ${brief.pageType}
Design direction: ${brief.designDirection}
Reference styles: ${brief.referenceStyles.join(', ') || 'none'}
${brief.styleBlend ? `Style blend note: ${brief.styleBlend}` : ''}

User-supplied palette (use unless it clashes with the vision):
- Primary: ${brief.colors.primary}
- Accent: ${brief.colors.accent}
- Background: ${brief.colors.background}

Decide the visual language for this page.`

  const out = await callJsonAgent<ArtDirection>({
    model: AGENT_CONFIG.artDirector.model,
    system: buildSystem(),
    user,
    maxTokens: AGENT_CONFIG.artDirector.maxTokens,
    timeoutMs: AGENT_CONFIG.artDirector.timeoutMs,
    label: 'art-director',
    requestId,
  })
  if (!out || !out.typographySystem || !out.colorPalette) return artDirectionFallback(brief)
  return out
}

function buildArtDesignBrief(design: string): string {
  const palette = extractSection(design, '## 2. Color Palette & Roles')
  const typography = extractSection(design, '## 3. Typography Rules')
  return [palette, typography].filter(Boolean).join('\\n\\n')
}

function buildDirectionBrief(directions: string): string {
  if (!directions) return ''
  const start = directions.indexOf('## Core References')
  if (start === -1) return directions.slice(0, 1800).trim()
  const endMarker = '## How Irie Builder Should Use Them'
  const end = directions.indexOf(endMarker, start + 1)
  return directions.slice(start, end === -1 ? directions.length : end).trim()
}

function extractSection(doc: string, heading: string): string {
  if (!doc) return ''
  const start = doc.indexOf(heading)
  if (start === -1) return ''
  const nextHeading = doc.indexOf('\\n## ', start + heading.length)
  const end = nextHeading === -1 ? doc.length : nextHeading
  return doc.slice(start, end).trim()
}
