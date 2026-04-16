import { runCreativeDirector } from './creative-director'
import { runBrandVoice } from './brand-voice'
import { runPsychologyDirector } from './psychology-director'
import { runArtDirector } from './art-director'
import { runMotionDirector } from './motion-director'
import { runMobileDirector } from './mobile-director'
import { runAssembler } from './assembler'
import { runCritic } from './critic'
import {
  creativeDirectionFallback,
  brandVoiceFallback,
  psychologyPlanFallback,
  artDirectionFallback,
  motionPlanFallback,
  mobilePlanFallback,
  criticFallback,
} from './fallbacks'
import { setStatus } from './status-store'
import type {
  BriefInput,
  AgentOutputs,
  AgentName,
  AgentState,
  StreamEvent,
  CompletePayload,
  AgentCreativeDecision,
  LegacyBlueprint,
} from './types'
import { VISIBLE_AGENTS } from './types'

/**
 * The orchestrator runs agents in staged parallelism:
 *
 *   Stage 1 (sequential): Creative Director
 *   Stage 2 (parallel):    Brand Voice | Psychology Director | Art Director
 *   Stage 3 (parallel):    Motion Director | Mobile Director
 *   Stage 4 (sequential):  Assembler
 *   Stage 5 (sequential):  Critic
 *
 * Every agent call is wrapped with a per-call timeout inside
 * lib/agents/anthropic.ts. If an agent fails or times out, its fallback
 * value is used and the pipeline continues — a single failure never kills
 * generation.
 *
 * The orchestrator accepts a requestId (for the status-store) and an
 * onEvent callback so the route can fan events out to a streaming
 * response in real time.
 */

export interface OrchestratorInput {
  requestId: string
  brief: BriefInput
  onEvent: (event: StreamEvent) => void
}

export interface OrchestratorResult {
  payload: CompletePayload
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { requestId, brief, onEvent } = input

  // All agents start as "waiting" so the UI can render the full roster.
  for (const a of VISIBLE_AGENTS) {
    emit(onEvent, requestId, a.name, 'waiting')
  }

  // ── Stage 1: Creative Director ───────────────
  emit(onEvent, requestId, 'creative-director', 'working')
  let creativeDirection
  try {
    creativeDirection = await runCreativeDirector(brief)
    emit(onEvent, requestId, 'creative-director', 'done')
  } catch (err) {
    console.error('[orchestrator] creative-director threw:', err)
    creativeDirection = creativeDirectionFallback(brief)
    emit(onEvent, requestId, 'creative-director', 'failed')
  }

  // ── Stage 2: Brand Voice | Psychology | Art Direction (parallel) ──
  emit(onEvent, requestId, 'brand-voice', 'working')
  emit(onEvent, requestId, 'psychology-director', 'working')
  emit(onEvent, requestId, 'art-director', 'working')

  const [brandVoice, psychologyPlan, artDirection] = await Promise.all([
    runBrandVoice(brief, creativeDirection)
      .then(v => { emit(onEvent, requestId, 'brand-voice', 'done'); return v })
      .catch(err => {
        console.error('[orchestrator] brand-voice threw:', err)
        emit(onEvent, requestId, 'brand-voice', 'failed')
        return brandVoiceFallback(brief)
      }),
    runPsychologyDirector(brief, creativeDirection)
      .then(v => { emit(onEvent, requestId, 'psychology-director', 'done'); return v })
      .catch(err => {
        console.error('[orchestrator] psychology-director threw:', err)
        emit(onEvent, requestId, 'psychology-director', 'failed')
        return psychologyPlanFallback(brief)
      }),
    runArtDirector(brief, creativeDirection)
      .then(v => { emit(onEvent, requestId, 'art-director', 'done'); return v })
      .catch(err => {
        console.error('[orchestrator] art-director threw:', err)
        emit(onEvent, requestId, 'art-director', 'failed')
        return artDirectionFallback(brief)
      }),
  ])

  // ── Stage 3: Motion Director | Mobile Director (parallel) ──
  emit(onEvent, requestId, 'motion-director', 'working')
  emit(onEvent, requestId, 'mobile-director', 'working')

  const [motionPlan, mobilePlan] = await Promise.all([
    runMotionDirector(brief, creativeDirection, artDirection)
      .then(v => { emit(onEvent, requestId, 'motion-director', 'done'); return v })
      .catch(err => {
        console.error('[orchestrator] motion-director threw:', err)
        emit(onEvent, requestId, 'motion-director', 'failed')
        return motionPlanFallback(brief)
      }),
    runMobileDirector(brief, creativeDirection)
      .then(v => { emit(onEvent, requestId, 'mobile-director', 'done'); return v })
      .catch(err => {
        console.error('[orchestrator] mobile-director threw:', err)
        emit(onEvent, requestId, 'mobile-director', 'failed')
        return mobilePlanFallback(brief)
      }),
  ])

