/**
 * Tuner v1 — Dial Architect
 *
 * Pure rules engine. Given a sectionType, returns the DialGroup to render.
 * All tokens reference DESIGN.md:
 *   — padding scale derives from clamp(1.25rem, 5vw, 3rem) — --pad
 *   — accent opacity scale: 0 (no gold wash), 0.15 (gold-dim), 0.18 (border)
 *   — corner scale: 0-6px (editorial flatness)
 *   — motion scale: 0ms (reduced) → 1200ms (slow decay rule: ≥0.6s for reveals)
 */

import type { Dial, DialGroup, Preset, SectionType } from './types'

/* ────────────────────────────────────────────────────────────────────────
   Core dials — always present, on every section.
   ──────────────────────────────────────────────────────────────────────── */

const corePadding = (): Dial => ({
  id: 'padding',
  type: 'slider',
  label: 'Padding',
  cssVar: '--irie-pad-scale',
  min: 0.5,
  max: 2,
  step: 0.05,
  default: 1,
  unit: '',
  format: (v) => `${v.toFixed(2)}×`,
})

const coreAccentIntensity = (): Dial => ({
  id: 'accent-intensity',
  type: 'slider',
  label: 'Accent intensity',
  cssVar: '--irie-accent-alpha',
  min: 0,
  max: 0.35,
  step: 0.01,
  default: 0.15,
  unit: '',
  format: (v) => `${Math.round(v * 100)}%`,
})

const coreCornerStyle = (): Dial => ({
  id: 'corner-style',
  type: 'chips',
  label: 'Corner style',
  cssVar: '--irie-radius',
  options: [
    { value: '0px', label: 'Sharp' },
    { value: '4px', label: 'Soft' },
    { value: '6px', label: 'Round' },
  ],
  default: '4px',
})

const coreMotion = (): Dial => ({
  id: 'motion',
  type: 'slider',
  label: 'Motion',
  cssVar: '--irie-motion-scale',
  min: 0,
  max: 1.5,
  step: 0.05,
  default: 1,
  unit: '',
  format: (v) => (v === 0 ? 'Still' : `${v.toFixed(2)}×`),
})

function coreDials(): Dial[] {
  return [corePadding(), coreAccentIntensity(), coreCornerStyle(), coreMotion()]
}

/* ────────────────────────────────────────────────────────────────────────
   Contextual dials — keyed by sectionType.
   ──────────────────────────────────────────────────────────────────────── */

const heroContextual = (): Dial[] => [
  {
    id: 'headline-weight',
    type: 'chips',
    label: 'Headline weight',
    cssVar: '--irie-headline-weight',
    options: [
      { value: '400', label: 'Light' },
      { value: '700', label: 'Bold' },
      { value: '900', label: 'Heavy' },
    ],
    default: '900',
  },
  {
    id: 'orb-presence',
    type: 'slider',
    label: 'Orb presence',
    cssVar: '--irie-orb-opacity',
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => (v === 0 ? 'Hidden' : `${Math.round(v * 100)}%`),
  },
  {
    id: 'grain-opacity',
    type: 'slider',
    label: 'Grain',
    cssVar: '--irie-grain-opacity',
    min: 0,
    max: 0.6,
    step: 0.05,
    default: 0.5,
    unit: '',
    format: (v) => `${Math.round(v * 100)}%`,
  },
]

const productGridContextual = (): Dial[] => [
  {
    id: 'card-density',
    type: 'slider',
    label: 'Card density',
    cssVar: '--irie-card-gap',
    min: 0,
    max: 2,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => (v === 0 ? 'Tight' : `${v.toFixed(2)}×`),
  },
  {
    id: 'card-border',
    type: 'toggle',
    label: 'Card hairline',
    cssVar: '--irie-card-border-width',
    default: 'on',
    onValue: '1px',
    offValue: '0px',
  },
]

const testimonialContextual = (): Dial[] => [
  {
    id: 'quote-weight',
    type: 'chips',
    label: 'Quote weight',
    cssVar: '--irie-quote-weight',
    options: [
      { value: '300', label: 'Airy' },
      { value: '400', label: 'Read' },
      { value: '700', label: 'Loud' },
    ],
    default: '400',
  },
  {
    id: 'quote-italic',
    type: 'toggle',
    label: 'Italic',
    cssVar: '--irie-quote-italic',
    default: 'on',
    onValue: 'italic',
    offValue: 'normal',
  },
]

