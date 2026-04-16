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
  // The upstream agents (Psychology Director, Art Director, Motion Director)
  // have already encoded the PSYCHOLOGY.md and DESIGN.md rules into typed
  // decisions — injecting the raw markdown here is dead weight that slows
  // the function past Vercel's 60s wall. The Assembler is execution only.
  return `You are the Assembler for Irie Builder. All creative decisions have already been made by other agents. Your job is EXECUTION only — build exactly what they specified.

Output: complete, self-contained HTML. Inline <style> and <script>. Google Fonts <link> in <head> is allowed — no other external assets except images supplied in the prompt.

HARD RULES:
1. Use the EXACT headline, subheadline, CTA text, and pull-quote supplied by Brand Voice. Never paraphrase.
2. Use the EXACT typography, palette, atmosphere summary, layout rhythm, and contrast strategy from Art Director. Never substitute fonts or colors.
3. Structure sections in the EXACT order specified by Creative Director / Psychology Director. Never reorder.
4. Apply .reveal / .reveal-left / .reveal-right / .reveal-scale classes to content elements (alternating pattern). A post-processor will inject the animation CSS/JS — your classes must already be present.
5. Apply .stagger to containers with multiple children.
6. Include .orb-1, .orb-2, .orb-3 decorative divs in the hero section.
7. Add class="grain" to <body>.
8. Include a .marquee-track with 8-12 real brand keywords repeated twice for seamless loop.
9. Mobile rules: 44px touch targets, full-width CTAs on mobile, grid collapses to 1 column under 768px, clamp() typography, overflow-x:hidden on body.
10. Every image uses a real URL (supplied in the prompt). Never <img src="">.
11. Every section has real content — never placeholder text.
12. Put proof directly before the final CTA (placement decided by Psychology Director).

At the top of the HTML, include a comment block:
<!-- CREATIVE DECISIONS
Typography: [displayFont + bodyFont] — [pairing note]
Color system: [canvas + accent + text]
Motion personality: [intensity + transitionStyle]
Sections: [section order]
Overall direction: [overallDirection]
-->

End with: <!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->

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
  // Tight token budget so we stay under the Vercel 60s wall after 24s of
  // upstream agent work. Haiku at ~200 tok/s → 4500 tokens ≈ 22s.
  const html = await callTextAgent({
    model: MODELS.haiku,
    system: buildSystem(),
    user,
    maxTokens: 4500,
    timeoutMs: 26000,
    label: 'assembler',
  })
  if (!html || html.length < 200) {
    return buildFallbackHtml(brief, agents)
  }
  return html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
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

function buildFallbackHtml(brief: BriefInput, agents: AgentOutputs): string {
  const { brandVoice, artDirection, creativeDirection } = agents
  const brand = brief.brandName || 'Irie'
  const canvas = artDirection.colorPalette.canvas
  const accent = artDirection.colorPalette.accent
  const text = artDirection.colorPalette.text
  const displayFont = artDirection.typographySystem.displayFont.replace(/\s+/g, '+')
  const bodyFont = artDirection.typographySystem.bodyFont.replace(/\s+/g, '+')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${brand}</title>
<link href="https://fonts.googleapis.com/css2?family=${displayFont}:wght@400;700;900&family=${bodyFont}:wght@300;400;500;700&display=swap" rel="stylesheet">
<!-- CREATIVE DECISIONS
Typography: ${artDirection.typographySystem.displayFont} + ${artDirection.typographySystem.bodyFont}
Color system: ${canvas} canvas, ${accent} accent
Overall direction: ${creativeDirection.overallDirection}
-->
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:${canvas};color:${text};font-family:'${artDirection.typographySystem.bodyFont}',system-ui,sans-serif;overflow-x:hidden}
h1,h2,h3{font-family:'${artDirection.typographySystem.displayFont}',Georgia,serif;line-height:1.05}
.hero{min-height:100vh;padding:24px;display:flex;flex-direction:column;justify-content:center;position:relative;background:url('${brief.heroImageUrl}') center/cover}
.hero::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.7))}
.hero>*{position:relative;z-index:1}
.eyebrow{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:${accent};margin-bottom:16px}
h1{font-size:clamp(2.5rem,9vw,6rem);font-weight:900;margin-bottom:18px}
.sub{font-size:clamp(18px,3vw,22px);opacity:.8;max-width:620px;margin-bottom:32px}
.cta{display:inline-block;padding:18px 28px;background:${accent};color:${canvas};border:none;border-radius:4px;font-weight:700;text-decoration:none;min-height:44px}
.orb-1,.orb-2,.orb-3{position:absolute;border-radius:50%;filter:blur(60px);opacity:.2;pointer-events:none}
.orb-1{width:320px;height:320px;background:radial-gradient(circle,${accent} 0%,transparent 70%);top:-60px;right:-80px}
.orb-2{width:200px;height:200px;background:radial-gradient(circle,${accent} 0%,transparent 70%);bottom:80px;left:-40px}
.orb-3{width:140px;height:140px;background:radial-gradient(circle,${accent} 0%,transparent 70%);top:40%;left:30%}
@media(max-width:768px){h1{font-size:clamp(2rem,10vw,3.5rem)}.cta{width:100%;text-align:center}}
</style>
</head>
<body class="grain">
<section class="hero reveal">
<span class="orb-1"></span><span class="orb-2"></span><span class="orb-3"></span>
<p class="eyebrow">${brand}</p>
<h1>${brandVoice.heroHeadline}</h1>
<p class="sub">${brandVoice.heroSubheadline}</p>
<a class="cta" href="#">${brandVoice.ctaText}</a>
</section>
<!-- Built with Irie Builder — There's no perfect website. Only one that feels right to you. -->
</body>
</html>`
}
