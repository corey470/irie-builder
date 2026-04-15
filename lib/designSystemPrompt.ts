import fs from 'node:fs'
import path from 'node:path'

/**
 * Reads DESIGN.md at module init and extracts a condensed token brief
 * (<2.5k chars) for injection into Anthropic system prompts.
 *
 * Why condensed: the full DESIGN.md is ~17k chars. Prepending that much
 * context to every generation call pushed Vercel function duration past
 * the 60s timeout. The condensed brief carries the essential tokens
 * (colors, fonts, motion signatures, top do's/don'ts) — enough for the
 * model to honor the brand without the latency cost.
 *
 * If DESIGN.md can't be read or parsed, callers still get an empty
 * string (generation proceeds with the default system prompt).
 */

let cachedFull: string | null = null
let cachedBrief: string | null = null

function readDesignMdRaw(): string {
  if (cachedFull !== null) return cachedFull
  try {
    cachedFull = fs.readFileSync(path.join(process.cwd(), 'DESIGN.md'), 'utf8')
    return cachedFull
  } catch (err) {
    console.error('[designSystemPrompt] DESIGN.md not readable:', err)
    cachedFull = ''
    return ''
  }
}

function extractSection(md: string, n: number): string {
  const start = new RegExp(`^## ${n}\\.[^\\n]*$`, 'm')
  const end = new RegExp(`^## ${n + 1}\\.[^\\n]*$`, 'm')
  const s = md.search(start)
  if (s < 0) return ''
  const rest = md.slice(s)
  const e = rest.search(end)
  return e < 0 ? rest : rest.slice(0, e)
}

function extractSubBullets(block: string, heading: string, limit: number): string[] {
  const h = block.search(new RegExp(`^### ${heading}\\s*$`, 'm'))
  if (h < 0) return []
  const rest = block.slice(h)
  const next = rest.slice(1).search(/^###\s/m)
  const body = next < 0 ? rest : rest.slice(0, next + 1)
  return [...body.matchAll(/^-\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .slice(0, limit)
}

function extractColors(sec2: string): string[] {
  const re = /^-\s*\*\*([^*]+)\*\*[^\n]*?(#[0-9A-Fa-f]{3,8})/gm
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(sec2)) !== null) {
    const key = m[2].toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`${m[1].trim()} ${m[2]}`)
    if (out.length >= 6) break
  }
  return out
}

function extractFonts(sec3: string): string[] {
  const block = (sec3.match(/### Font Family[\s\S]*?(?=\n###|\n##|$)/) || [''])[0]
  return [...block.matchAll(/\*\*(Display|Body)\*\*:\s*`?([^`\n,]+?)`?\s*(?:\(|,|\n)/g)].map(
    (m) => `${m[1]}: ${m[2].trim()}`,
  )
}

function extractKeyChars(sec1: string): string[] {
  const idx = sec1.indexOf('**Key Characteristics:**')
  if (idx < 0) return []
  return [...sec1.slice(idx).matchAll(/^-\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .slice(0, 3)
}

function buildBrief(md: string): string {
  if (!md) return ''
  const colors = extractColors(extractSection(md, 2))
  const fonts = extractFonts(extractSection(md, 3))
  const keyChars = extractKeyChars(extractSection(md, 1))
  const sec7 = extractSection(md, 7)
  const dos = extractSubBullets(sec7, 'Do', 5)
  const donts = extractSubBullets(sec7, "Don't", 5)

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'BRAND DESIGN SYSTEM — READ FIRST',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Every page you generate MUST honor these tokens. The short brief below',
    'is authoritative — do NOT substitute generic blue/white/gray, do NOT',
    'pick alternative fonts, do NOT skip the motion signatures.',
    '',
  ]
  if (colors.length) {
    lines.push('## Colors', ...colors.map((c) => `- ${c}`), '')
  }
  if (fonts.length) {
    lines.push('## Typography', ...fonts.map((f) => `- ${f}`), '')
  }
  if (keyChars.length) {
    lines.push('## Motion & Identity', ...keyChars.map((k) => `- ${k}`), '')
  }
  if (dos.length) {
    lines.push('## Do', ...dos.map((d) => `- ${d}`), '')
  }
  if (donts.length) {
    lines.push("## Don't", ...donts.map((d) => `- ${d}`), '')
  }
  lines.push(
    '## Mobile-first (mandatory)',
    '- Phone is primary (375px); desktop is the enhancement.',
    '- Hero headlines use clamp() — e.g. font-size: clamp(2.25rem, 7vw, 6rem); never a fixed px size.',
    '- Tap targets ≥ 44px on buttons/links/inputs (min-height:44px, padding ≥ 12px vertical).',
    '- Stack CTAs on mobile with flex-direction: column; go row at ≥ 640px. Buttons full-width on mobile.',
    '- Grids: single column on mobile; 2–3 columns only at ≥ 768px via @media (min-width: 768px).',
    '- Inputs/textareas: font-size ≥ 16px on mobile (prevents iOS zoom on focus) + width:100%.',
    '- Side padding: ≥ 16px on mobile (px-4), ≥ 24px on tablet+. No edge-touching content.',
    '- Images: max-width:100%; height:auto — never overflow the container.',
    '- Nothing < 14px body / < 12px label on mobile. Use rem/clamp for fluid scale.',
    '',
  )
  lines.push('See DESIGN.md in the repo root for the full spec.')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}

/**
 * Returns the condensed design brief (<2.5k chars). Accepts an optional
 * `overrideMd` so downstream proxies can pass their own platform's
 * DESIGN.md content — the brief is extracted from whichever source is
 * provided.
 */
export function buildDesignSystemBlock(overrideMd?: string): string {
  if (overrideMd && overrideMd.trim()) {
    // Extract from the caller-supplied DESIGN.md (not cached — caller may
    // vary per request).
    return buildBrief(overrideMd)
  }
  if (cachedBrief !== null) return cachedBrief
  cachedBrief = buildBrief(readDesignMdRaw())
  return cachedBrief
}

/**
 * Return the raw DESIGN.md contents (for callers that want to forward
 * the full spec to an upstream service that will do its own extraction).
 */
export function readDesignMd(): string {
  return readDesignMdRaw()
}
