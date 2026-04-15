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

/**
 * From a section block, grab the first N bullets appearing after the
 * given sub-heading ("### Heading"). Stops at the next "###" or section
 * boundary.
 */
/**
 * Compressed universal Mobile + Psychology rules. The full narrative
 * lives in DESIGN.md §10 and §11 (reference-quality prose for humans).
 * For the generator we ship a tight hand-crafted block so the total
 * brief stays under the ~2.5k-char latency budget.
 */
const MOBILE_RULES: readonly string[] = [
  'Design at 375px first, scale up',
  'Touch targets min 44×44px',
  'No horizontal scroll, ever',
  'Inputs + primary CTAs full-width on mobile',
  'clamp() for hero type; body min 16px (prevents iOS input zoom)',
  'Content never touches edges (min 16px gutter)',
  'Primary CTA in bottom-third thumb zone on mobile',
  'Modals go full-screen on mobile',
  'Tables: horizontal-scroll container or stack as cards at <sm',
] as const

const PSYCH_RULES: readonly string[] = [
  'Motion captures attention before thought — use scroll reveals intentionally',
  'Accent on canvas only for headlines + primary CTAs (high contrast draws the eye)',
  'Social proof directly before the CTA, not at the bottom',
  'Specific numbers beat vague claims ("312 orders this month" > "many customers")',
  'Frame as loss avoidance, not gain ("never miss a customer" > "get more customers")',
  'One primary CTA per section — decision paralysis kills conversion',
  '80% read only the headline — make it carry the full message alone',
  'Above the fold is worth 5× below — lead with value prop + CTA',
  'Short paragraphs (≤3 sentences); subheadings every 2-3 paragraphs',
  'Only use scarcity when true — fake urgency destroys trust permanently',
] as const

function buildBrief(md: string): string {
  if (!md) return ''
  const colors = extractColors(extractSection(md, 2))
  const fonts = extractFonts(extractSection(md, 3))
  const keyChars = extractKeyChars(extractSection(md, 1))
  const sec7 = extractSection(md, 7)
  const dos = extractSubBullets(sec7, 'Do', 5)
  const donts = extractSubBullets(sec7, "Don't", 5)
  const mobile = MOBILE_RULES
  const psych = PSYCH_RULES

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'BRAND DESIGN SYSTEM — READ FIRST',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Every page you generate MUST honor the tokens, mobile rules, and',
    'psychology principles below. Do NOT substitute generic blue/white/gray,',
    'do NOT pick alternative fonts, do NOT skip the motion signatures, do',
    'NOT ignore the mobile or psychology rules — they are load-bearing.',
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
  if (mobile.length) {
    lines.push('## Mobile-First (design at 375px, scale up)', ...mobile.map((m) => `- ${m}`), '')
  }
  if (psych.length) {
    lines.push('## Psychology (convert distracted humans)', ...psych.map((p) => `- ${p}`), '')
  }
  lines.push('See DESIGN.md in the repo root for the full spec (sections 1-11).')
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
