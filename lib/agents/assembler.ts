import { callTextAgent } from './anthropic'
import type { BriefInput, AgentOutputs } from './types'
import { AGENT_CONFIG } from './config'
import { logWarn } from '@/lib/logging'
import { PRESET_PLACEHOLDER_VALUES } from '@/lib/constants/presetPlaceholders'

/**
 * Assembler — takes every upstream agent decision and executes them into
 * a complete self-contained HTML page. All creative decisions have
 * already been made; this role is execution only.
 *
 * Falls back to a minimal, on-brand HTML skeleton if the Anthropic call
 * fails — the page still renders and still contains real copy from the
 * Brand Voice agent. Never returns null.
 */

function buildSystem(): string {
  return `You are the Assembler for Irie Builder. All creative decisions have already been made by other agents. Your job is EXECUTION only — build exactly what they specified.

CRITICAL BUDGET RULES:
- Your output MUST fit in ~3000 tokens. Prioritize complete structure over CSS detail.
- A post-processor will AUTOMATICALLY inject CSS + JS for: .reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger, .marquee-track, .orb / .orb-1 / .orb-2 / .orb-3, .grain, and the custom cursor. DO NOT REDEFINE ANY OF THESE STYLES. Using those class names is enough.
- Keep your own inline <style> block under 2500 characters. Only define what is brand-specific: colors, fonts, spacing, hero, section layout, typography scale, buttons.
- Finish the page. End with </body></html>. If you're running long, trim CSS detail, never trim HTML structure.

Output: complete, self-contained HTML. Inline <style> + Google Fonts <link> in <head>. No external JS — the motion script is injected.

HARD RULES:
1. Use the EXACT headline, subheadline, CTA text, and pull-quote supplied by Brand Voice. Never paraphrase.
2. Use the EXACT typography, palette, atmosphere summary, layout rhythm from Art Director. Never substitute fonts or colors.
3. Structure sections in the EXACT order from the agent plan. Every page must have at least 4 <section> elements.
4. Apply .reveal / .reveal-left / .reveal-right / .reveal-scale (alternating) on content elements.
5. Apply .stagger on multi-child containers.
6. Include .orb-1, .orb-2, .orb-3 decorative divs inside the hero section.
7. Add class="grain" to <body>.
8. Include one .marquee-track with 8-12 brand keywords doubled for seamless loop.
9. Mobile: 44px touch targets, full-width CTAs, grid collapses to 1 col under 768px, clamp() typography.
10. Every image uses a real URL from the prompt. Never empty src.
11. Every section has real content. No placeholders.
12. Proof section lands directly before the final CTA section.
13. Exactly ONE <p class="eyebrow"> line in the hero section. One eyebrow line only in the hero section. Never duplicate it.
14. Never emit placeholder text like "Your Brand", "Your Name", "Your Restaurant", or "Your Event". Never use placeholder text like "Your Brand". Use the actual brand name from the brief. If no name is provided, derive a short name from the vision prompt.

DESKTOP LAYOUT (required):
- All content containers use max-width: 1200px; margin: 0 auto; with padding: 0 clamp(1rem, 5vw, 3rem).
- Hero: min-height: 100vh; full-bleed background-image with a dark overlay for contrast. Content sits inside a centered .wrap so it never stretches edge-to-edge on desktop.
- Hero headline: font-size: clamp(3rem, 5vw, 7rem).
- Eyebrow: font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase.
- Desktop breakpoint: @media (min-width: 1024px). Never stack unrelated elements side by side that belong on separate lines.

Top of HTML: include a comment block:
<!-- CREATIVE DECISIONS
Typography: [displayFont + bodyFont]
Color system: [canvas + accent + text]
Motion personality: [intensity]
Sections: [section order]
Overall direction: [overallDirection]
-->

End with: <!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. --></body></html>

OUTPUT: ONLY complete HTML. No markdown. No backticks. No explanation.`
}

