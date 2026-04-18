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
  /**
   * How the image is painted on the page. 'img' = <img> element with src/alt.
   * 'bg' = any other element with a non-empty CSS background-image (the
   * assembler paints hero, testimonial, and cta sections this way, not as
   * <img>). Replace / Fit / Crop need to branch on this so bg-painted
   * sections can also be swapped — previously only <img> worked, so Corey
   * could only change the hero image.
   */
  kind: 'img' | 'bg'
}

export interface MarqueeObject {
  id: string
  /**
   * De-duplicated list of visible marquee phrases, in document order.
   * Separator glyphs (· • etc) are filtered out — they're regenerated when
   * the marquee is rebuilt. The assembler doubles the phrase list for
   * seamless loop; we only report the first half here.
   */
  words: string[]
  /** The · or • separator the assembler emitted — preserved on rebuild. */
  separator: string
  sectionId: string | null
  label: string
}

export interface ObjectInventory {
  texts: TextObject[]
  images: ImageObject[]
  marquees: MarqueeObject[]
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
/** Heuristic: any span whose trimmed text is 1–2 chars of common separator
 * glyphs. These are emitted by the assembler between each marquee word. */
const SEPARATOR_CHARS = new Set(['·', '•', '–', '—', '/', '*'])
function isSeparatorSpan(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 2) return false
  return SEPARATOR_CHARS.has(t)
}

