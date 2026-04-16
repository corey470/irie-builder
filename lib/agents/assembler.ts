import { callTextAgent, MODELS } from './anthropic'
import type { BriefInput, AgentOutputs } from './types'

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
): Promise<string> {
  const user = buildUserPrompt(brief, agents)
  // Haiku is the right fit for execution-only work: it's ~3x faster than
  // Sonnet for the same token budget, which keeps us inside the 60s Vercel
  // wall after the upstream agents have already spent ~20-25s. Creativity
  // lives upstream; this role is just wiring decisions into HTML.
  // After 24-26s of upstream agent work we have ~28s before the Vercel
  // 60s wall. Haiku with a large prompt (all 6 agent outputs) runs at
  // ~150 tok/s in practice, so 3500 tokens ≈ 23s — finishes cleanly
  // inside the budget. Leaner HTML, but the visual system is carried by
  // the injected irie-motion-system CSS/JS, not agent-generated tokens.
  const html = await callTextAgent({
    model: MODELS.haiku,
    system: buildSystem(),
    user,
    maxTokens: 3500,
    timeoutMs: 27000,
    label: 'assembler',
  })
  if (!html || html.length < 200) {
    return buildFallbackHtml(brief, agents)
  }
  const cleaned = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  // Reject truncated output — if Haiku ran out of tokens mid-generation we
  // won't have a <body> or </html>. The skeleton fallback is better than
  // a broken page missing its content section.
  if (!cleaned.includes('<body') || !/<\/html>\s*$/.test(cleaned)) {
    console.warn('[assembler] output looked truncated, using fallback')
    return buildFallbackHtml(brief, agents)
  }
  return cleaned
}