export async function runAssembler(
  brief: BriefInput,
  agents: AgentOutputs,
  requestId: string,
): Promise<string> {
  const user = buildUserPrompt(brief, agents)
  // Haiku is the right fit for execution-only work: it's ~3x faster than
  // Sonnet for the same token budget, which keeps us inside the 60s Vercel
  // wall after the upstream agents have already spent ~20-25s. Creativity
  // lives upstream; this role is just wiring decisions into HTML.
  const config = AGENT_CONFIG.assembler
  const html = await callTextAgent({
    model: config.model,
    system: buildSystem(),
    user,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    label: 'assembler',
    requestId,
  })
  const resolvedBrand = resolveBrandName(brief)
  if (!html || html.length < 200) {
    return finalizeHtml(buildFallbackHtml(brief, agents), resolvedBrand)
  }
  const cleaned = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  // Reject truncated output — if Haiku ran out of tokens mid-generation we
  // won't have a <body> or </html>. The skeleton fallback is better than
  // a broken page missing its content section.
  if (!cleaned.includes('<body') || !/<\/html>\s*$/.test(cleaned)) {
    logWarn('assembler output looked truncated, using fallback', { requestId })
    return finalizeHtml(buildFallbackHtml(brief, agents), resolvedBrand)
  }
  return finalizeHtml(cleaned, resolvedBrand)
}

function resolveBrandName(brief: BriefInput): string {
  if (brief.brandName && !isPlaceholderName(brief.brandName)) return brief.brandName
  return inferBrandFromVibe(brief.rawBrief || brief.vibe || '') || 'Untitled'
}

function buildUserPrompt(brief: BriefInput, agents: AgentOutputs): string {
  const {
    creativeDirection,
    brandVoice,
    psychologyPlan,
    artDirection,
    motionPlan,
    mobilePlan,
  } = agents
  const short = (value: string | undefined, limit = 140) =>
    value ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''
  const joinLimited = (items: string[], limit = 60, count = 3) =>
    items
      .filter(Boolean)
      .slice(0, count)
      .map(item => short(item, limit))
      .join(', ')
  const sectionNotes = brandVoice.sectionCopyNotes
    .slice(0, 3)
    .map(note => `${note.section}:${short(note.note, 110)}`)
    .join(' · ') || 'none'
  const frictions = joinLimited(psychologyPlan.frictionPoints, 65)
  const simplifications = joinLimited(mobilePlan.mobileSimplifications, 80)
  const contentImages = joinLimited(brief.contentImages, 80)
  const resolvedBrand = resolveBrandName(brief)
  const heroImage = short(brief.heroImageUrl, 180)
  const tone = short(brandVoice.toneProfile, 80)

  return [
    'AGENT BRIEF',
    `Creative: ${short(creativeDirection.overallDirection, 220)} | Target ${short(creativeDirection.emotionalTarget, 90)} | Energy ${creativeDirection.energyLevel} | Sections ${creativeDirection.sectionOrder.join('→')}`,
    `Brand voice: Tone ${tone || 'n/a'} | Hero "${short(brandVoice.heroHeadline, 120)}" | Sub "${short(brandVoice.heroSubheadline, 120)}" | CTA "${short(brandVoice.ctaText, 90)}" | Pull "${short(brandVoice.pullQuote, 110)}" | Notes ${sectionNotes}`,
    `Psychology: Trust ${short(psychologyPlan.trustPlacement, 120)} | CTA ${short(psychologyPlan.ctaTiming, 100)} | Proof ${short(psychologyPlan.proofStrategy, 120)} | Friction ${frictions || 'none'}`,
    `Art: Fonts ${short(artDirection.typographySystem.displayFont, 80)}/${short(artDirection.typographySystem.bodyFont, 80)} | Palette ${short(artDirection.colorPalette.canvas, 20)}/${short(artDirection.colorPalette.accent, 20)}/${short(artDirection.colorPalette.text, 20)} | Layout ${short(artDirection.layoutRhythm, 120)} | Contrast ${short(artDirection.contrastStrategy, 100)} | Atmosphere ${short(artDirection.atmosphereSummary, 120)}`,
    `Motion: ${short(motionPlan.revealBehavior, 120)} | Transition ${short(motionPlan.transitionStyle, 80)} | Cadence ${short(motionPlan.scrollRhythm, 80)} | Atmosphere ${short(motionPlan.atmosphereMovement, 120)} | Intensity ${motionPlan.motionIntensity}`,
    `Mobile: Viewport ${short(mobilePlan.firstViewportStrategy, 120)} | Simplify ${simplifications || 'none'} | Thumb ${short(mobilePlan.thumbFriendlyNotes, 100)} | Motion ${short(mobilePlan.mobileMotionRules, 120)}`,
    `Inputs: Brand ${short(resolvedBrand, 80)} | Audience ${short(brief.audience, 60) || 'implied'} | Type ${short(brief.pageType, 40)} | Hero image ${heroImage} | Content images ${contentImages || 'none'}`,
    `Rules: Keep psychology treatments internal (guidance-only) and never repeat those sentences or any phrase containing section/scroll/CTA/trust/friction/placement. Follow brand voice EXACT hero/sub/CTA, maintain section order ${creativeDirection.sectionOrder.join(' → ')}, keep proof before CTA, include hero .orb-1/.orb-2/.orb-3, body class grain, 44px tap targets, an 8-12 keyword marquee sourced from ${short(creativeDirection.emotionalTarget, 80)} + ${tone || 'tone'}, inline <style> with the palette tokens, and close with the Irie Builder comment. Output complete HTML with <html lang>, <head>/<meta>/<title>/<OG>, and the provided images. No markdown or fences.`,
  ].join('\n')
}