export function annotateObjects(doc: Document): ObjectInventory {
  const texts: TextObject[] = []
  const images: ImageObject[] = []
  const marquees: MarqueeObject[] = []

  // Annotate marquees FIRST. Any span inside a .marquee-track that the
  // text-classifier might otherwise mistake for an editable text node gets
  // skipped (checked below via ancestor walk).
  const marqueeContainers = Array.from(
    doc.querySelectorAll<HTMLElement>('.marquee-track, .marquee'),
  )
  // If an outer .marquee wraps an inner .marquee-track, prefer the track
  // so IDs don't collide. Dedupe by closest track or fallback to the
  // container itself.
  const seenMarqueeRoots = new Set<HTMLElement>()
  marqueeContainers.forEach((el) => {
    const track = el.classList.contains('marquee-track')
      ? el
      : el.querySelector<HTMLElement>('.marquee-track') || el
    if (seenMarqueeRoots.has(track)) return
    seenMarqueeRoots.add(track)
  })
  Array.from(seenMarqueeRoots).forEach((track, idx) => {
    const existing = track.getAttribute('data-irie-marquee-id')
    const id = existing || `marquee-${idx + 1}`
    if (!existing) track.setAttribute('data-irie-marquee-id', id)
    // Extract phrases (skip separator glyph spans). Assembler doubles the
    // word list for seamless loop; we halve to report the unique set.
    const spans = Array.from(track.querySelectorAll('span'))
    const allTexts = spans
      .map((s) => (s.textContent ?? '').trim())
      .filter((t) => t.length > 0)
    const words: string[] = []
    let separator = '·'
    for (const t of allTexts) {
      if (isSeparatorSpan(t)) {
        if (SEPARATOR_CHARS.has(t.trim())) separator = t.trim()
        continue
      }
      words.push(t)
    }
    // De-duplicate the doubled loop — take the first half if the array is
    // exactly mirrored. Otherwise keep all unique entries in order.
    const halved =
      words.length >= 4 && words.length % 2 === 0 &&
      words.slice(0, words.length / 2).join('|') ===
        words.slice(words.length / 2).join('|')
        ? words.slice(0, words.length / 2)
        : Array.from(new Set(words))
    const sectionEl = track.closest<HTMLElement>('[data-irie-section-id]')
    const sectionId = sectionEl?.getAttribute('data-irie-section-id') ?? null
    marquees.push({
      id,
      words: halved,
      separator,
      sectionId,
      label: `Marquee ${idx + 1}`,
    })
  })

  // Bug B fix: the assembler's footer uses <span> wrappers for "© 2026 Brand"
  // and "Playfair · Syne", which the original selector (h1-h4, p, button, a)
  // never caught — so clicking footer text did nothing. Widen the selector
  // to include inline text wrappers (span, small, em, strong, li) and guard
  // against double-annotation by skipping any element that sits inside an
  // already-annotated parent, a marquee strip, or an image container.
  const textNodes = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, button, a, span, small, em, strong, li',
    ),
  )
  textNodes.forEach((node, idx) => {
    // Skip empty text nodes, nav wrappers, and anything inside a button
    // (so the inner <span> of a button isn't double-annotated).
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) return
    const tagName = node.tagName.toLowerCase()
    // Skip anchors that are actually image wrappers.
    if (tagName === 'a' && node.querySelector('img')) return

    // Skip inline wrappers whose text is already covered by an annotated
    // parent element. A <span> inside <p>, <h1>, <button>, etc. should NOT
    // become its own editable object — editing the outer parent is what
    // the user expects.
    if (tagName === 'span' || tagName === 'small' || tagName === 'em' ||
        tagName === 'strong' || tagName === 'li') {
      const parent = node.parentElement
      if (parent?.closest('h1, h2, h3, h4, p, button, a, [data-irie-edit-id]')) {
        return
      }
      // Skip any span inside a marquee strip — marquee words are handled by
      // the marquee object mode, not per-word text edit.
      if (node.closest('.marquee, .marquee-track, [data-irie-marquee-id]')) {
        return
      }
      // Must be inside a section to be addressable by section-scoped dials.
      if (!node.closest('[data-irie-section-id]')) return
    }

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
      kind: 'img',
    })
  })

  // Background-image elements. The assembler paints hero / testimonial /
  // cta-section with linear-gradient(...),url(...) backgrounds instead of
  // bare <img> tags. Walk every element with a data-irie-section-id
  // (section roots) plus their direct descendants and annotate any node
  // whose inline style.backgroundImage contains a url(…). We restrict to
  // section-scoped elements so we don't annotate unrelated decorative
  // backgrounds (orbs, grain, cta-section::before etc).
  const bgCandidates: HTMLElement[] = []
  doc
    .querySelectorAll<HTMLElement>('[data-irie-section-id], [data-irie-section-id] *')
    .forEach((el) => {
      // Prefer inline style.backgroundImage; fall back to computed style so
      // class-based backgrounds are still swappable. Skip if empty / 'none'.
      const inline = el.style.backgroundImage
      let bg = inline
      if ((!bg || bg === 'none') && doc.defaultView) {
        const computed = doc.defaultView.getComputedStyle(el).backgroundImage
        if (computed && computed !== 'none') bg = computed
      }
      if (!bg) return
      // Must reference an actual url(…) token to be swappable. Gradients
      // without a url layer (pure color overlays) are not editable here.
      if (!/url\(/i.test(bg)) return
      bgCandidates.push(el)
    })
  bgCandidates.forEach((node, idx) => {
    const existing = node.getAttribute('data-irie-image-id')
    const id = existing || `bgimage-${idx + 1}`
    if (!existing) node.setAttribute('data-irie-image-id', id)
    const sectionEl = node.closest<HTMLElement>('[data-irie-section-id]')
    const sectionId = sectionEl?.getAttribute('data-irie-section-id') ?? null
    // Pull the url(...) out of the background-image declaration so the
    // Image panel can display the current source.
    const bgRaw = node.style.backgroundImage ||
      (doc.defaultView
        ? doc.defaultView.getComputedStyle(node).backgroundImage
        : '')
    const urlMatch = /url\((['"]?)([^)'"]+)\1\)/i.exec(bgRaw)
    const src = urlMatch?.[2] ?? ''
    images.push({
      id,
      src,
      alt: '',
      sectionId,
      label: `Background ${idx + 1}`,
      kind: 'bg',
    })
  })

  return { texts, images, marquees }
}

/**
 * Find the marquee-track element for a given marquee id.
 */
export function findMarqueeElement(doc: Document, id: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[data-irie-marquee-id="${CSS.escape(id)}"]`,
  )
}

/**
 * Rebuild the marquee-track children from an updated word list while
 * preserving the doubled-loop pattern and the separator glyph. Also
 * optionally sets animation-duration (speed), color mode (alternating /
 * cream / gold), and font family.
 */
export interface MarqueeStyle {
  words?: string[]
  separator?: string
  durationSeconds?: number
  colorMode?: 'alternating' | 'cream' | 'gold'
  font?: 'display' | 'body'
}

export function applyMarqueeStyle(
  el: HTMLElement,
  style: MarqueeStyle,
): void {
  if (style.words || style.separator !== undefined) {
    const separator = style.separator ?? el.dataset.irieMarqueeSeparator ?? '·'
    const words =
      style.words ??
      Array.from(el.querySelectorAll('span'))
        .map((s) => (s.textContent ?? '').trim())
        .filter((t) => t && !isSeparatorSpan(t))
    el.dataset.irieMarqueeSeparator = separator
    // Rebuild children: word · word · ... doubled for seamless loop.
    const doc = el.ownerDocument
    el.innerHTML = ''
    const build = () => {
      words.forEach((w, i) => {
        const word = doc.createElement('span')
        word.textContent = w
        el.appendChild(word)
        if (i < words.length - 1 || words.length > 0) {
          const sep = doc.createElement('span')
          sep.textContent = separator
          el.appendChild(sep)
        }
      })
    }
    build()
    build()
  }
  if (style.durationSeconds !== undefined) {
    el.style.animationDuration = `${style.durationSeconds}s`
  }
  if (style.colorMode !== undefined) {
    el.dataset.irieMarqueeColor = style.colorMode
    // Alternating is the CSS default (:nth-child(odd) color accent).
    // For 'cream' we force every span to inherit; for 'gold' we force all
    // to accent. Inline style on spans wins over the stylesheet rule.
    const spans = el.querySelectorAll<HTMLElement>('span')
    if (style.colorMode === 'alternating') {
      spans.forEach((s) => { s.style.color = '' })
    } else if (style.colorMode === 'cream') {
      spans.forEach((s) => { s.style.color = 'var(--irie-cream, #F2EDE4)' })
    } else if (style.colorMode === 'gold') {
      spans.forEach((s) => { s.style.color = 'var(--color-accent, #C9A84C)' })
    }
  }
  if (style.font !== undefined) {
    el.dataset.irieMarqueeFont = style.font
    const spans = el.querySelectorAll<HTMLElement>('span')
    if (style.font === 'display') {
      spans.forEach((s) => {
        s.style.fontFamily = "'Playfair Display', Georgia, serif"
        s.style.fontStyle = 'italic'
      })
    } else {
      spans.forEach((s) => {
        s.style.fontFamily = "'Syne', system-ui, sans-serif"
        s.style.fontStyle = 'normal'
      })
    }
  }
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

/**
 * Find the element for a bg-image object. Returns any HTMLElement with
 * the matching data-irie-image-id (usually a <section>, <div>, or similar).
 * Callers mutate `.style.backgroundImage` instead of `.src`.
 */
export function findBgImageElement(
  doc: Document,
  id: string,
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[data-irie-image-id="${CSS.escape(id)}"]`,
  )
}
