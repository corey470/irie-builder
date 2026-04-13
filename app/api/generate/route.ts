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
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status })
}

/* ── FIX 1: Hero Image Selection System ───────── */

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
  luxury:   ['luxury', 'premium', 'high-end', 'refined', 'minimal', 'elegant', 'sophisticated', 'exclusive'],
  food:     ['restaurant', 'food', 'dining', 'cafe', 'kitchen', 'chef', 'cook', 'dish', 'menu', 'table'],
  cannabis: ['cannabis', 'wellness', 'nature', 'organic', 'plant', 'herb', 'holistic', 'healing', 'zen'],
  creative: ['creative', 'portfolio', 'art', 'design', 'photography', 'agency', 'studio', 'work'],
  event:    ['event', 'party', 'celebration', 'experience', 'exclusive', 'ticket', 'night', 'launch'],
  beach:    ['beach', 'coastal', 'surf', 'ocean', 'outdoor', 'tropical', 'island', 'sea', 'wave'],
}

const DEFAULT_IMAGE = 'photo-1493225457124'

function selectHeroImage(
  vibe: string,
  heroImageDescription: string,
  pageType: string,
  mood: string,
  brandName: string,
): string {
  const text = `${heroImageDescription} ${vibe} ${pageType} ${mood}`.toLowerCase()

  // Score each category by keyword matches
  let bestCategory = ''
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (text.includes(kw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  const photos = bestCategory ? IMAGE_MAP[bestCategory] : [DEFAULT_IMAGE]

  // Rotate selection based on brandName length so different brands get different images
  const index = (brandName || '').length % photos.length
  const photoId = photos[index]

  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1920&q=80`
}

/* ── System Prompt ────────────────────────────── */

const SYSTEM_PROMPT = `You are the AI Creative Director for Irie Builder. You create living, breathing websites that feel ALIVE.

CRITICAL RULES:
1. When the user provides a headline, tagline, or CTA — use their EXACT words verbatim. Do not rephrase, improve, or "enhance" their copy.
2. If heroImageDescription is provided instead of heroImageUrl — select the most appropriate Unsplash photo based on the description and vibe.
3. If userFeedback is present — treat it as the HIGHEST PRIORITY instruction and adjust the generated site accordingly. This overrides vibe, layout, and creative choices where they conflict.
4. End every generated site with this HTML comment in the footer: <!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->

AUTONOMOUS CREATIVE DIRECTOR MODE:
You are a world-class creative director. When input is sparse, you do NOT ask for more — you make bold, confident creative decisions and build a complete, polished, atmospheric site.

If brandName is missing or generic ("Your Brand") — invent a compelling brand name that fits the vibe.
If headline is missing or starts with "Welcome to" — write the most compelling headline you can for this type of brand.
If ctaText is missing or is "Get Started" — choose the most conversion-optimized CTA for this page type.
If audience is missing or is "general" — infer the most likely audience from the vibe and page type.
If heroImageDescription is missing — select the best Unsplash image for the vibe.
If colors are default (#111111/#C9A84C/#F5F0E8) — choose a complete color palette that perfectly matches the mood and vibe.

For every piece of content you invent (headline, brand story, CTA, section copy) — place this HTML comment directly above the element:
<!-- AI generated — click to customize -->
And add this class to the element: class="ai-generated" (append to existing classes).

CREATIVE DECISIONS — announce in an HTML comment at the top:
<!-- CREATIVE DECISIONS
Typography: [display font] + [body font]
Motion vocabulary: [list]
Color temperature: [warm/cool/neutral]
Section order: [list]
Atmosphere: [grain/orbs/gradients]
Autonomous decisions: [list what you invented]
-->

TYPOGRAPHY: Choose TWO Google Fonts. Display + Body. Load via <link>. Use clamp() for fluid sizing.

REQUIRED MOTION SYSTEM — every generated site must include ALL of the following:

a) SCROLL ANIMATIONS — use IntersectionObserver (threshold 0.15). Every section entrance uses one of these CSS classes applied via JS: .fade-up (opacity 0→1, translateY 20px→0), .fade-in (opacity 0→1), .slide-left (translateX -40px→0), .slide-right (translateX 40px→0), .scale-up (scale 0.95→1), .line-reveal (clip-path: inset(0 100% 0 0)→inset(0 0% 0 0)). No two adjacent sections use the same animation class. Stagger child elements inside sections by 100ms each using data-delay attributes. Bidirectional: reset when leaving viewport.

b) PARALLAX HERO — the hero background image moves at 0.4x scroll speed using a scroll event listener and transform: translateY(). The hero headline moves at 0.15x scroll speed in the OPPOSITE direction. Creates depth.

c) TEXT SPLIT ANIMATION — the hero headline splits into individual words on load. Each word fades up with 80ms stagger. Implement a splitText() function that wraps each word in a <span style="display:inline-block;opacity:0;transform:translateY(15px)"> and then animates each span sequentially.

d) MARQUEE STRIP — continuous horizontal scroll using CSS animation: scroll 30s linear infinite. On hover — transition to 60s speed. Uses translateX(-50%) on duplicated content. Smooth transition: transition: animation-duration 0.5s.

e) CUSTOM CURSOR (REQUIRED, desktop only via @media(pointer:fine)):
   Gold dot: 8px, background #C9A84C, follows mouse with 8ms lag using lerp: x += (targetX - x) * 0.15 via requestAnimationFrame.
   Chasing ring: 24px diameter, border 1.5px solid #C9A84C, follows with 80ms lag: x += (targetX - x) * 0.08.
   On hover over links/buttons: dot scales to 0, ring scales to 2x and fills rgba(201,168,76,0.2).
   Both: position fixed, pointer-events none, z-index 9999/9998, border-radius 50%.

