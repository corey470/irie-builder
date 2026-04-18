/**
 * Tuner v2 — Preview click → target classifier
 *
 * The iframe has three overlapping target types. Priority resolution rules
 * (from inner to outer):
 *
 *   1. Click landed on an <img> or an [data-irie-image-id] ancestor → image
 *   2. Click landed on [data-irie-edit-id]/[data-irie-editable="text"] → text
 *   3. Click landed on any [data-irie-section-id] → section
 *
 * In Section-TUNE / Section-STYLE modes the classifier still reports the
 * deepest match; TunerEditor decides whether to promote to section (e.g.
 * it was already on section mode and user clicked background), enter
 * object-text mode, or enter object-image mode.
 */

export type SelectionKind = 'section' | 'text' | 'image' | 'marquee' | null

export interface SelectionResult {
  kind: SelectionKind
  /** Id on the matched element itself (edit-id for text/image, section-id for section, marquee-id for marquee). */
  id: string | null
  /** Section id containing the matched element (always populated when kind ≠ null). */
  sectionId: string | null
  /** Direct element reference for ring highlighting / scrolling / contenteditable. */
  element: HTMLElement | null
}

const EMPTY: SelectionResult = {
  kind: null,
  id: null,
  sectionId: null,
  element: null,
}

export function classifyClickTarget(target: EventTarget | null): SelectionResult {
  if (!(target instanceof Element)) return EMPTY
  // Marquee FIRST — words inside .marquee-track get annotated as text nodes
  // by the assembler, so without this check the text classifier would win.
  // We want clicks anywhere inside a .marquee or .marquee-track strip to
  // open the marquee panel, not the individual word edit.
  const marqueeEl = target.closest<HTMLElement>(
    '[data-irie-marquee-id], .marquee, .marquee-track',
  )
  if (marqueeEl) {
    const id = marqueeEl.getAttribute('data-irie-marquee-id')
    if (id) {
      const sectionEl = marqueeEl.closest<HTMLElement>('[data-irie-section-id]')
      return {
        kind: 'marquee',
        id,
        sectionId: sectionEl?.getAttribute('data-irie-section-id') ?? null,
        element: marqueeEl,
      }
    }
  }
  // Image — bare <img> or any element with data-irie-image-id (bg-image
  // sections annotated by object-model).
  const imageEl = target.closest<HTMLElement>(
    'img, [data-irie-image-id]',
  )
  if (imageEl) {
    const id =
      imageEl.getAttribute('data-irie-image-id') ||
      imageEl.closest<HTMLElement>('[data-irie-image-id]')?.getAttribute('data-irie-image-id') ||
      null
    const sectionEl = imageEl.closest<HTMLElement>('[data-irie-section-id]')
    return {
      kind: 'image',
      id,
      sectionId: sectionEl?.getAttribute('data-irie-section-id') ?? null,
      element: imageEl,
    }
  }

  const textEl = target.closest<HTMLElement>(
    '[data-irie-editable="text"], [data-irie-edit-id]',
  )
  if (textEl) {
    const sectionEl = textEl.closest<HTMLElement>('[data-irie-section-id]')
    return {
      kind: 'text',
      id: textEl.getAttribute('data-irie-edit-id'),
      sectionId: sectionEl?.getAttribute('data-irie-section-id') ?? null,
      element: textEl,
    }
  }

  const sectionEl = target.closest<HTMLElement>('[data-irie-section-id]')
  if (sectionEl) {
    return {
      kind: 'section',
      id: sectionEl.getAttribute('data-irie-section-id'),
      sectionId: sectionEl.getAttribute('data-irie-section-id'),
      element: sectionEl,
    }
  }

  return EMPTY
}
