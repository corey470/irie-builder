/**
 * Tuner v2 — Object model
 *
 * Annotates every editable text/image inside the iframe with stable ids
 * and returns a flat list the UI can render. Mirrors the pre-Tuner
 * buildEditableDocumentModel (builder-platform.tsx:1039-1113) shape, minus
 * the HTML-rewrite path — we work on the live iframe Document so the Tuner's
 * runtime CSS block + section rings survive.
 *
 * Ids are deterministic across re-annotations: text-{n} in document order,
 * image-{n} in document order, where n is 1-indexed.
 */

export interface TextObject {
  id: string
  tagName: string
  text: string
  /** 'headline' | 'subheadline' | 'heading' | 'body' | 'cta' */
  kind: 'headline' | 'subheadline' | 'heading' | 'body' | 'cta'
  /** True when element is a button / short <a> — gets CTA-only fields. */
  isAction: boolean
  sectionId: string | null
  label: string
}

export interface ImageObject {
  id: string
  src: string
  alt: string
  sectionId: string | null
  label: string
}

export interface ObjectInventory {
  texts: TextObject[]
  images: ImageObject[]
}

function labelText(tagName: string, index: number, text: string): string {
  if (tagName === 'h1') return 'Headline'
  if (tagName === 'p' && index === 0) return 'Subheadline'
  if (tagName === 'button' || (tagName === 'a' && text.length <= 32))
    return `CTA ${index + 1}`
  if (tagName === 'h2' || tagName === 'h3')
    return `Heading ${index + 1}`
  return `Body ${index + 1}`
}

function classifyText(
  tagName: string,
  index: number,
  text: string,
): TextObject['kind'] {
  if (tagName === 'h1') return 'headline'
  if (tagName === 'p' && index === 0) return 'subheadline'
  if (tagName === 'button' || (tagName === 'a' && text.length <= 32))
    return 'cta'
  if (tagName === 'h2' || tagName === 'h3') return 'heading'
  return 'body'
}

function isActionElement(tagName: string, text: string): boolean {
  return tagName === 'button' || (tagName === 'a' && text.length <= 32)
}

/**
 * Walk the iframe document once. Assign ids in DOM order. Returns a flat
 * inventory the UI can filter per-section later.
 *
 * Safe to run multiple times — if an id is already assigned, we keep it and
 * only patch text/src from live DOM.
 */
export function annotateObjects(doc: Document): ObjectInventory {
  const texts: TextObject[] = []
  const images: ImageObject[] = []

  const textNodes = Array.from(
    doc.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, button, a'),
  )
  textNodes.forEach((node, idx) => {
    // Skip empty text nodes, nav wrappers, and anything inside a button
    // (so the inner <span> of a button isn't double-annotated).
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) return
    const tagName = node.tagName.toLowerCase()
    // Skip anchors that are actually image wrappers.
    if (tagName === 'a' && node.querySelector('img')) return

    const existing = node.getAttribute('data-irie-edit-id')
    const id = existing || `text-${idx + 1}`
    if (!existing) {
      node.setAttribute('data-irie-edit-id', id)
    }
    node.setAttribute('data-irie-editable', 'text')
    const sectionEl = node.closest<HTMLElement>('[data-irie-section-id]')
    const sectionId = sectionEl?.getAttribute('data-irie-section-id') ?? null
    texts.push({
      id,
      tagName,
      text,
      kind: classifyText(tagName, idx, text),
      isAction: isActionElement(tagName, text),
      sectionId,
      label: labelText(tagName, idx, text),
    })
  })

  const imageNodes = Array.from(doc.querySelectorAll<HTMLImageElement>('img'))
  imageNodes.forEach((node, idx) => {
    const existing = node.getAttribute('data-irie-image-id')
    const id = existing || `image-${idx + 1}`
    if (!existing) node.setAttribute('data-irie-image-id', id)
    const sectionEl = node.closest<HTMLElement>('[data-irie-section-id]')
    const sectionId = sectionEl?.getAttribute('data-irie-section-id') ?? null
    images.push({
      id,
      src: node.getAttribute('src') || '',
      alt: node.getAttribute('alt') || '',
      sectionId,
      label: `Image ${idx + 1}`,
    })
  })

  return { texts, images }
}

export function findTextElement(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[data-irie-edit-id="${CSS.escape(id)}"]`,
  )
}

export function findImageElement(
  doc: Document,
  id: string,
): HTMLImageElement | null {
  const el = doc.querySelector<HTMLElement>(
    `[data-irie-image-id="${CSS.escape(id)}"]`,
  )
  return el instanceof HTMLImageElement ? el : null
}
