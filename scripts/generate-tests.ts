/**
 * Run test generations and save to public/outputs/
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-tests.ts
 * Or after deploy: run from the dashboard at /dashboard
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

const tests = [
  {
    filename: 'irie-threads.html',
    payload: {
      brandName: 'Irie Threads',
      vibe: 'warm wearable art, reggae energy, premium fashion, peace you carry',
      audience: 'culture-driven fashion lovers 25-40',
      colors: { primary: '#111111', accent: '#C9A84C', background: '#F5F0E8' },
      mood: 'warm',
      pageType: 'store',
    },
  },
  {
    filename: 'one-love-festival.html',
    payload: {
      brandName: 'One Love Festival',
      vibe: 'energy, color, movement, summer, unity, music and joy',
      audience: 'festival goers, reggae and Caribbean culture community',
      colors: { primary: '#1A0A00', accent: '#FFB400', background: '#0D1A0A' },
      mood: 'warm',
      pageType: 'event',
    },
  },
  {
    filename: 'healing-collective.html',
    payload: {
      brandName: 'The Healing Collective',
      vibe: 'calm, healing, earthy, intentional, conscious cannabis culture',
      audience: 'wellness-focused adults seeking plant-based healing',
      colors: { primary: '#0D1A0A', accent: '#7CAF5E', background: '#F5F2EC' },
      mood: 'light',
      pageType: 'landing',
    },
  },
]

async function main() {
  const fs = await import('fs')
  const path = await import('path')

  for (const test of tests) {
    console.log(`\nGenerating: ${test.payload.brandName}...`)
    const start = Date.now()

    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.payload),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error(`  FAILED: ${err.error}`)
      continue
    }

    const data = await res.json()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    const outPath = path.join(process.cwd(), 'public', 'outputs', test.filename)
    fs.writeFileSync(outPath, data.html, 'utf-8')
    console.log(`  Saved: ${outPath} (${elapsed}s)`)
    console.log(`  Fonts: ${data.metadata.fonts.join(', ')}`)
    console.log(`  Motion: ${data.metadata.motionVocabulary.join(', ')}`)
  }
}

main().catch(console.error)
