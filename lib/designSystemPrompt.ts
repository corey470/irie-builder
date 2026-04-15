import fs from 'node:fs'
import path from 'node:path'

let cached: string | null = null

export function readDesignMd(): string {
  if (cached !== null) return cached
  try {
    const p = path.join(process.cwd(), 'DESIGN.md')
    cached = fs.readFileSync(p, 'utf8')
    return cached
  } catch (err) {
    console.error('[designSystemPrompt] DESIGN.md not readable at repo root:', err)
    cached = ''
    return ''
  }
}

export function buildDesignSystemBlock(overrideMd?: string): string {
  const md = (overrideMd && overrideMd.trim()) || readDesignMd()
  if (!md) return ''
  return [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'BRAND DESIGN SYSTEM — AUTHORITATIVE. READ FIRST.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'This is the complete DESIGN.md for the platform you are generating for.',
    'Every page you produce MUST honor these tokens — colors, fonts, motion,',
    'components, spacing, and the Do/Don\'t rules. Do NOT substitute generic',
    'blue/white/gray palettes. Do NOT pick alternative fonts. Do NOT skip the',
    'signature motion or depth primitives. If the Do\'s/Don\'ts conflict with a',
    'request, the DESIGN.md rule wins.',
    '',
    md,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'END DESIGN SYSTEM — resume the generator task below.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n')
}
