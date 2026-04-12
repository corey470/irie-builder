import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface GenerateRequest {
  brandName: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status })
}

const SYSTEM_PROMPT = `You are the AI Creative Director for Irie Builder — the first website builder for brands with a vibe. You create living, breathing websites that feel ALIVE.

YOUR PROCESS — start from the emotional brief, NOT from a template:

1. FEEL THE BRAND FIRST
Read the vibe description deeply. What emotion dominates? What story arc does this brand want to tell? What should someone FEEL when they land here?

2. MAKE EXPLICIT CREATIVE DECISIONS — announce each one as an HTML comment at the top of your output:
<!-- CREATIVE DECISIONS
Typography: [display font] + [body font] — why this pairing
Motion vocabulary: [list the specific animation types you chose and why]
Color temperature: [warm/cool/neutral] — how the palette serves the mood
Section order: [list sections in order] — why this narrative arc
Visual density: [generous spacing / controlled density] — what serves this brand
Atmosphere: [grain/orbs/gradients/none] — what texture creates the right feel
-->

3. TYPOGRAPHY RULES
- Choose TWO Google Fonts that serve the brand's personality
- Display font for headlines (Playfair Display, Cormorant Garamond, DM Serif Display, Space Grotesk, etc.)
- Body font for UI/text (Syne, DM Sans, Inter, Work Sans, etc.)
- Load via <link> tag from fonts.googleapis.com
- Use clamp() for fluid sizing: clamp(min, preferred, max)

4. MOTION — THE CORE DIFFERENTIATOR
Every generated site MUST include ALL of these:

a) IntersectionObserver scroll animations with BIDIRECTIONAL motion:
   - Elements animate IN when entering viewport
   - Elements animate OUT (reset) when leaving viewport
   - This creates the "living" feel — the page breathes

b) 6 transition types — NEVER use the same type twice in a row:
   - fade-up: translateY(32px) + opacity
   - fade: opacity only
   - slide-left: translateX(-48px) + opacity
   - scale-up: scale(0.94) + opacity
   - line-reveal: scaleX(0) to scaleX(1)
   - split: left panel slides left, right panel slides right

c) Staggered reveals: use data-delay="N" for children, with 80-120ms gaps

d) Hero parallax: background image moves at 0.3x scroll speed using transform: translate3d()

e) Custom cursor (desktop only, @media(pointer:fine)):
   - Small gold dot (8px) that follows mouse instantly
   - Larger ring (36px) that follows with elastic delay
   - Both use the brand's accent color

f) Floating orbs: 2-3 large blurred circles using the accent color at 5-8% opacity,
   animated with slow CSS keyframe drift (60-90s cycle), positioned absolute

g) Scrolling text strip: a full-width marquee-style strip in the hero area
   with repeating brand keywords, using CSS animation translateX

h) Grain texture overlay: a full-viewport fixed div with a CSS noise pattern
   at 3-5% opacity for atmosphere

i) Nav behavior: starts transparent, fades to solid on scroll (80px threshold).
   On scroll, nav items drift slightly toward center.

5. SECTION STRUCTURE
Generate 6-8 sections based on the pageType:

For "landing": hero → problem/pain → solution → features/modes → social proof → CTA
For "store": hero → featured collection → brand story → product grid → lifestyle → CTA
For "portfolio": hero → selected work grid → about/process → testimonials → contact CTA
For "event": hero → lineup/schedule → about → venue/location → tickets → sponsors → CTA

Each section must have:
- A data-animate attribute with the transition type
- Proper semantic HTML
- Generous padding: py of clamp(4rem, 10vw, 8rem)
- Full-width with max-width container inside

6. EMAIL CAPTURE
Include TWO email forms:
- One in the hero section (inline, minimal)
- One as the bottom CTA section (larger, more prominent)
Both with: <form> with email input + submit button, styled to match brand
CRITICAL: Every <input> MUST have a matching <label> element with for/id pairing. Use visually-hidden labels if needed (position:absolute; clip:rect(0,0,0,0); height:1px; width:1px; overflow:hidden).

7. RESPONSIVE DESIGN (CRITICAL)
- All grids: use CSS grid with auto-fit/auto-fill or explicit breakpoints
- At max-width 768px: all multi-column grids collapse to single column
- Typography: ALL font sizes use clamp() for fluid scaling
- Touch targets: all buttons and interactive elements min 44px height
- No horizontal overflow: use overflow-x: hidden on body
- Form layout: stacks vertically at 480px
- Images: max-width: 100%, height: auto

8. ACCESSIBILITY
- prefers-reduced-motion: disable ALL animations, transitions, and transforms
- Proper heading hierarchy (h1 → h2 → h3)
- Alt text on all images
- Sufficient color contrast (4.5:1 for text)
- Focus indicators on all interactive elements
- aria-labels on icon-only buttons

9. META & STRUCTURE
- Proper DOCTYPE, lang="en", charset UTF-8, viewport meta
- OG meta tags with brand name and description
- <title> tag with brand name
- Footer with brand name, copyright year, and placeholder links

10. OUTPUT FORMAT
Return ONLY the complete HTML document. No markdown. No backticks. No explanation.
The HTML must be completely self-contained — inline CSS in a <style> tag, inline JS in a <script> tag.
The only external resources allowed are Google Fonts via <link>.

QUALITY BAR: The output must feel like iriethreads.vercel.app — premium, atmospheric, alive with motion. NOT a template. An experience.

IMPORTANT: Be concise with CSS. Combine selectors. Use shorthand properties. Keep total output under 8000 tokens so generation completes quickly.`

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

    const userPrompt = `Create a complete, self-contained HTML website for this brand:

Brand Name: ${body.brandName}
Emotional Brief: ${body.vibe}
Target Audience: ${body.audience || 'general'}
Color Palette:
  - Primary: ${body.colors.primary}
  - Accent: ${body.colors.accent}
  - Background: ${body.colors.background}
Mood: ${body.mood}
Page Type: ${body.pageType}

Remember:
- Start from the emotion, not from a template
- Make and document your creative decisions in an HTML comment
- Include ALL motion features: parallax, IntersectionObserver bidirectional scroll animations, custom cursor, floating orbs, grain overlay, scrolling text strip, nav scroll behavior
- Use 6 different transition types, never the same twice in a row
- Two email capture forms with proper <label> elements
- Fully responsive at 768px and 480px breakpoints
- prefers-reduced-motion respected
- Be concise with CSS — combine selectors, use shorthand
- Output ONLY the HTML — no markdown, no backticks, no explanation`

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

    // Strip any markdown wrapping if Claude accidentally adds it
    html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    // Extract metadata from the output
    const fonts: string[] = []
    const sections: string[] = []
    const motionVocabulary: string[] = []

    const fontMatch = html.match(/fonts\.googleapis\.com\/css2\?family=([^"&]+)/)
    if (fontMatch) {
      fontMatch[1].split('&family=').forEach(f => {
        fonts.push(decodeURIComponent(f.split(':')[0].replace(/\+/g, ' ')))
      })
    }

    const sectionMatches = html.matchAll(/data-animate="([^"]+)"/g)
    for (const m of sectionMatches) {
      if (!motionVocabulary.includes(m[1])) motionVocabulary.push(m[1])
    }

    const sectionTagMatches = html.matchAll(/<section[^>]*(?:id="([^"]+)"|class="[^"]*([^"]*section[^"]*)")/gi)
    for (const m of sectionTagMatches) {
      const name = m[1] || 'section'
      if (!sections.includes(name)) sections.push(name)
    }

    return NextResponse.json({
      html,
      metadata: {
        fonts,
        sections,
        palette: body.colors,
        motionVocabulary,
      },
    })
  } catch (err: unknown) {
    // Catch-all: ALWAYS return valid JSON no matter what
    console.error('[generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return jsonError(message, 500)
  }
}
