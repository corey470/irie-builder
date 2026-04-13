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

MOTION — the post-processor guarantees animation CSS/JS. Your job is to apply classes: .reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger, .orb, .orb-1/.orb-2/.orb-3, .marquee-track, .grain (on body). The JS handles cursor, parallax, text split, and IntersectionObserver automatically.

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

    const client = new Anthropic({ apiKey, timeout: 55000 })

    // Detect category for image selection
    const vibeText = (body.rawBrief || body.vibe || '').toLowerCase()
    const category = detectCategory(vibeText + ' ' + (body.heroImageDescription || '') + ' ' + (body.pageType || ''))

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

    let userPrompt: string

    if (body.rawBrief) {
      userPrompt = `RAW BRIEF: "${body.rawBrief}"

Hero Background Image URL (USE THIS): ${heroImage}
Content images to use in sections: ${contentImages.join(', ')}
Colors: Primary ${body.colors.primary}, Accent ${body.colors.accent}, Background ${body.colors.background}
Mood: ${body.mood || 'dark'}
Page Type: ${body.pageType || 'landing'}${feedbackLine}

This is a raw brief — one sentence. Invent everything: brand name, headlines, story, sections. Build a COMPLETE site that looks like a real launched business.
- Hero MUST use background-image:url('${heroImage}') with background-size:cover
- Use the content images above for feature cards and atmosphere sections
- Every section must have REAL content — never placeholder
- Apply .reveal / .reveal-left / .reveal-right / .reveal-scale classes to all content elements
- Add .stagger to containers with multiple children
- Include .orb-1, .orb-2, .orb-3 divs in hero section
- Add class="grain" to <body>
- Include .marquee-track with 8-12 brand keywords repeated twice
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
Page Type: ${body.pageType || 'landing'}${feedbackLine}

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
- CREATIVE DECISIONS comment at top
- Output ONLY HTML`
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

    // FIX 1: Post-process — inject guaranteed animation system
    html = postProcess(html)

    // Extract creative decisions
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
