/**
 * Tuner v1 — Section classifier
 *
 * The Assembler does NOT emit data-tuner-* attributes, so classification is
 * client-side. We classify sections based on DOM heuristics against the
 * already-present data-irie-section-id attributes that
 * buildEditableDocumentModel injects (tagName-N).
 *
 * Heuristic order matters — first match wins:
 *   1. <footer> → 'footer'
 *   2. .marquee / .marquee-track present → 'marquee'
 *   3. .hero class OR first <header> OR contains <h1> → 'hero'
 *   4. .cta-section class → 'cta'
 *   5. blockquote present → 'testimonial'
 *   6. $-sign + >=2 sibling card-like blocks → 'pricing'
 *   7. grid of >=4 small images without headings → 'trust'
 *   8. grid with >=3 repeated article/card blocks + headings → 'product-grid'
 *   9. final section with a single big CTA → 'cta'
 *   10. fallback → 'story'
 *
 * A section without a data-irie-section-id is skipped entirely.
 */

import type { ClassifiedSection, SectionType } from './types'

const SECTION_SELECTOR = '[data-irie-section-id]'

function hasClass(node: Element, className: string): boolean {
  return node.classList.contains(className)
}

function countChildren(node: Element, selector: string): number {
  return node.querySelectorAll(selector).length
}

function firstMatching(
  nodes: Element[],
  predicate: (node: Element) => boolean,
): Element | null {
  for (const node of nodes) {
    if (predicate(node)) return node
  }
  return null
}

function classifyOne(
  node: Element,
  index: number,
  total: number,
  heroAlreadyFound: boolean,
): SectionType {
  const tag = node.tagName.toLowerCase()

  // 1. Footer
  if (tag === 'footer') return 'footer'

  // 2. Marquee
  if (hasClass(node, 'marquee') || node.querySelector('.marquee-track, .marquee')) {
    return 'marquee'
  }

  // 3. Hero — first header, or has .hero class, or has h1. Only one hero.
  if (!heroAlreadyFound) {
    if (hasClass(node, 'hero')) return 'hero'
    if (tag === 'header' && node.querySelector('h1')) return 'hero'
    if (index === 0 && node.querySelector('h1')) return 'hero'
  }

  // 4. Explicit CTA section class
  if (hasClass(node, 'cta-section') || hasClass(node, 'cta')) return 'cta'

  // 5. Testimonial — blockquote or explicit class
  if (
    node.querySelector('blockquote') ||
    hasClass(node, 'testimonial') ||
    hasClass(node, 'testimonials')
  ) {
    return 'testimonial'
  }

  // 6. Pricing — $-sign + repeated card-like blocks. Must have enough markup
  //    to read as a pricing grid, not just a casual $ mention.
  const text = (node.textContent || '')
  const hasDollar = /\$\s?\d/.test(text)
  const cardCount = countChildren(node, '.card, .tier, .pricing-card, article, li')
  if (hasDollar && cardCount >= 2) return 'pricing'

  // 7. Trust — grid of small images without text-heavy headings. Logo wall.
  const images = countChildren(node, 'img')
  const headingCount = countChildren(node, 'h2, h3')
  if (images >= 4 && headingCount <= 1) return 'trust'

  // 8. Product grid — repeated article/card blocks with headings, 3+ of them
  if (cardCount >= 3 && images >= 2) return 'product-grid'

  // 9. Last section with a prominent CTA button
  if (index === total - 1 && node.querySelector('a, button')) {
    const buttonLike = node.querySelectorAll('.btn, button, a')
    if (buttonLike.length <= 3 && node.querySelector('h2, h3')) return 'cta'
  }

  // 10. Fallback
  return 'story'
}

function labelFor(
  sectionType: SectionType,
  sectionId: string,
  counters: Map<SectionType, number>,
): string {
  const n = (counters.get(sectionType) || 0) + 1
  counters.set(sectionType, n)
  const base: Record<SectionType, string> = {
    hero: 'Hero',
    'product-grid': 'Product Grid',
    testimonial: 'Testimonial',
    pricing: 'Pricing',
    cta: 'CTA',
    story: 'Story',
    trust: 'Trust',
    footer: 'Footer',
    marquee: 'Marquee',
    unknown: 'Section',
  }
  // Unique section ids already encode their own numbering — only add a suffix
  // when there are multiple of the same type in the page.
  return n === 1 ? base[sectionType] : `${base[sectionType]} ${n}`
}

/**
 * Classify every [data-irie-section-id] node in the iframe's document.
 * Returns an array in DOM order — sectionId, sectionType, label.
 */
export function classifySections(doc: Document): ClassifiedSection[] {
  const nodes = Array.from(doc.querySelectorAll(SECTION_SELECTOR))
  if (nodes.length === 0) return []

  const out: ClassifiedSection[] = []
  const typeCounters = new Map<SectionType, number>()
  let heroFound = false

  nodes.forEach((node, index) => {
    const sectionId = node.getAttribute('data-irie-section-id')
    if (!sectionId) return
    const sectionType = classifyOne(node, index, nodes.length, heroFound)
    if (sectionType === 'hero') heroFound = true
    const label = labelFor(sectionType, sectionId, typeCounters)
    out.push({ sectionId, sectionType, label })
  })

  return out
}

/** First time only — warn once in dev if a section classifies as 'unknown'. */
export function warnIfUnknown(sections: ClassifiedSection[]): void {
  if (typeof window === 'undefined') return
  const unknowns = sections.filter((s) => s.sectionType === 'unknown')
  if (unknowns.length === 0) return
  // eslint-disable-next-line no-console
  console.info(
    '[tuner] Unknown sectionType for:',
    unknowns.map((s) => s.sectionId).join(', '),
    '— falling back to core dials only.',
  )
}

/** Locate the first section by its id. Used by the editor to auto-select. */
export function findSectionNode(
  doc: Document,
  sectionId: string,
): HTMLElement | null {
  return doc.querySelector(`[data-irie-section-id="${sectionId}"]`)
}