/**
 * Programmatic fallback — a real multi-section page built from every
 * agent's decisions. This is what ships when the Haiku Assembler call
 * times out or returns truncated HTML, which happens regularly inside
 * the Vercel 60s budget. Every section is derived from typed agent
 * output, so the page stays on-brand and narratively coherent.
 */
function buildFallbackHtml(brief: BriefInput, agents: AgentOutputs): string {
  const { brandVoice, artDirection, creativeDirection, psychologyPlan, motionPlan } = agents
  // "Your Brand" (and similar) are preset placeholders submitted by the
  // dashboard's quick-start pills. Never render them as literal copy.
  const suppliedName = isPlaceholderName(brief.brandName) ? '' : (brief.brandName || '')
  const brand = suppliedName || inferBrandFromVibe(brief.rawBrief || brief.vibe || '') || 'Untitled'
  const canvas = artDirection.colorPalette.canvas
  const accent = artDirection.colorPalette.accent
  const text = artDirection.colorPalette.text
  const muted = artDirection.colorPalette.muted
  const displayFont = artDirection.typographySystem.displayFont.replace(/\s+/g, '+')
  const bodyFont = artDirection.typographySystem.bodyFont.replace(/\s+/g, '+')
  const heroImg = brief.heroImageUrl
  const [img1, img2, img3, img4] = brief.contentImages.length >= 4
    ? brief.contentImages
    : [...brief.contentImages, heroImg, heroImg, heroImg, heroImg].slice(0, 4)
  const sectionNote = (key: string, fallback: string) =>
    brandVoice.sectionCopyNotes.find(n => n.section.toLowerCase().includes(key))?.note || fallback
  const curiosityHeading = sectionNote('story', creativeDirection.creativeSummary) || creativeDirection.creativeSummary || 'Why it hits different'
  const desireHeading = sectionNote('difference', brandVoice.pullQuote) || brandVoice.pullQuote
  const actionHeading = sectionNote('cta', brandVoice.heroHeadline) || brandVoice.heroHeadline
  const marqueeWords = buildMarqueeKeywords(creativeDirection.emotionalTarget, brandVoice.toneProfile)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${brand} — ${brandVoice.heroHeadline}</title>
<meta name="description" content="${brandVoice.heroSubheadline}">
<meta property="og:title" content="${brand} — ${brandVoice.heroHeadline}">
<meta property="og:description" content="${brandVoice.heroSubheadline}">
<link href="https://fonts.googleapis.com/css2?family=${displayFont}:wght@400;700;900&family=${bodyFont}:wght@300;400;500;700&display=swap" rel="stylesheet">
<!-- CREATIVE DECISIONS
Typography: ${artDirection.typographySystem.displayFont} + ${artDirection.typographySystem.bodyFont}
Color system: ${canvas} canvas, ${accent} accent, ${text} text
Motion personality: ${motionPlan.motionIntensity}
Sections: ${creativeDirection.sectionOrder.join(' → ')}
Overall direction: ${creativeDirection.overallDirection}
-->
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{overflow-x:hidden}
body{background:${canvas};color:${text};font-family:'${artDirection.typographySystem.bodyFont}',system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'${artDirection.typographySystem.displayFont}',Georgia,serif;line-height:1.05;letter-spacing:-0.01em}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:1200px;margin:0 auto;padding:0 clamp(1rem,5vw,3rem)}
.eyebrow{font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:${accent};margin-bottom:18px;font-weight:600}
.cta{display:inline-block;padding:18px 28px;background:${accent};color:${canvas};border:none;border-radius:4px;font-weight:700;text-decoration:none;min-height:44px;font-size:15px;letter-spacing:.04em;transition:filter .2s}
.cta:hover{filter:brightness(1.1)}
/* hero — full-bleed background, content constrained and centered */
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;position:relative;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.7)),url('${heroImg}') center/cover}
.hero .wrap{position:relative;z-index:2}
.hero h1{font-size:clamp(3rem,5vw,7rem);font-weight:900;margin-bottom:20px;max-width:18ch;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.hero .sub{font-size:clamp(17px,2.5vw,22px);opacity:.88;max-width:640px;margin-bottom:36px;font-weight:300}
.orb-1,.orb-2,.orb-3{position:absolute;border-radius:50%;pointer-events:none}
.orb-1{width:340px;height:340px;background:radial-gradient(circle,${accent}33 0%,transparent 70%);top:-80px;right:-60px}
.orb-2{width:220px;height:220px;background:radial-gradient(circle,${accent}22 0%,transparent 70%);bottom:60px;left:-40px}
.orb-3{width:160px;height:160px;background:radial-gradient(circle,${accent}33 0%,transparent 70%);top:40%;left:30%}
/* marquee */
.marquee{padding:24px 0;border-top:1px solid ${accent}33;border-bottom:1px solid ${accent}33;overflow:hidden;background:${canvas}}
.marquee span{font-family:'${artDirection.typographySystem.displayFont}',Georgia,serif;font-style:italic;font-size:clamp(2rem,7vw,4.5rem);white-space:nowrap;padding:0 1rem;color:${text}}
.marquee span:nth-child(odd){color:${accent}}
/* generic section */
.section{padding:clamp(4rem,10vw,8rem) 0}
.section h2{font-size:clamp(2rem,6vw,3.5rem);font-weight:700;margin-bottom:20px;max-width:16ch}
.section .lead{color:${muted};font-size:clamp(17px,2vw,20px);max-width:60ch;margin-bottom:32px;font-weight:300}
.section .inner{display:grid;gap:clamp(1.5rem,3vw,2.5rem);grid-template-columns:1fr 1fr;align-items:center}
.section .inner img{border-radius:6px;width:100%;aspect-ratio:4/5;object-fit:cover}
/* cards */
.cards{display:grid;gap:1px;grid-template-columns:repeat(3,1fr);background:${accent}22;border:1px solid ${accent}22}
.card{background:${canvas};padding:clamp(1.5rem,3vw,2.5rem)}
.card h3{font-size:clamp(1.25rem,2vw,1.75rem);font-weight:700;font-style:italic;margin-bottom:10px;color:${accent}}
.card p{color:${muted};font-size:15px}
/* proof */
.proof{padding:clamp(4rem,10vw,8rem) 0;background:linear-gradient(180deg,${canvas} 0%,${accent}0a 100%);border-top:1px solid ${accent}22}
.proof blockquote{font-family:'${artDirection.typographySystem.displayFont}',Georgia,serif;font-style:italic;font-size:clamp(1.75rem,4vw,2.75rem);line-height:1.2;max-width:24ch;margin:0 auto;text-align:center}
.proof cite{display:block;margin-top:24px;font-family:'${artDirection.typographySystem.bodyFont}',system-ui,sans-serif;font-size:13px;color:${muted};font-style:normal;letter-spacing:.1em;text-transform:uppercase}
/* cta section */
.cta-section{padding:clamp(5rem,12vw,10rem) 0;text-align:center;position:relative}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at center,${accent}12 0%,transparent 70%);pointer-events:none}
.cta-section>*{position:relative;z-index:1}
.cta-section h2{font-size:clamp(2.25rem,7vw,4.5rem);max-width:16ch;margin:0 auto 28px}
/* footer */
footer{padding:3rem 0 4rem;border-top:1px solid ${accent}22;color:${muted};font-size:14px}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem}
/* mobile */
@media(max-width:768px){
  .section .inner{grid-template-columns:1fr}
  .cards{grid-template-columns:1fr}
  .hero h1{font-size:clamp(2.25rem,10vw,3.75rem)}
  .cta{width:100%;text-align:center}
  footer .wrap{flex-direction:column}
}
/* desktop — enforce max-width containers so content composes inside 1200px */
@media(min-width:1024px){
  .hero{padding:0}
  .hero .wrap{padding:0 clamp(2rem,5vw,3rem)}
  .section .inner{grid-template-columns:3fr 2fr}
  .cta-section h2{font-size:clamp(3rem,5vw,5.5rem)}
}
</style>
</head>
<body class="grain">
<section class="hero reveal">
<span class="orb-1"></span><span class="orb-2"></span><span class="orb-3"></span>
<div class="wrap">
<p class="eyebrow">${brand}</p>
<h1>${brandVoice.heroHeadline}</h1>
<p class="sub">${brandVoice.heroSubheadline}</p>
<a class="cta" href="#cta">${brandVoice.ctaText}</a>
</div>
</section>