f) SECTION BACKGROUND SHIFT — as user scrolls past 50% of each section, the body background-color subtly shifts ±5% lightness using CSS transition on body (transition: background-color 0.8s ease). Use IntersectionObserver with threshold 0.5. Each section has a data-bg attribute with a slightly shifted background color.

g) FLOATING ORBS — 3 blurred circular gradients (80-120px, opacity 0.08-0.12) positioned absolutely in the hero and atmosphere sections. Each orb has a separate CSS keyframe animation at 8-12s duration with slight rotation and translation. Uses the accent color as base: radial-gradient(circle, accent_color_at_opacity, transparent 70%).

h) GRAIN TEXTURE — overlay at 3-5% opacity using SVG feTurbulence filter as background-image on a ::after pseudo-element covering the page.

i) NAV — transparent → solid background on scroll past 80px threshold. Transition: background-color 0.3s, backdrop-filter 0.3s.

AI-GENERATED CONTENT HOVER INDICATOR:
Include this CSS rule:
.ai-generated{position:relative;transition:outline 0.2s}
.ai-generated:hover{outline:1px dashed rgba(201,168,76,0.3);outline-offset:4px}

REQUIRED SECTION STRUCTURE (7 sections in this order):
1. Hero — full screen (min-height:100svh), parallax background, headline with text split + CTA button + inline email form
2. Marquee strip — scrolling brand keywords, slows on hover
3. Feature/Collection section — relevant to pageType
4. Brand story — two-column layout
5. Atmosphere section — full-bleed image with overlay, floating orbs
6. Email capture — prominent CTA section
7. Footer — brand name, copyright, placeholder links, then the Irie Builder HTML comment

RESPONSIVE: grids→1col at 768px, clamp() typography, 44px touch targets, overflow-x:hidden, forms stack at 480px
ACCESSIBILITY: prefers-reduced-motion disables ALL animations/motion, heading hierarchy, alt text, 4.5:1 contrast, focus indicators, labeled form inputs
META: DOCTYPE, lang, charset, viewport, OG tags, title

OUTPUT: Return ONLY the complete HTML. No markdown. No backticks. No explanation. Self-contained with inline <style> and <script>. Only external resource: Google Fonts <link>.

Be concise with CSS. Combine selectors. Use shorthand. Keep under 8000 tokens.`

export async function POST(request: Request) {
  try {
    let body: GenerateRequest
    try {
      body = (await request.json()) as GenerateRequest
    } catch {
      return jsonError('Invalid JSON in request body', 400)
    }

    // FIX 4: Relax validation — allow sparse input, only require vibe OR brandName
    if (!body.brandName && !body.vibe) {
      return jsonError('Please provide at least a brand name or vibe description', 400)
    }
    if (!body.colors?.primary) {
      body.colors = { primary: '#111111', accent: '#C9A84C', background: '#F5F0E8' }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return jsonError('ANTHROPIC_API_KEY not configured on server', 500)
    }

    const client = new Anthropic({ apiKey, timeout: 55000 })

    // FIX 1: Determine hero image with proper selection
    let heroImage = ''
    if (body.heroImageUrl && body.heroImageUrl.match(/^https?:\/\//i)) {
      heroImage = body.heroImageUrl
    } else {
      heroImage = selectHeroImage(
        body.vibe || '',
        body.heroImageDescription || '',
        body.pageType || 'landing',
        body.mood || 'dark',
        body.brandName || '',
      )
    }

    // Detect sparse input for the response metadata
    const isSparse = !body.headline || !body.audience || body.audience === 'general'
      || !body.ctaText || body.ctaText === 'Get Started'
      || body.brandName === 'Your Brand' || !body.brandName

    const feedbackLine = body.userFeedback
      ? `\nUSER FEEDBACK (HIGHEST PRIORITY — adjust the site based on this): ${body.userFeedback}`
      : ''

    const heroDescLine = body.heroImageDescription
      ? `\nHero Image Description (the user described what they want — use the provided URL but let this influence the mood): ${body.heroImageDescription}`
      : ''

    const sparseNote = isSparse
      ? `\nNOTE: Input is sparse. Activate AUTONOMOUS CREATIVE DIRECTOR MODE. Make bold, confident creative decisions. Invent compelling content for anything missing. Mark all invented content with the "ai-generated" class and <!-- AI generated --> comments.`
      : ''

    const userPrompt = `Create a complete website for this brand:

Brand Name: ${body.brandName || '(none provided — invent one)'}
Hero Headline: ${body.headline || '(none provided — write a compelling one)'}
CTA Button Text: ${body.ctaText || '(none provided — choose the best one)'}
Hero Background Image URL: ${heroImage}${heroDescLine}
Emotional Brief / Vibe: ${body.vibe || '(minimal — use your creative judgment)'}
Target Audience: ${body.audience || '(not specified — infer from vibe)'}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${feedbackLine}${sparseNote}

REMINDERS:
- If the user provided headline/CTA, use them VERBATIM — do not rephrase
- If fields are missing, invent compelling content and mark with class="ai-generated"
- Use the provided hero image URL as the hero background
- Include ALL motion: parallax (hero bg 0.4x + headline 0.15x opposite), splitText() on headline, bidirectional IntersectionObserver with 6 animation classes, custom cursor (gold dot lerp + chasing ring), floating orbs (3, 80-120px, 8-12s keyframes), section background shift, grain, marquee (30s, slows on hover), nav scroll
- 7 sections: hero → marquee → features → brand story → atmosphere → email capture → footer
- End with: <!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->
- Output ONLY HTML`

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
        return jsonError('Generation timed out. The AI took too long — please try again.', 504)
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
      sparse: isSparse,
    })
  } catch (err: unknown) {
    console.error('[generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return jsonError(message, 500)
  }
}
