import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface GenerateRequest {
  brandName: string
  headline: string
  tagline: string
  about: string
  heroImageUrl: string
  ctaText: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status })
}

/* Unsplash fallback images by category */
const HERO_IMAGES: Record<string, string> = {
  fashion: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1920&q=80',
  event: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1920&q=80',
  wellness: 'https://images.unsplash.com/photo-1506905925637-6855e6d3f191?auto=format&fit=crop&w=1920&q=80',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1920&q=80',
  creative: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?auto=format&fit=crop&w=1920&q=80',
  default: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1920&q=80',
}

function pickHeroImage(vibe: string, pageType: string): string {
  const v = `${vibe} ${pageType}`.toLowerCase()
  if (v.includes('fashion') || v.includes('streetwear') || v.includes('cloth') || v.includes('store')) return HERO_IMAGES.fashion
  if (v.includes('event') || v.includes('festival') || v.includes('concert') || v.includes('ticket')) return HERO_IMAGES.event
  if (v.includes('wellness') || v.includes('heal') || v.includes('cannabis') || v.includes('nature')) return HERO_IMAGES.wellness
  if (v.includes('food') || v.includes('restaurant') || v.includes('cook') || v.includes('dish')) return HERO_IMAGES.food
  if (v.includes('creative') || v.includes('portfolio') || v.includes('design') || v.includes('art')) return HERO_IMAGES.creative
  return HERO_IMAGES.default
}

const SYSTEM_PROMPT = `You are the AI Creative Director for Irie Builder. You create living, breathing websites that feel ALIVE.

CRITICAL RULE: NEVER invent the user's copy. Use their EXACT headline, tagline, about text, and CTA button text verbatim. Only generate copy for sections the user didn't provide text for (e.g. feature descriptions, social proof quotes).

CREATIVE DECISIONS — announce in an HTML comment at the top:
<!-- CREATIVE DECISIONS
Typography: [display font] + [body font]
Motion vocabulary: [list]
Color temperature: [warm/cool/neutral]
Section order: [list]
Atmosphere: [grain/orbs/gradients]
-->

TYPOGRAPHY: Choose TWO Google Fonts. Display + Body. Load via <link>. Use clamp() for fluid sizing.

MOTION (REQUIRED — all of these):
a) IntersectionObserver with BIDIRECTIONAL animation (in on enter, reset on leave)
b) 6 transition types, never same twice in a row: fade-up, fade, slide-left, scale-up, line-reveal, split
c) Staggered reveals with data-delay="N" (80-120ms gaps)
d) Hero parallax at 0.3x scroll speed via translate3d
e) Custom cursor (REQUIRED, desktop @media(pointer:fine)):
   .cursor{position:fixed;width:8px;height:8px;border-radius:50%;background:VAR_ACCENT;pointer-events:none;z-index:9999;transition:transform .1s}
   .cursor-ring{position:fixed;width:36px;height:36px;border:1.5px solid VAR_ACCENT;border-radius:50%;pointer-events:none;z-index:9998;transition:transform .15s ease-out,opacity .15s}
   JS: two divs follow mouse, ring with elastic delay
f) Floating orbs: 2-3 blurred circles, accent at 5-8% opacity, 60-90s CSS drift
g) Scrolling marquee strip with brand keywords
h) Grain texture overlay at 3-5% opacity
i) Nav: transparent → solid on scroll (80px threshold)

REQUIRED SECTION STRUCTURE (7 sections in this order):
1. Hero — full screen (min-height:100svh), parallax background, user's headline + tagline + CTA button + inline email form
2. Marquee strip — scrolling brand keywords
3. Feature/Collection section — relevant to pageType
4. Brand story — two-column layout with user's about text
5. Atmosphere section — full-bleed image with overlay
6. Email capture — prominent CTA section with user's CTA text
7. Footer — brand name, tagline, copyright, placeholder links

RESPONSIVE: grids→1col at 768px, clamp() typography, 44px touch targets, overflow-x:hidden, forms stack at 480px
ACCESSIBILITY: prefers-reduced-motion disables all, heading hierarchy, alt text, 4.5:1 contrast, focus indicators, labeled form inputs
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

    if (!body.brandName || !body.vibe || !body.colors?.primary) {
      return jsonError('Missing required fields: brandName, vibe, and colors.primary are required', 400)
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return jsonError('ANTHROPIC_API_KEY not configured on server', 500)
    }

    const client = new Anthropic({ apiKey, timeout: 55000 })

    const heroImage = body.heroImageUrl || pickHeroImage(body.vibe, body.pageType)

    const userPrompt = `Create a complete website for this brand:

Brand Name: ${body.brandName}
Hero Headline (USE EXACTLY): ${body.headline || 'Welcome to ' + body.brandName}
Tagline (USE EXACTLY): ${body.tagline || ''}
About Text (USE EXACTLY in brand story section): ${body.about || ''}
CTA Button Text (USE EXACTLY): ${body.ctaText || 'Get Started'}
Hero Background Image URL: ${heroImage}
Emotional Brief / Vibe: ${body.vibe}
Target Audience: ${body.audience || 'general'}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood}
Page Type: ${body.pageType}

REMINDERS:
- Use the user's headline, tagline, about, and CTA text VERBATIM — do not rephrase
- Use the provided hero image URL as the hero background
- Include ALL motion: parallax, bidirectional IntersectionObserver, custom cursor (gold dot + ring), orbs, grain, marquee, nav scroll
- 7 sections: hero → marquee → features → brand story → atmosphere → email capture → footer
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
    })
  } catch (err: unknown) {
    console.error('[generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return jsonError(message, 500)
  }
}
