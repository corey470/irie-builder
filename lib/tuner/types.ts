/**
 * Tuner v1 — type definitions
 *
 * The Tuner exposes a small set of "dials" per section. Each dial mutates a
 * single CSS custom property on the section root, so live interaction is a
 * direct style mutation with zero React re-renders.
 */

export type SectionType =
  | 'hero'
  | 'product-grid'
  | 'testimonial'
  | 'pricing'
  | 'cta'
  | 'story'
  | 'trust'
  | 'footer'
  | 'marquee'
  | 'unknown'

export type DialType = 'slider' | 'chips' | 'toggle'

export interface SliderDial {
  id: string
  type: 'slider'
  label: string
  /** CSS custom property written on the section root, e.g. --irie-pad. */
  cssVar: string
  min: number
  max: number
  step: number
  /** Default value — what the section renders at with no tuning applied. */
  default: number
  /** Unit appended when writing the CSS var (e.g. 'rem', 'px', '', 'ms'). */
  unit: string
  /** Optional custom readout label formatter. */
  format?: (value: number) => string
}

export interface ChipsDial {
  id: string
  type: 'chips'
  label: string
  cssVar: string
  options: Array<{ value: string; label: string }>
  /** String default value matching one of options[].value */
  default: string
}

export interface ToggleDial {
  id: string
  type: 'toggle'
  label: string
  cssVar: string
  /** String default value — 'off' or 'on'. */
  default: 'on' | 'off'
  onValue: string
  offValue: string
}

export type Dial = SliderDial | ChipsDial | ToggleDial

export interface Preset {
  id: string
  label: string
  /** Mapping of dialId → value. Missing dials keep their current value. */
  values: Record<string, number | string>
}

export interface DialGroup {
  sectionType: SectionType
  /** 3-4 presets in Corey's voice (e.g. "Drop Day", "Slow Burn"). */
  presets: Preset[]
  /** Core dials always present: padding, accent intensity, corner style, motion. */
  core: Dial[]
  /** Contextual dials specific to this sectionType. */
  contextual: Dial[]
}

export interface ClassifiedSection {
  sectionId: string
  sectionType: SectionType
  label: string
}

export interface TunerDialState {
  /** Resolved value (either number or chip/toggle string). */
  value: number | string
  /** Whether the current value differs from the dial's default. */
  tuned: boolean
}

/** Persisted Tuner state keyed by sectionId → dialId → value. */
export type TunerState = Record<string, Record<string, number | string>>
