/**
 * Tuner v1 — Dial application
 *
 * Mutates CSS custom properties on a section's root element directly. No React
 * re-render is triggered by this path — that's the whole point: dragging the
 * slider must be buttery even on a 6386-line monolith iframe.
 *
 * The iframe receives one <style> block (installed once by TunerEditor) that
 * wires these custom properties into the section's actual rendered styles.
 * Missing properties fall back to the section's original defaults.
 */

import type { Dial, DialGroup, Preset, TunerState } from './types'

/**
 * Apply a single dial value to the section root.
 *
 * - Sliders write `value + unit` (e.g. `1.25rem`, `20s`, or raw number).
 * - Chips write the raw option value (e.g. `1fr 1fr`).
 * - Toggles write `onValue` or `offValue` based on 'on'/'off'.
 */
export function applyDial(
  sectionNode: HTMLElement,
  dial: Dial,
  value: number | string,
): void {
  let cssValue = ''
  if (dial.type === 'slider') {
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
    if (!Number.isFinite(n)) return
    cssValue = dial.unit ? `${n}${dial.unit}` : String(n)
  } else if (dial.type === 'chips') {
    cssValue = String(value)
  } else if (dial.type === 'toggle') {
    const state = String(value)
    cssValue = state === 'on' ? dial.onValue : dial.offValue
  }
  sectionNode.style.setProperty(dial.cssVar, cssValue)
}

/** Apply every dial in a preset to a section root. */
export function applyPreset(
  sectionNode: HTMLElement,
  group: DialGroup,
  preset: Preset,
): void {
  const byId = new Map<string, Dial>()
  group.core.forEach((d) => byId.set(d.id, d))
  group.contextual.forEach((d) => byId.set(d.id, d))
  for (const [dialId, value] of Object.entries(preset.values)) {
    const dial = byId.get(dialId)
    if (!dial) continue
    applyDial(sectionNode, dial, value)
  }
}

/**
 * Replay an entire saved TunerState over the iframe's document. Used on
 * iframe load so refresh restores prior tuning before the user sees anything.
 */
export function replayTunerState(
  doc: Document,
  getDials: (sectionId: string) => DialGroup | null,
  state: TunerState,
): void {
  for (const [sectionId, values] of Object.entries(state)) {
    const node = doc.querySelector<HTMLElement>(
      `[data-irie-section-id="${sectionId}"]`,
    )
    if (!node) continue
    const group = getDials(sectionId)
    if (!group) continue
    const byId = new Map<string, Dial>()
    group.core.forEach((d) => byId.set(d.id, d))
    group.contextual.forEach((d) => byId.set(d.id, d))
    for (const [dialId, value] of Object.entries(values)) {
      const dial = byId.get(dialId)
      if (!dial) continue
      applyDial(node, dial, value)
    }
  }
}

/**
 * Get the effective value of a dial in current TunerState (or default).
 */
export function effectiveValue(
  dial: Dial,
  saved: Record<string, number | string> | undefined,
): number | string {
  if (saved && dial.id in saved) return saved[dial.id]
  if (dial.type === 'slider') return dial.default
  if (dial.type === 'chips') return dial.default
  return dial.default
}
