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

export const TUNER_CHROME_STYLE_ID = 'irie-tuner-chrome'

/**
 * Chrome-only CSS — selection rings + hover labels visible inside the iframe
 * during editing. NEVER baked into final_html (the user's exported page must
 * not carry editor decoration). TunerEditor injects this on iframe load and
 * removes it before any export operation.
 */
export function tunerChromeCss(): string {
  return `
[data-irie-section-id] { position: relative; }
[data-irie-section-id][data-irie-tuner-hover]::after,
[data-irie-section-id][data-irie-tuner-active]::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2147483646;
}
[data-irie-section-id][data-irie-tuner-hover]:not([data-irie-tuner-active])::after {
  outline: 1px solid rgba(201, 168, 76, 0.4);
  outline-offset: -1px;
}
[data-irie-section-id][data-irie-tuner-active]::after {
  outline: 2px solid #c9a84c;
  outline-offset: -2px;
}
[data-irie-section-id][data-irie-tuner-flash]::after {
  animation: irieTunerRingFlash 600ms ease;
}
@keyframes irieTunerRingFlash {
  0%   { outline-color: rgba(201, 168, 76, 1); outline-width: 4px; }
  60%  { outline-color: rgba(201, 168, 76, 1); outline-width: 3px; }
  100% { outline-color: rgba(201, 168, 76, 1); outline-width: 2px; }
}
[data-irie-section-id][data-irie-tuner-hover]::before,
[data-irie-section-id][data-irie-tuner-active]::before {
  content: attr(data-irie-section-label);
  position: absolute;
  top: -22px;
  left: 0;
  z-index: 2147483647;
  font: 500 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #0a0a0a;
  background: #c9a84c;
  padding: 4px 6px;
  border-radius: 3px 3px 3px 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  pointer-events: none;
  white-space: nowrap;
}
/* Object-mode rings — text + image selections layered over section rings. */
[data-irie-edit-id],
[data-irie-image-id] {
  cursor: pointer;
}
[data-irie-edit-id].is-irie-object-selected,
[data-irie-image-id].is-irie-object-selected {
  outline: 2px solid #c9a84c !important;
  outline-offset: 4px;
  border-radius: 1px;
}
[data-irie-edit-id].is-irie-object-selected[contenteditable="true"] {
  outline-style: solid;
  outline-offset: 6px;
  caret-color: #c9a84c;
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

  doc.querySelectorAll(
    `#${TUNER_RUNTIME_STYLE_ID}, #${TUNER_BAKED_STYLE_ID}, #${TUNER_CHROME_STYLE_ID}`,
  ).forEach((node) => node.remove())

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

/**
 * Strip editor-only decoration from a cloned Document before exporting:
 *   - chrome ring CSS (TUNER_CHROME_STYLE_ID)
 *   - object selection classes
 *   - contenteditable attributes
 *   - data-irie-tuner-* hover/active/flash attributes
 *   - data-irie-section-label (only present during editing)
 *
 * Called by both download/copy and persist paths so the final_html in the
 * DB never carries chrome noise.
 */
export function stripEditorChrome(doc: Document): void {
  doc.getElementById(TUNER_CHROME_STYLE_ID)?.remove()
  doc.querySelectorAll('.is-irie-object-selected').forEach((node) => {
    node.classList.remove('is-irie-object-selected')
  })
  doc.querySelectorAll('[contenteditable]').forEach((node) => {
    node.removeAttribute('contenteditable')
  })
  doc.querySelectorAll('[data-irie-tuner-hover]').forEach((node) => {
    node.removeAttribute('data-irie-tuner-hover')
  })
  doc.querySelectorAll('[data-irie-tuner-active]').forEach((node) => {
    node.removeAttribute('data-irie-tuner-active')
  })
  doc.querySelectorAll('[data-irie-tuner-flash]').forEach((node) => {
    node.removeAttribute('data-irie-tuner-flash')
  })
  doc.querySelectorAll('[data-irie-section-label]').forEach((node) => {
    node.removeAttribute('data-irie-section-label')
  })
}

/**
 * Serialize the live iframe document into a persistable HTML string. Keeps
 * data-irie-section-id / data-irie-edit-id / data-irie-image-id / data-irie-editable
 * annotations so next load can re-hydrate without having to re-annotate. Also
 * refreshes the baked CSS from the current TunerState.
 *
 * Strips editor chrome (selection rings, contenteditable, hover attributes)
 * so the persisted HTML is viewable as-is.
 */
export function serializeIframe(
  doc: Document,
  state: TunerState,
  getDials: (sectionId: string) => DialGroup | null,
): string {
  // Work on a clone so the live iframe keeps its chrome for further edits.
  const cloneDoc = doc.cloneNode(true) as Document
  stripEditorChrome(cloneDoc)

  // Refresh the baked rules from state so refresh re-hydrates with no JS.
  cloneDoc.querySelectorAll(`#${TUNER_BAKED_STYLE_ID}`).forEach((node) => node.remove())
  const bakedParts: string[] = []
  for (const [sectionId, values] of Object.entries(state)) {
    const group = getDials(sectionId)
    if (!group) continue
    const block = serializeSection(sectionId, values, group)
    if (block) bakedParts.push(block)
  }
  if (bakedParts.length > 0) {
    const baked = cloneDoc.createElement('style')
    baked.id = TUNER_BAKED_STYLE_ID
    baked.textContent = bakedParts.join('\n\n')
    cloneDoc.head.appendChild(baked)
  }

  // Ensure runtime CSS is present (it may have been stripped in a prior
  // hard-reset flow). The annotator reinstalls it on load, but baked HTML
  // must carry it for server-rendered refresh to keep parity.
  if (!cloneDoc.getElementById(TUNER_RUNTIME_STYLE_ID)) {
    const runtime = cloneDoc.createElement('style')
    runtime.id = TUNER_RUNTIME_STYLE_ID
    runtime.textContent = tunerRuntimeCss()
    cloneDoc.head.appendChild(runtime)
  }

  return `<!DOCTYPE html>\n${cloneDoc.documentElement.outerHTML}`
}

/**
 * Export-ready HTML: strips ALL data-irie-* annotations (not just chrome).
 * Used by Download / Copy Code / Publish — the HTML that leaves the editor.
 */
export function serializeForExport(
  doc: Document,
  state: TunerState,
  getDials: (sectionId: string) => DialGroup | null,
): string {
  const full = serializeIframe(doc, state, getDials)
  // Second pass: strip ids used only by the editor.
  const parser = new DOMParser()
  const parsed = parser.parseFromString(full, 'text/html')
  parsed
    .querySelectorAll(
      '[data-irie-edit-id], [data-irie-editable], [data-irie-image-id], [data-irie-section-id], [data-irie-section-label]',
    )
    .forEach((node) => {
      node.removeAttribute('data-irie-edit-id')
      node.removeAttribute('data-irie-editable')
      node.removeAttribute('data-irie-image-id')
      node.removeAttribute('data-irie-section-id')
      node.removeAttribute('data-irie-section-label')
    })
  return `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}`
}