function buildUserPrompt(brief: BriefInput, agents: AgentOutputs): string {
  const { creativeDirection, brandVoice, psychologyPlan, artDirection, motionPlan, mobilePlan } = agents
  const sectionNotes = brandVoice.sectionCopyNotes
    .map(n => `- ${n.section}: ${n.note}`)
    .join('\n')
  const emotionSeq = psychologyPlan.emotionSequence
    .map(s => `- ${s.stage.toUpperCase()}: ${s.treatment}`)
    .join('\n')
  const simplifications = mobilePlan.mobileSimplifications.map(s => `- ${s}`).join('\n')

  return `== AGENT DECISIONS (execute these exactly) ==

CREATIVE DIRECTOR:
- Emotional target: ${creativeDirection.emotionalTarget}
- Energy level: ${creativeDirection.energyLevel}
- Overall direction: ${creativeDirection.overallDirection}
- Creative summary: ${creativeDirection.creativeSummary}
- Section order: ${creativeDirection.sectionOrder.join(' -> ')}

BRAND VOICE:
- Tone profile: ${brandVoice.toneProfile}
- Hero headline (VERBATIM): "${brandVoice.heroHeadline}"
- Hero subheadline (VERBATIM): "${brandVoice.heroSubheadline}"
- CTA text (VERBATIM): "${brandVoice.ctaText}"
- Pull-quote (place in trust section): "${brandVoice.pullQuote}"
- Section copy notes:
${sectionNotes}

PSYCHOLOGY DIRECTOR:
- Emotion sequence:
${emotionSeq}
- Trust placement: ${psychologyPlan.trustPlacement}
- CTA timing: ${psychologyPlan.ctaTiming}
- Proof strategy: ${psychologyPlan.proofStrategy}
- Friction points to remove: ${psychologyPlan.frictionPoints.join(', ')}

ART DIRECTOR:
- Display font: ${artDirection.typographySystem.displayFont}
- Body font: ${artDirection.typographySystem.bodyFont}
- Type scale: ${artDirection.typographySystem.scale}
- Type pairing note: ${artDirection.typographySystem.pairing}
- Canvas: ${artDirection.colorPalette.canvas}
- Accent: ${artDirection.colorPalette.accent}
- Text: ${artDirection.colorPalette.text}
- Muted: ${artDirection.colorPalette.muted}
- Highlight: ${artDirection.colorPalette.highlight}
- Palette notes: ${artDirection.colorPalette.notes}
- Layout rhythm: ${artDirection.layoutRhythm}
- Contrast strategy: ${artDirection.contrastStrategy}
- Atmosphere: ${artDirection.atmosphereSummary}

MOTION DIRECTOR:
- Motion intensity: ${motionPlan.motionIntensity}
- Reveal behavior: ${motionPlan.revealBehavior}
- Transition style: ${motionPlan.transitionStyle}
- Scroll rhythm: ${motionPlan.scrollRhythm}
- Atmosphere movement: ${motionPlan.atmosphereMovement}

MOBILE DIRECTOR:
- First viewport strategy: ${mobilePlan.firstViewportStrategy}
- Mobile simplifications:
${simplifications}
- Thumb-friendly notes: ${mobilePlan.thumbFriendlyNotes}
- Mobile motion rules: ${mobilePlan.mobileMotionRules}

== CONTENT INPUTS ==
Brand name: ${brief.brandName || '(invent one that fits the emotional target)'}
Audience: ${brief.audience || '(implied by vibe)'}
Page type: ${brief.pageType}
Hero background image (USE THIS EXACTLY): ${brief.heroImageUrl}
Content images (for feature cards / atmosphere / proof):
${brief.contentImages.join('\n')}

== REQUIREMENTS ==
- <html lang>, <head> with <meta viewport>, OG tags, title derived from brand name.
- Google Fonts <link> for the Art Director's chosen fonts.
- Inline <style> carrying all visual tokens from Art Director.
- Hero section: background-image:url('${brief.heroImageUrl}') cover center, min-height:100vh. Include .orb-1/.orb-2/.orb-3 divs.
- Body has class="grain".
- Apply .reveal / .reveal-left / .reveal-right / .reveal-scale across sections in alternating pattern.
- .stagger on multi-child containers.
- Marquee strip with 8-12 brand keywords.
- Proof section lands DIRECTLY before the CTA section.
- Single primary CTA. Button matches accent color.
- Mobile @media queries: 1-column grid under 768px, 44px tap targets, full-width CTA.
- End with the Built-with-Irie-Builder comment.

Output ONLY complete HTML.`
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
  const brand = brief.brandName || inferBrandFromVibe(brief.rawBrief || brief.vibe || '') || 'Untitled'
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
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${accent};margin-bottom:18px;font-weight:600}
.cta{display:inline-block;padding:18px 28px;background:${accent};color:${canvas};border:none;border-radius:4px;font-weight:700;text-decoration:none;min-height:44px;font-size:15px;letter-spacing:.04em;transition:filter .2s}
.cta:hover{filter:brightness(1.1)}
/* hero */
.hero{min-height:100vh;padding:clamp(1rem,5vw,3rem);display:flex;flex-direction:column;justify-content:center;position:relative;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.7)),url('${heroImg}') center/cover}
.hero>*{position:relative;z-index:2}
.hero h1{font-size:clamp(2.75rem,9vw,6.5rem);font-weight:900;margin-bottom:20px;max-width:18ch;text-shadow:0 2px 12px rgba(0,0,0,.6)}
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
</style>
</head>
<body class="grain">
<section class="hero reveal">
<span class="orb-1"></span><span class="orb-2"></span><span class="orb-3"></span>
<p class="eyebrow">${brand}</p>
<p class="eyebrow">${brand}</p>
<h1>${brandVoice.heroHeadline}</h1>
<p class="sub">${brandVoice.heroSubheadline}</p>
<a class="cta" href="#cta">${brandVoice.ctaText}</a>
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
<h2>${psychologyPlan.emotionSequence.find(s => s.stage === 'curiosity')?.treatment.split('.')[0] || 'Made for the people who feel it before they explain it.'}</h2>
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
<h2>${psychologyPlan.emotionSequence.find(s => s.stage === 'desire')?.treatment.split('.')[0] || brandVoice.pullQuote}</h2>
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
<h2>${psychologyPlan.emotionSequence.find(s => s.stage === 'action')?.treatment.split('.')[0] || brandVoice.heroHeadline}</h2>
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
  const m = text.match(/\b([A-Z][a-z]{3,12})\b/)
  return m ? m[1] : ''
}