<!-- MARQUEE -->
<div class="marquee">
<div class="marquee-track">
${marqueeWords.map(w => `<span>${w}</span><span>·</span>`).join('')}
${marqueeWords.map(w => `<span>${w}</span><span>·</span>`).join('')}
</div>
</div>

<!-- CURIOSITY -->
<section class="section reveal-left">
<div class="wrap">
<p class="eyebrow">Why it hits different</p>
<h2>${curiosityHeading}</h2>
<div class="inner stagger">
<div>
<p class="lead">${sectionNote('story', creativeDirection.creativeSummary)}</p>
<p class="lead">${sectionNote('difference', psychologyPlan.proofStrategy)}</p>
</div>
<img src="${img1}" alt="${brand} studio">
</div>
</div>
</section>

<!-- DESIRE -->
<section class="section reveal-right">
<div class="wrap">
<p class="eyebrow">The work</p>
<h2>${desireHeading}</h2>
<div class="cards stagger">
<div class="card"><h3>Drop 01</h3><p>${sectionNote('drop', 'Small runs. Printed in-house. Never restocked.')}</p><img src="${img2}" alt=""></div>
<div class="card"><h3>Drop 02</h3><p>${sectionNote('collection', 'Every piece carries a story you can wear on your shoulder.')}</p><img src="${img3}" alt=""></div>
<div class="card"><h3>Drop 03</h3><p>${sectionNote('feature', 'For the people who found us, not the other way around.')}</p><img src="${img4}" alt=""></div>
</div>
</div>
</section>