  const agentOutputs: AgentOutputs = {
    creativeDirection,
    brandVoice,
    psychologyPlan,
    artDirection,
    motionPlan,
    mobilePlan,
  }

  // ── Stage 4: Assembler ───────────────────────
  emit(onEvent, requestId, 'assembler', 'working')
  let html: string
  try {
    html = await runAssembler(brief, agentOutputs)
    emit(onEvent, requestId, 'assembler', 'done')
  } catch (err) {
    console.error('[orchestrator] assembler threw:', err)
    // runAssembler already has an internal fallback, but guard anyway
    html = '<!DOCTYPE html><html><body><h1>Something went wrong.</h1></body></html>'
    emit(onEvent, requestId, 'assembler', 'failed')
  }

  // Post-process with the guaranteed motion system from the existing route
  html = postProcessHtml(html)

  // ── Stage 5: Critic ──────────────────────────
  emit(onEvent, requestId, 'critic', 'working')
  let critic
  try {
    critic = await runCritic(html, agentOutputs)
    emit(onEvent, requestId, 'critic', 'done')
  } catch (err) {
    console.error('[orchestrator] critic threw:', err)
    critic = criticFallback()
    emit(onEvent, requestId, 'critic', 'failed')
  }

  // Build the complete payload in the shape the dashboard already expects
  const payload: CompletePayload = {
    html,
    metadata: extractMetadata(html, brief),
    decisions: buildCreativeDecisions(agentOutputs),
    critique: mapCriticToLegacyShape(critic),
    blueprint: mapAgentsToLegacyBlueprint(brief, agentOutputs),
    agentOutputs,
    designDirection: brief.designDirection,
    referenceStyles: brief.referenceStyles,
  }

  return { payload }
}

function emit(
  onEvent: (e: StreamEvent) => void,
  requestId: string,
  agent: AgentName,
  state: AgentState,
) {
  setStatus(requestId, agent, state)
  onEvent({ type: 'status', agent, state, at: Date.now() })
}

/* ── Build the attributed Creative Decisions list ── */
export function buildCreativeDecisions(agents: AgentOutputs): AgentCreativeDecision[] {
  const { creativeDirection, brandVoice, psychologyPlan, artDirection, motionPlan } = agents
  return [
    {
      label: 'Typography pairing',
      value: `${artDirection.typographySystem.displayFont} + ${artDirection.typographySystem.bodyFont}`,
      reason: artDirection.typographySystem.pairing,
      agent: 'Art Director',
    },
    {
      label: 'Color system',
      value: `${artDirection.colorPalette.canvas} canvas · ${artDirection.colorPalette.accent} accent · ${artDirection.colorPalette.text} text`,
      reason: artDirection.colorPalette.notes,
      agent: 'Art Director',
    },
    {
      label: 'Motion personality',
      value: `${motionPlan.motionIntensity} — ${motionPlan.transitionStyle}`,
      reason: motionPlan.revealBehavior,
      agent: 'Motion Director',
    },
    {
      label: 'Atmosphere layer',
      value: artDirection.atmosphereSummary,
      reason: motionPlan.atmosphereMovement,
      agent: 'Creative Director + Art Director',
    },
    {
      label: 'Section architecture',
      value: creativeDirection.sectionOrder.join(' → '),
      reason: psychologyPlan.emotionSequence.map(s => `${s.stage}: ${s.treatment}`).join(' | '),
      agent: 'Psychology Director',
    },
    {
      label: 'Brand voice',
      value: brandVoice.toneProfile,
      reason: `Hero: "${brandVoice.heroHeadline}" — Pull-quote: "${brandVoice.pullQuote}"`,
      agent: 'Brand Voice',
    },
    {
      label: 'Hero treatment',
      value: `${creativeDirection.energyLevel} hero with "${brandVoice.heroHeadline}"`,
      reason: artDirection.layoutRhythm,
      agent: 'Art Director + Creative Director',
    },
    {
      label: 'Overall direction',
      value: creativeDirection.overallDirection,
      reason: creativeDirection.creativeSummary,
      agent: 'Creative Director',
    },
  ]
}

function mapCriticToLegacyShape(c: ReturnType<typeof criticFallback>) {
  const scale = (n: number) => Math.round(n * 10) // 1-10 -> 10-100 for existing UI scale
  return {
    summary: c.summary,
    verdict: c.verdict,
    scores: [
      { label: 'First Impression Power', score: scale(c.scores.firstImpression), note: 'Hit in the first 3 seconds.' },
      { label: 'Emotional Clarity', score: scale(c.scores.emotionalClarity), note: 'Intent is unmistakable.' },
      { label: 'Trust Timing', score: scale(c.scores.trustTiming), note: 'Proof lives where doubt lives.' },
      { label: 'Visual Distinctiveness', score: scale(c.scores.visualDistinctiveness), note: 'Memorable vs template-safe.' },
      { label: 'Motion Readiness', score: scale(c.scores.motionReadiness), note: 'Motion serves the story.' },
      { label: 'Conversion Pressure', score: scale(c.scores.conversionPressure), note: 'Desire earns the ask.' },
      { label: 'Mobile Impact', score: Math.round((c.scores.firstImpression + c.scores.emotionalClarity) * 5), note: 'Mobile must hit as hard as desktop.' },
    ],
    recommendations: c.recommendations,
  }
}