const pricingContextual = (): Dial[] => [
  {
    id: 'tier-emphasis',
    type: 'chips',
    label: 'Tier emphasis',
    cssVar: '--irie-tier-emphasis',
    options: [
      { value: '0', label: 'Flat' },
      { value: '0.5', label: 'Subtle' },
      { value: '1', label: 'Bold' },
    ],
    default: '0.5',
  },
]

const ctaContextual = (): Dial[] => [
  {
    id: 'cta-scale',
    type: 'slider',
    label: 'CTA scale',
    cssVar: '--irie-cta-scale',
    min: 0.85,
    max: 1.35,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => `${v.toFixed(2)}×`,
  },
  {
    id: 'cta-glow',
    type: 'toggle',
    label: 'CTA glow',
    cssVar: '--irie-cta-glow',
    default: 'on',
    onValue: '0 0 32px rgba(201,168,76,0.35)',
    offValue: 'none',
  },
]

const storyContextual = (): Dial[] => [
  {
    id: 'column-rhythm',
    type: 'chips',
    label: 'Rhythm',
    cssVar: '--irie-story-rhythm',
    options: [
      { value: '1fr', label: 'Single' },
      { value: '1fr 1fr', label: 'Split' },
      { value: '2fr 1fr', label: 'Weighted' },
    ],
    default: '1fr',
  },
  {
    id: 'copy-weight',
    type: 'chips',
    label: 'Copy weight',
    cssVar: '--irie-copy-weight',
    options: [
      { value: '300', label: 'Airy' },
      { value: '400', label: 'Read' },
      { value: '500', label: 'Tight' },
    ],
    default: '400',
  },
]

const trustContextual = (): Dial[] => [
  {
    id: 'logo-saturation',
    type: 'slider',
    label: 'Logo saturation',
    cssVar: '--irie-logo-saturation',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.4,
    unit: '',
    format: (v) => `${Math.round(v * 100)}%`,
  },
]

const footerContextual = (): Dial[] => [
  {
    id: 'footer-density',
    type: 'slider',
    label: 'Density',
    cssVar: '--irie-footer-scale',
    min: 0.7,
    max: 1.3,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => `${v.toFixed(2)}×`,
  },
  {
    id: 'link-warmth',
    type: 'slider',
    label: 'Link warmth',
    cssVar: '--irie-footer-link-warmth',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.3,
    unit: '',
    format: (v) =>
      v === 0 ? 'Cool' : v === 1 ? 'Warm' : `${Math.round(v * 100)}%`,
  },
  {
    id: 'logo-scale',
    type: 'slider',
    label: 'Logo scale',
    cssVar: '--irie-footer-logo-scale',
    min: 0.7,
    max: 1.5,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => `${v.toFixed(2)}×`,
  },
  {
    id: 'air-between',
    type: 'slider',
    label: 'Air between',
    cssVar: '--irie-footer-gap-scale',
    min: 0.5,
    max: 2,
    step: 0.05,
    default: 1,
    unit: '',
    format: (v) => (v === 0.5 ? 'Tight' : `${v.toFixed(2)}×`),
  },
  {
    id: 'disclaimer-weight',
    type: 'slider',
    label: 'Disclaimer weight',
    cssVar: '--irie-footer-disclaimer-alpha',
    min: 0.3,
    max: 1,
    step: 0.05,
    default: 0.55,
    unit: '',
    format: (v) =>
      v <= 0.4 ? 'Muted' : v >= 0.9 ? 'Loud' : `${Math.round(v * 100)}%`,
  },
]

const marqueeContextual = (): Dial[] => [
  {
    id: 'marquee-speed',
    type: 'slider',
    label: 'Marquee speed',
    cssVar: '--irie-marquee-duration',
    min: 10,
    max: 60,
    step: 1,
    default: 20,
    unit: 's',
    format: (v) => `${Math.round(v)}s`,
  },
  {
    id: 'marquee-italic',
    type: 'toggle',
    label: 'Italic',
    cssVar: '--irie-marquee-italic',
    default: 'on',
    onValue: 'italic',
    offValue: 'normal',
  },
]

/* ────────────────────────────────────────────────────────────────────────
   Presets — 3-4 per sectionType, Corey's voice.
   ──────────────────────────────────────────────────────────────────────── */