<!-- TRUST / PROOF -->
<section class="proof reveal-scale">
<div class="wrap">
<p class="eyebrow" style="text-align:center">What they're saying</p>
<blockquote>&ldquo;${brandVoice.pullQuote}&rdquo;<cite>— ${psychologyPlan.trustPlacement.split('.')[0] || 'The people who moved with us from the start'}</cite></blockquote>
</div>
</section>

<!-- ACTION -->
<section class="cta-section reveal" id="cta">
<div class="wrap">
<p class="eyebrow">${creativeDirection.energyLevel}</p>
<h2>${actionHeading}</h2>
<p class="lead" style="max-width:42ch;margin:0 auto 40px">${brandVoice.heroSubheadline}</p>
<a class="cta" href="#">${brandVoice.ctaText}</a>
</div>
</section>

<footer>
<div class="wrap">
<span>© 2026 ${brand}. Made with intention.</span>
<span>${artDirection.typographySystem.displayFont} · ${artDirection.typographySystem.bodyFont}</span>
</div>
</footer>

<!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->
</body>
</html>`
}

function buildMarqueeKeywords(emotional: string, tone: string): string[] {
  // Extract interesting tokens from the agent decisions to power the marquee.
  const pool = (emotional + ' ' + tone)
    .toLowerCase()
    .replace(/[^a-z0-9\s·]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && w.length <= 14)
  const seed = ['alive', 'real', 'culture', 'craft', 'studio', 'drop', 'moment', 'worn', 'found', 'made']
  const uniq = Array.from(new Set([...pool, ...seed])).slice(0, 10)
  return uniq.length >= 6 ? uniq : seed
}

function inferBrandFromVibe(text: string): string {
  // When no brand name is provided, try a short ownable-feeling noun
  // derived from the vibe. Falls through to 'Untitled' if nothing fits.
  const titleCaseMatch = text.match(/\b([A-Z][A-Za-z0-9'&-]{2,15}(?:\s+[A-Z][A-Za-z0-9'&-]{2,15}){0,2})\b/)
  if (titleCaseMatch && !isPlaceholderName(titleCaseMatch[1])) return titleCaseMatch[1].trim()

  const stopWords = new Set([
    'a', 'an', 'and', 'at', 'be', 'but', 'by', 'for', 'from', 'if', 'in', 'into',
    'is', 'it', 'its', 'of', 'on', 'or', 'so', 'that', 'the', 'their', 'this',
    'to', 'up', 'we', 'with', 'you', 'your',
  ])
  const tokens = text
    .replace(/[^a-zA-Z0-9'&-]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !stopWords.has(token.toLowerCase()))

  return tokens
    .slice(0, 3)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

/**
 * The dashboard's quick-start presets ship "Your Brand", "Your Name",
 * "Your Restaurant", "Your Event" as placeholder answers that users are
 * supposed to edit. If they don't, the Assembler must still never emit
 * literal placeholder copy. Match case-insensitively and also catch the
 * common "Your + Noun" family.
 */
function isPlaceholderName(name: string | undefined): boolean {
  if (!name) return false
  const normalized = name.trim().toLowerCase()
  return PRESET_PLACEHOLDER_VALUES.some(value => value.toLowerCase() === normalized) || /^your\s+[a-z]+$/.test(normalized)
}

/**
 * Strip any lingering "Your Brand" / "Your Name" / "Your Restaurant"
 * literals from the returned HTML — either Haiku echoed the preset
 * placeholder verbatim, or a section fell back on it. Always replace
 * with the resolved brand name.
 */
function sanitizePlaceholders(html: string, brand: string): string {
  const safe = brand || 'Untitled'
  const sharedPlaceholders = PRESET_PLACEHOLDER_VALUES.map(escapeRegExp).join('|')
  return html.replace(new RegExp(`\\b(?:${sharedPlaceholders}|Your\\s+(?:Shop|Company|Business))\\b`, 'gi'), safe)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function finalizeHtml(html: string, brand: string): string {
  const safeBrand = brand || 'Untitled'
  return ensureHeroDesktopGuardrails(enforceSingleHeroEyebrow(sanitizePlaceholders(html, safeBrand), safeBrand))
}

function enforceSingleHeroEyebrow(html: string, brand: string): string {
  return html.replace(
    /(<section\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>)([\s\S]*?)(<\/section>)/i,
    (_match, open, inner, close) => {
      const eyebrowPattern = /<p\b[^>]*class=["'][^"']*\beyebrow\b[^"']*["'][^>]*>[\s\S]*?<\/p>/gi
      const eyebrows = inner.match(eyebrowPattern) || []
      const heroEyebrow = `<p class="eyebrow">${brand}</p>`

      if (eyebrows.length === 0) {
        if (/<div\b[^>]*class=["'][^"']*\bwrap\b[^"']*["'][^>]*>/i.test(inner)) {
          return `${open}${inner.replace(/(<div\b[^>]*class=["'][^"']*\bwrap\b[^"']*["'][^>]*>)/i, `$1\n${heroEyebrow}`)}${close}`
        }
        return `${open}\n${heroEyebrow}${inner}${close}`
      }

      let kept = false
      const deduped = inner.replace(eyebrowPattern, () => {
        if (kept) return ''
        kept = true
        return heroEyebrow
      })
      return `${open}${deduped}${close}`
    },
  )
}

function ensureHeroDesktopGuardrails(html: string): string {
  const patch = `
/* irie-assembler-desktop-guardrails */
.hero{min-height:100vh;display:flex;align-items:center;position:relative}
.hero .wrap,.section .wrap,footer .wrap{width:min(100%,1200px);max-width:1200px;margin:0 auto;padding:0 clamp(1rem,5vw,3rem)}
.hero .wrap{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:0}
.hero .wrap > *{display:block}
.hero h1{font-size:clamp(3rem,5vw,7rem)}
.eyebrow{font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase}
@media (min-width:1024px){
  .hero{min-height:100vh}
  .hero .wrap{width:min(100%,1200px)}
}`

  if (html.includes('irie-assembler-desktop-guardrails')) return html
  if (/<style\b[^>]*>/i.test(html)) {
    return html.replace(/<\/style>/i, `${patch}\n</style>`)
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<style>${patch}\n</style>\n</head>`)
  }
  return html
}
