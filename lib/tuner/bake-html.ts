/**
 * Tuner v1 — bake tuner state into HTML
 *
 * When we persist to builder_generations.final_html, we can't rely on inline
 * style setProperty() being re-run — the next page load needs to see the
 * tuned values without JS. So we emit a <style id="irie-tuner-baked"> block
 * containing one rule per tuned section with its current custom-property map.
 *
 * Shape of the baked style block:
 *   [data-irie-section-id="header-1"] { --irie-pad-scale: 1.25; ... }
 *
 * The tuner's runtime <style> block (installed at iframe load) references
 * these custom properties against real CSS declarations — so the baked state
 * applies identically at rest and during editing.
 */

import type { DialGroup, TunerState } from './types'

export const TUNER_RUNTIME_STYLE_ID = 'irie-tuner-runtime'
export const TUNER_BAKED_STYLE_ID = 'irie-tuner-baked'

/**
 * The runtime CSS that wires CSS custom properties set per-section back to
 * real rendered styles. Injected once into the iframe <head> and also baked
 * into final_html so refresh preserves the treatment without JS.
 */
export function tunerRuntimeCss(): string {
  return `
/* Tuner runtime — wires per-section custom properties to real styles. */
[data-irie-section-id] {
  padding-top: calc(var(--irie-pad-scale, 1) * var(--pad, clamp(1.25rem, 5vw, 3rem)) * 2);
  padding-bottom: calc(var(--irie-pad-scale, 1) * var(--pad, clamp(1.25rem, 5vw, 3rem)) * 2);
  border-radius: var(--irie-radius, 0px);
  transition:
    padding-top 220ms ease,
    padding-bottom 220ms ease,
    border-radius 220ms ease,
    background-color 220ms ease;
}
[data-irie-section-id] h1,
[data-irie-section-id] h2,
[data-irie-section-id] h3 {
  transition: font-weight 220ms ease, font-style 220ms ease;
}
[data-irie-section-id] h1 {
  font-weight: var(--irie-headline-weight, 900);
}
[data-irie-section-id] blockquote,
[data-irie-section-id] .quote,
[data-irie-section-id] .pull-quote {
  font-weight: var(--irie-quote-weight, 400);
  font-style: var(--irie-quote-italic, italic);
}
[data-irie-section-id] .grid,
[data-irie-section-id] .cards,
[data-irie-section-id] .card-grid,
[data-irie-section-id] .product-grid {
  gap: calc(var(--irie-card-gap, 1) * 1.5rem);
  transition: gap 220ms ease;
}
[data-irie-section-id] .card,
[data-irie-section-id] article {
  border-width: var(--irie-card-border-width, 1px);
}
[data-irie-section-id] .cta,
[data-irie-section-id] .btn-primary,
[data-irie-section-id] button.primary {
  transform: scale(var(--irie-cta-scale, 1));
  box-shadow: var(--irie-cta-glow, none);
  transition: transform 220ms ease, box-shadow 220ms ease;
}
[data-irie-section-id].hero .orb,
[data-irie-section-id] .orb-1,
[data-irie-section-id] .orb-2,
[data-irie-section-id] .orb-3 {
  opacity: var(--irie-orb-opacity, 1);
  transition: opacity 320ms ease;
}
[data-irie-section-id] .grain {
  opacity: var(--irie-grain-opacity, 0.5);
}
[data-irie-section-id] .marquee span,
[data-irie-section-id].marquee span {
  font-style: var(--irie-marquee-italic, italic);
  animation-duration: var(--irie-marquee-duration, 20s) !important;
}
[data-irie-section-id] .logos img,
[data-irie-section-id] .trust img {
  filter: saturate(var(--irie-logo-saturation, 0.4));
}
[data-irie-section-id] footer,
[data-irie-section-id].footer-wrap {
  font-size: calc(14px * var(--irie-footer-scale, 1));
}
[data-irie-section-id] .inner {
  grid-template-columns: var(--irie-story-rhythm, 1fr 1fr);
}
[data-irie-section-id] p,
[data-irie-section-id] .lead {
  font-weight: var(--irie-copy-weight, 400);
}
@media (prefers-reduced-motion: reduce) {
  [data-irie-section-id],
  [data-irie-section-id] * {
    transition: none !important;
  }
}
`.trim()
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '\\"')
}

function serializeSection(
  sectionId: string,
  values: Record<string, number | string>,
  group: DialGroup,
): string {
  const lines: string[] = []
  const byId = new Map(
    [...group.core, ...group.contextual].map((d) => [d.id, d] as const),
  )
  for (const [dialId, value] of Object.entries(values)) {
    const dial = byId.get(dialId)
    if (!dial) continue
    let cssValue = ''
    if (dial.type === 'slider') {
      const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
      if (!Number.isFinite(n)) continue
      cssValue = dial.unit ? `${n}${dial.unit}` : String(n)
    } else if (dial.type === 'chips') {
      cssValue = String(value)
    } else if (dial.type === 'toggle') {
      const state = String(value)
      cssValue = state === 'on' ? dial.onValue : dial.offValue
    }
    lines.push(`  ${dial.cssVar}: ${cssValue};`)
  }
  if (lines.length === 0) return ''
  return `[data-irie-section-id="${escapeAttr(sectionId)}"] {\n${lines.join('\n')}\n}`
}

/**
 * Bake the current TunerState + runtime CSS into final_html. Always replaces
 * any prior #irie-tuner-runtime and #irie-tuner-baked style blocks — never
 * accumulates — so repeated saves stay clean.
 */
export function bakeTunerState(
  html: string,
  state: TunerState,
  getDials: (sectionId: string) => DialGroup | null,
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll(`#${TUNER_RUNTIME_STYLE_ID}, #${TUNER_BAKED_STYLE_ID}`)
    .forEach((node) => node.remove())

  const runtime = doc.createElement('style')
  runtime.id = TUNER_RUNTIME_STYLE_ID
  runtime.textContent = tunerRuntimeCss()
  doc.head.appendChild(runtime)

  const bakedParts: string[] = []
  for (const [sectionId, values] of Object.entries(state)) {
    const group = getDials(sectionId)
    if (!group) continue
    const block = serializeSection(sectionId, values, group)
    if (block) bakedParts.push(block)
  }
  if (bakedParts.length > 0) {
    const baked = doc.createElement('style')
    baked.id = TUNER_BAKED_STYLE_ID
    baked.textContent = bakedParts.join('\n\n')
    doc.head.appendChild(baked)
  }

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}