const heroPresets = (): Preset[] => [
  {
    id: 'drop-day',
    label: 'Drop Day',
    values: {
      padding: 1.15,
      'accent-intensity': 0.22,
      'corner-style': '0px',
      motion: 1.25,
      'headline-weight': '900',
      'orb-presence': 1,
      'grain-opacity': 0.5,
    },
  },
  {
    id: 'slow-burn',
    label: 'Slow Burn',
    values: {
      padding: 1.35,
      'accent-intensity': 0.12,
      'corner-style': '4px',
      motion: 0.65,
      'headline-weight': '700',
      'orb-presence': 0.85,
      'grain-opacity': 0.5,
    },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    values: {
      padding: 1.5,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.85,
      'headline-weight': '700',
      'orb-presence': 0.7,
      'grain-opacity': 0.55,
    },
  },
]

const productGridPresets = (): Preset[] => [
  {
    id: 'dense-drop',
    label: 'Dense Drop',
    values: {
      padding: 0.85,
      'accent-intensity': 0.1,
      'corner-style': '0px',
      motion: 1,
      'card-density': 0.4,
      'card-border': 'on',
    },
  },
  {
    id: 'boutique',
    label: 'Boutique',
    values: {
      padding: 1.25,
      'accent-intensity': 0.15,
      'corner-style': '6px',
      motion: 0.85,
      'card-density': 1.25,
      'card-border': 'on',
    },
  },
  {
    id: 'gallery',
    label: 'Gallery',
    values: {
      padding: 1.5,
      'accent-intensity': 0.08,
      'corner-style': '0px',
      motion: 0.75,
      'card-density': 1.6,
      'card-border': 'off',
    },
  },
]

const testimonialPresets = (): Preset[] => [
  {
    id: 'whispered',
    label: 'Whispered',
    values: {
      padding: 1.3,
      'accent-intensity': 0.1,
      'corner-style': '4px',
      motion: 0.75,
      'quote-weight': '300',
      'quote-italic': 'on',
    },
  },
  {
    id: 'bold-claim',
    label: 'Bold Claim',
    values: {
      padding: 1.1,
      'accent-intensity': 0.22,
      'corner-style': '0px',
      motion: 1,
      'quote-weight': '700',
      'quote-italic': 'off',
    },
  },
  {
    id: 'editorial-pull',
    label: 'Editorial Pull',
    values: {
      padding: 1.5,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.8,
      'quote-weight': '400',
      'quote-italic': 'on',
    },
  },
]

const pricingPresets = (): Preset[] => [
  {
    id: 'clean',
    label: 'Clean',
    values: {
      padding: 1.15,
      'accent-intensity': 0.12,
      'corner-style': '4px',
      motion: 0.9,
      'tier-emphasis': '0',
    },
  },
  {
    id: 'anchor-high',
    label: 'Anchor High',
    values: {
      padding: 1.2,
      'accent-intensity': 0.18,
      'corner-style': '6px',
      motion: 1,
      'tier-emphasis': '1',
    },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    values: {
      padding: 1.35,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.85,
      'tier-emphasis': '0.5',
    },
  },
]

const ctaPresets = (): Preset[] => [
  {
    id: 'close-hard',
    label: 'Close Hard',
    values: {
      padding: 1,
      'accent-intensity': 0.25,
      'corner-style': '4px',
      motion: 1.15,
      'cta-scale': 1.2,
      'cta-glow': 'on',
    },
  },
  {
    id: 'soft-ask',
    label: 'Soft Ask',
    values: {
      padding: 1.4,
      'accent-intensity': 0.12,
      'corner-style': '6px',
      motion: 0.75,
      'cta-scale': 1,
      'cta-glow': 'off',
    },
  },
  {
    id: 'final-word',
    label: 'Final Word',
    values: {
      padding: 1.6,
      'accent-intensity': 0.2,
      'corner-style': '0px',
      motion: 0.9,
      'cta-scale': 1.1,
      'cta-glow': 'on',
    },
  },
]

const storyPresets = (): Preset[] => [
  {
    id: 'reader',
    label: 'Reader',
    values: {
      padding: 1.25,
      'accent-intensity': 0.12,
      'corner-style': '4px',
      motion: 0.85,
      'column-rhythm': '1fr',
      'copy-weight': '400',
    },
  },
  {
    id: 'split-view',
    label: 'Split View',
    values: {
      padding: 1.1,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 1,
      'column-rhythm': '1fr 1fr',
      'copy-weight': '400',
    },
  },
  {
    id: 'weighted',
    label: 'Weighted',
    values: {
      padding: 1.3,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.9,
      'column-rhythm': '2fr 1fr',
      'copy-weight': '300',
    },
  },
]