function mapAgentsToLegacyBlueprint(brief: BriefInput, agents: AgentOutputs): LegacyBlueprint {
  const { creativeDirection, brandVoice, psychologyPlan, artDirection, motionPlan } = agents
  const intensityMap: Record<typeof motionPlan.motionIntensity, LegacyBlueprint['motionSystem']['intensity']> = {
    subtle: 'subtle',
    editorial: 'editorial',
    cinematic: 'cinematic',
    explosive: 'explosive',
  }
  return {
    brandCore: {
      brandName: brief.brandName || 'Untitled Brand',
      brandVoice: brandVoice.toneProfile,
      emotionalPromise: creativeDirection.emotionalTarget,
      audienceLens: brief.audience || creativeDirection.creativeSummary,
    },
    storyArc: psychologyPlan.emotionSequence.map(step => ({
      stage: step.stage,
      objective: step.treatment,
      execution: step.treatment,
    })),
    designSystem: {
      primaryDirection: brief.designDirection,
      supportingDirections: brief.referenceStyles,
      typographyStrategy: artDirection.typographySystem.pairing,
      paletteStrategy: artDirection.colorPalette.notes,
      layoutRhythm: artDirection.layoutRhythm,
    },
    motionSystem: {
      intensity: intensityMap[motionPlan.motionIntensity] || 'editorial',
      style: motionPlan.transitionStyle,
      revealBehavior: motionPlan.revealBehavior,
      atmosphere: motionPlan.atmosphereMovement,
    },
    persuasionSystem: {
      trustStrategy: psychologyPlan.trustPlacement,
      proofPlacement: psychologyPlan.proofStrategy,
      ctaStrategy: psychologyPlan.ctaTiming,
      specificityNotes: psychologyPlan.frictionPoints.join(' · '),
    },
    sections: creativeDirection.sectionOrder.map((id, i) => {
      const stage = psychologyPlan.emotionSequence[i]?.stage || 'curiosity'
      return {
        id,
        role: stage,
        heading: i === 0 ? brandVoice.heroHeadline : `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
        purpose: psychologyPlan.emotionSequence[i]?.treatment || '',
        contentDirection: brandVoice.sectionCopyNotes.find(n => n.section.toLowerCase().includes(id))?.note || '',
      }
    }),
  }
}

function extractMetadata(html: string, brief: BriefInput) {
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
  for (const m of html.matchAll(/<section[^>]*(?:id="([^"]+)")/gi)) {
    const name = m[1] || 'section'
    if (!sections.includes(name)) sections.push(name)
  }
  return { fonts, sections, palette: brief.colors, motionVocabulary }
}

/* ── Motion system post-processor (ported from the old route.ts) ── */
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
@media(prefers-reduced-motion:reduce){.reveal,.reveal-left,.reveal-right,.reveal-scale{opacity:1;transform:none;transition:none}.stagger>*{opacity:1;transform:none;transition:none}.marquee-track{animation:none}.orb{animation:none}.grain::after{animation:none}}
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
document.querySelectorAll('section').forEach(function(sec){
var els=sec.querySelectorAll('h2,h3,p,img,.card,[class*="card"],[class*="grid"]>*,blockquote,figure');
var cls=['reveal','reveal-left','reveal-right','reveal-scale'];
els.forEach(function(el,j){if(!el.classList.contains('reveal')&&!el.classList.contains('reveal-left')&&!el.classList.contains('reveal-right')&&!el.classList.contains('reveal-scale')){el.classList.add(cls[j%cls.length]);obs.observe(el)}});
});
if(!document.body.classList.contains('grain'))document.body.classList.add('grain');
})();
</script>`

function postProcessHtml(html: string): string {
  if (!html.includes('id="irie-motion-system"')) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', MOTION_CSS + '\n</head>')
    } else if (html.includes('</style>')) {
      const lastStyleIdx = html.lastIndexOf('</style>')
      html = html.slice(0, lastStyleIdx + 8) + '\n' + MOTION_CSS + html.slice(lastStyleIdx + 8)
    } else {
      html = MOTION_CSS + '\n' + html
    }
  }
  if (!html.includes('id="irie-motion-js"')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', MOTION_JS + '\n</body>')
    } else {
      html += '\n' + MOTION_JS
    }
  }
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
