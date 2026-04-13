import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
  userFeedback?: string
  rawBrief?: string
}

interface CreativeDecision {
  label: string
  value: string
  reason: string
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

function selectHeroImage(vibe: string, heroImageDescription: string, pageType: string, mood: string, brandName: string): string {
  const text = `${heroImageDescription} ${vibe} ${pageType} ${mood}`.toLowerCase()
  let bestCategory = ''
  let bestScore = 0
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) { if (text.includes(kw)) score++ }
    if (score > bestScore) { bestScore = score; bestCategory = category }
  }
  const photos = bestCategory ? IMAGE_MAP[bestCategory] : [DEFAULT_IMAGE]
  const index = (brandName || '').length % photos.length
  return `https://images.unsplash.com/${photos[index]}?auto=format&fit=crop&w=1920&q=80`
}

/* ── Extract Creative Decisions from HTML comment ── */

function extractDecisions(html: string): CreativeDecision[] {
  const decisions: CreativeDecision[] = []
  const match = html.match(/<!--\s*CREATIVE DECISIONS\s*([\s\S]*?)-->/)
  if (!match) return decisions

  const block = match[1]
  const lines = block.split('\n').filter(l => l.trim())

  for (const line of lines) {
    // Format: "Label: value — reason" or "Label: value"
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

/* ── System Prompt (UPGRADE 3) ────────────────── */

const SYSTEM_PROMPT = `You are the AI Creative Director for Irie Builder. Not a site builder — a creative director with taste, experience, and a point of view. You make decisions the user didn't ask for and wouldn't have thought of. Every generation should feel like it was made by someone who really knows what they're doing.

COPY RULES — absolute:
1. If the user provided a headline — use it VERBATIM, never change a word
2. If the user provided an about/brand story — use it VERBATIM
3. If the user provided a CTA — use it VERBATIM
4. Everything else — you write it in the brand voice you decide on
5. Copy must never sound like a template. Every word must sound like it was written specifically for this brand.

RAWBRIEF MODE:
When a rawBrief is the only meaningful input — read it and extract or invent: brand name, brand type, mood, audience, color direction, typography direction, section needs. Then build a complete site as if you had received a full brief. The rawBrief is the creative seed — everything grows from it.

AUTONOMOUS CREATIVE DIRECTOR MODE:
When input is sparse, you do NOT ask for more — you make bold, confident creative decisions.
- Missing brand name? Invent a compelling one that fits the vibe.
- Missing headline? Write the most compelling headline you can.
- Missing CTA? Choose the most conversion-optimized CTA for this page type.
- Missing audience? Infer from vibe and page type.
- Default colors (#111111/#C9A84C/#F5F0E8)? Choose a complete 5-color palette that perfectly matches the mood.

For content you invent, add class="ai-generated" to the element.

REQUIRED CREATIVE DECISIONS — you must make ALL of these independently:

1. TYPOGRAPHY PAIRING — choose two fonts that create tension and harmony. Not safe choices. Examples: Cormorant Garamond + Space Grotesk for luxury. Bebas Neue + Inter for streetwear. Playfair Display + DM Mono for editorial. The pairing must feel intentional and slightly unexpected.

2. COLOR HARMONY — build a complete 5-color system: background, surface, primary text, accent, highlight. The system must have contrast, depth, and personality.

3. SECTION ARCHITECTURE — decide which sections exist and in what order based on brand type. A DJ site: hero → upcoming shows → sound samples → booking → press → footer. A restaurant: hero → philosophy → menu preview → reservation → story → footer. Not every site uses the same template.

4. MOTION PERSONALITY — choose one: Cinematic (slow, dramatic, large movements), Electric (fast, snappy, high energy), Organic (flowing, gentle, nature-inspired), Editorial (precise, controlled, typographic), Raw (aggressive, glitchy, punk). Apply consistently.

5. ATMOSPHERE LAYER — choose one dominant: Grain (film texture 3-8%), Fog (radial gradients shifting on scroll), Orbs (floating blurred color spheres), Static (noise texture), Void (deep blacks with light bleed). Apply throughout.

6. SECTION HEADINGS — write headings that sound like this brand, not a template. Not "About Us" — maybe "The Story" or "Built Different" or "Where It Started" or "The Philosophy."

7. UNEXPECTED DETAIL — add one design detail the user would never ask for. Examples: a subtle sound wave SVG pulsing in the hero for a DJ site. A rotating botanical illustration at 4% opacity for wellness. A ticker tape of press mentions for a portfolio. A live countdown for events.

CREATIVE DECISIONS COMMENT — announce ALL decisions at the top of the HTML:
<!-- CREATIVE DECISIONS
Typography: [fonts] — [why this pairing]
Color system: [palette name you invent] — [mood it creates]
Motion personality: [chosen] — [how it feels]
Atmosphere: [chosen layer] — [effect]
Sections: [actual section names in order]
Section headings: [actual headings written]
Unexpected detail: [what and why]
Brand voice: [adjectives for the copy voice]
Hero treatment: [layout decision and why]
Overall direction: [one sentence creative brief you wrote for yourself]
-->

MOTION SYSTEM — implement based on chosen Motion Personality:

a) SCROLL ANIMATIONS via IntersectionObserver (threshold 0.15). Classes: .fade-up, .fade-in, .slide-left, .slide-right, .scale-up, .line-reveal. No two adjacent sections same animation. Stagger children 100ms. Bidirectional reset.

b) PARALLAX HERO — bg image 0.4x scroll, headline 0.15x opposite direction.

c) TEXT SPLIT — hero headline splits into words on load. Each word fades up with 80ms stagger via splitText() wrapping words in inline-block spans.

d) MARQUEE — continuous scroll 30s linear infinite. Hover slows to 60s. Duplicated content, translateX(-50%).

e) CURSOR (desktop @media(pointer:fine)) — Gold dot 8px, lerp factor 0.15. Chasing ring 24px, lerp 0.08. Hover: dot scale 0, ring scale 2x + fill 20% opacity.

f) SECTION BG SHIFT — body background-color shifts ±5% lightness per section via IntersectionObserver threshold 0.5. Transition 0.8s.

g) FLOATING ORBS — 3 blurred gradients 80-120px, opacity 0.08-0.12, separate keyframes 8-12s, in hero + atmosphere.

h) GRAIN — SVG feTurbulence ::after overlay 3-5% opacity.

i) NAV — transparent → solid on scroll past 80px.

AI-GENERATED HOVER INDICATOR:
.ai-generated{position:relative;transition:outline 0.2s}
.ai-generated:hover{outline:1px dashed rgba(201,168,76,0.3);outline-offset:4px}

RESPONSIVE: grids→1col 768px, clamp() typography, 44px touch targets, overflow-x:hidden
ACCESSIBILITY: prefers-reduced-motion disables ALL, heading hierarchy, alt text, 4.5:1 contrast, focus indicators
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

    // Allow rawBrief as sole input
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

    const client = new Anthropic({ apiKey, timeout: 55000 })

    // Hero image selection
    const vibeForImage = body.rawBrief || body.vibe || ''
    let heroImage = ''
    if (body.heroImageUrl && body.heroImageUrl.match(/^https?:\/\//i)) {
      heroImage = body.heroImageUrl
    } else {
      heroImage = selectHeroImage(
        vibeForImage,
        body.heroImageDescription || '',
        body.pageType || 'landing',
        body.mood || 'dark',
        body.brandName || body.rawBrief || '',
      )
    }

    const feedbackLine = body.userFeedback
      ? `\nUSER FEEDBACK (HIGHEST PRIORITY): ${body.userFeedback}`
      : ''

    const heroDescLine = body.heroImageDescription
      ? `\nHero Image Description: ${body.heroImageDescription}`
      : ''

    let userPrompt: string

    if (body.rawBrief) {
      // RAWBRIEF MODE — single sentence becomes everything
      userPrompt = `RAW BRIEF: "${body.rawBrief}"

Hero Background Image URL: ${heroImage}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${feedbackLine}

This is a raw brief — one sentence. Extract or invent everything: brand name, type, mood, audience, headlines, CTA, section architecture. Make bold creative decisions. Mark invented content with class="ai-generated".

Include the CREATIVE DECISIONS comment block at the top with all 10 decisions.
Include ALL motion, cursor, orbs, grain, marquee, parallax, text split.
Output ONLY HTML.`
    } else {
      userPrompt = `Create a complete website for this brand:

Brand Name: ${body.brandName || '(invent one)'}
Hero Headline: ${body.headline || '(write a compelling one)'}
CTA Button Text: ${body.ctaText || '(choose the best)'}
Hero Background Image URL: ${heroImage}${heroDescLine}
Emotional Brief / Vibe: ${body.vibe || '(use creative judgment)'}
Target Audience: ${body.audience || '(infer from vibe)'}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${feedbackLine}

${(!body.headline || !body.audience || !body.ctaText) ? 'Input is sparse — activate AUTONOMOUS MODE. Make bold decisions. Mark invented content with class="ai-generated".' : 'User provided specific content — use their headline/CTA VERBATIM.'}

Include the CREATIVE DECISIONS comment block at the top with all 10 decisions.
Include ALL motion, cursor, orbs, grain, marquee, parallax, text split.
Output ONLY HTML.`
    }

    let html: string
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
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

    // Extract creative decisions from the HTML comment
    const decisions = extractDecisions(html)

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
      decisions,
      sparse: !!body.rawBrief || !body.headline || !body.audience,
    })
  } catch (err: unknown) {
    console.error('[generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return jsonError(message, 500)
  }
}
