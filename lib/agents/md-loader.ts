import fs from 'node:fs'
import path from 'node:path'

/**
 * Loads reference markdown files (PSYCHOLOGY, DESIGN, DESIGN_DIRECTIONS)
 * at module init and caches them for the lifetime of the serverless
 * container. Each agent pulls whichever slices it needs.
 *
 * Files are bundled into the Vercel function via next.config's output
 * tracing — fs.readFileSync from process.cwd() works in production.
 */

let cache: {
  psychology: string
  design: string
  designDirections: string
} | null = null

function tryRead(filename: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), filename), 'utf8')
  } catch (err) {
    console.error(`[md-loader] failed to read ${filename}:`, err)
    return ''
  }
}

export function loadReferenceDocs() {
  if (cache) return cache
  cache = {
    psychology: tryRead('PSYCHOLOGY.md'),
    design: tryRead('DESIGN.md'),
    designDirections: tryRead('DESIGN_DIRECTIONS.md'),
  }
  return cache
}

/** Extracts sections 10/11 (mobile rules + psychology) from DESIGN.md when
 *  we want compact prompts. Falls back to the full doc if parsing fails. */
export function getDesignMobileAndPsychology(): string {
  const { design } = loadReferenceDocs()
  if (!design) return ''
  const mobileStart = design.indexOf('## 10.')
  if (mobileStart === -1) return design.slice(0, 6000)
  return design.slice(mobileStart)
}

/** Extracts motion-relevant DESIGN.md slices (sections 1, 4's Motion bits,
 *  and 6). */
export function getDesignMotionBrief(): string {
  const { design } = loadReferenceDocs()
  if (!design) return ''
  const s1 = design.indexOf('## 1.')
  const s6End = design.indexOf('## 7.')
  if (s1 === -1 || s6End === -1) return design.slice(0, 6000)
  return design.slice(s1, s6End)
}