const trustPresets = (): Preset[] => [
  {
    id: 'quiet',
    label: 'Quiet',
    values: {
      padding: 1,
      'accent-intensity': 0.08,
      'corner-style': '4px',
      motion: 0.75,
      'logo-saturation': 0.15,
    },
  },
  {
    id: 'proof',
    label: 'Proof',
    values: {
      padding: 1.15,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.85,
      'logo-saturation': 0.5,
    },
  },
  {
    id: 'full-color',
    label: 'Full Color',
    values: {
      padding: 1.25,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 1,
      'logo-saturation': 1,
    },
  },
]

const footerPresets = (): Preset[] => [
  {
    id: 'tight',
    label: 'Tight',
    values: {
      padding: 0.85,
      'accent-intensity': 0.12,
      'corner-style': '0px',
      motion: 0.75,
      'footer-density': 0.85,
      'link-warmth': 0.2,
      'logo-scale': 0.9,
      'air-between': 0.65,
      'disclaimer-weight': 0.45,
    },
  },
  {
    id: 'airy',
    label: 'Airy',
    values: {
      padding: 1.25,
      'accent-intensity': 0.1,
      'corner-style': '0px',
      motion: 0.85,
      'footer-density': 1.15,
      'link-warmth': 0.35,
      'logo-scale': 1.05,
      'air-between': 1.35,
      'disclaimer-weight': 0.55,
    },
  },
  {
    id: 'magazine',
    label: 'Magazine',
    values: {
      padding: 1.4,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.9,
      'footer-density': 1.25,
      'link-warmth': 0.5,
      'logo-scale': 1.2,
      'air-between': 1.6,
      'disclaimer-weight': 0.8,
    },
  },
]

const marqueePresets = (): Preset[] => [
  {
    id: 'signature',
    label: 'Signature',
    values: {
      padding: 1,
      'accent-intensity': 0.18,
      'corner-style': '0px',
      motion: 1,
      'marquee-speed': 20,
      'marquee-italic': 'on',
    },
  },
  {
    id: 'rapid',
    label: 'Rapid',
    values: {
      padding: 0.85,
      'accent-intensity': 0.22,
      'corner-style': '0px',
      motion: 1.25,
      'marquee-speed': 12,
      'marquee-italic': 'on',
    },
  },
  {
    id: 'slow-drift',
    label: 'Slow Drift',
    values: {
      padding: 1.15,
      'accent-intensity': 0.12,
      'corner-style': '0px',
      motion: 0.65,
      'marquee-speed': 40,
      'marquee-italic': 'off',
    },
  },
]

const unknownPresets = (): Preset[] => [
  {
    id: 'calmer',
    label: 'Calmer',
    values: {
      padding: 1.25,
      'accent-intensity': 0.1,
      'corner-style': '4px',
      motion: 0.75,
    },
  },
  {
    id: 'louder',
    label: 'Louder',
    values: {
      padding: 0.9,
      'accent-intensity': 0.22,
      'corner-style': '0px',
      motion: 1.15,
    },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    values: {
      padding: 1.4,
      'accent-intensity': 0.15,
      'corner-style': '0px',
      motion: 0.85,
    },
  },
]

/* ────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Return the DialGroup for a given sectionType. Pure function, no side effects.
 * Unknown sectionTypes fall back to core-only with calm/loud/editorial presets.
 */
export function getDialGroupForSection(sectionType: SectionType): DialGroup {
  const core = coreDials()
  switch (sectionType) {
    case 'hero':
      return { sectionType, presets: heroPresets(), core, contextual: heroContextual() }
    case 'product-grid':
      return {
        sectionType,
        presets: productGridPresets(),
        core,
        contextual: productGridContextual(),
      }
    case 'testimonial':
      return {
        sectionType,
        presets: testimonialPresets(),
        core,
        contextual: testimonialContextual(),
      }
    case 'pricing':
      return {
        sectionType,
        presets: pricingPresets(),
        core,
        contextual: pricingContextual(),
      }
    case 'cta':
      return { sectionType, presets: ctaPresets(), core, contextual: ctaContextual() }
    case 'story':
      return { sectionType, presets: storyPresets(), core, contextual: storyContextual() }
    case 'trust':
      return { sectionType, presets: trustPresets(), core, contextual: trustContextual() }
    case 'footer':
      return { sectionType, presets: footerPresets(), core, contextual: footerContextual() }
    case 'marquee':
      return {
        sectionType,
        presets: marqueePresets(),
        core,
        contextual: marqueeContextual(),
      }
    case 'unknown':
    default:
      return { sectionType: 'unknown', presets: unknownPresets(), core, contextual: [] }
  }
}
