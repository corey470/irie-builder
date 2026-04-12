'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/* ── TYPES ─────────────────────────────────────── */

interface GeneratePayload {
  brandName: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
}

interface Metadata {
  fonts: string[]
  sections: string[]
  palette: { primary: string; accent: string; background: string }
  motionVocabulary: string[]
}

type MoodOption = 'light' | 'dark' | 'warm'
type PageOption = 'landing' | 'store' | 'portfolio' | 'event'

/* ── LOADING MESSAGES ──────────────────────────── */

const LOADING_MESSAGES = [
  'Reading your brief\u2026',
  'Making creative decisions\u2026',
  'Choosing typography\u2026',
  'Building your experience\u2026',
  'Adding motion\u2026',
  'Bringing it alive\u2026',
]

/* ── PILL BUTTON ───────────────────────────────── */

function Pill<T extends string>({
  value, label, selected, onSelect,
}: { value: T; label: string; selected: T; onSelect: (v: T) => void }) {
  const active = value === selected
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`pill ${active ? 'pill--active' : ''}`}
    >
      {label}
    </button>
  )
}

/* ── DASHBOARD PAGE ────────────────────────────── */

export default function DashboardPage() {
  /* form state */
  const [brandName, setBrandName] = useState('')
  const [vibe, setVibe] = useState('')
  const [audience, setAudience] = useState('')
  const [mood, setMood] = useState<MoodOption>('dark')
  const [pageType, setPageType] = useState<PageOption>('landing')
  const [primary, setPrimary] = useState('#111111')
  const [accent, setAccent] = useState('#C9A84C')
  const [background, setBackground] = useState('#F5F0E8')

  /* generation state */
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [genCount, setGenCount] = useState(0)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)

  /* mobile panel */
  const [mobilePanel, setMobilePanel] = useState<'form' | 'preview' | 'log'>('form')

  const iframeRef = useRef<HTMLIFrameElement>(null)

  /* cycle loading messages */
  useEffect(() => {
    if (!loading) return
    setLoadingMsgIdx(0)
    const iv = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 2800)
    return () => clearInterval(iv)
  }, [loading])

  /* generate */
  const generate = useCallback(async () => {
    if (!brandName.trim() || !vibe.trim()) return
    setLoading(true)
    setError(null)

    const payload: GeneratePayload = {
      brandName: brandName.trim(),
      vibe: vibe.trim(),
      audience: audience.trim(),
      colors: { primary, accent, background },
      mood,
      pageType,
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setHtml(data.html)
      setMetadata(data.metadata)
      setGenCount(prev => prev + 1)
      setMobilePanel('preview')

      /* write into iframe */
      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument
        if (doc) {
          doc.open()
          doc.write(data.html)
          doc.close()
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [brandName, vibe, audience, primary, accent, background, mood, pageType])

  /* helpers */
  const openFullScreen = () => {
    if (!html) return
    const w = window.open('', '_blank')
    if (w) { w.document.open(); w.document.write(html); w.document.close() }
  }

  const downloadHtml = () => {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${brandName.toLowerCase().replace(/\s+/g, '-') || 'site'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* write HTML into iframe when it becomes visible */
  const onIframeLoad = useCallback(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) { doc.open(); doc.write(html); doc.close() }
    }
  }, [html])

  /* ── Decision log items from metadata ── */
  const logItems: { icon: string; label: string; value: string }[] = []
  if (metadata) {
    if (metadata.fonts.length > 0)
      logItems.push({ icon: '\u2726', label: 'Typography', value: metadata.fonts.join(' + ') })
    if (metadata.motionVocabulary.length > 0)
      logItems.push({ icon: '\u2726', label: 'Motion', value: metadata.motionVocabulary.join(', ') })
    if (metadata.palette)
      logItems.push({ icon: '\u2726', label: 'Palette', value: `${metadata.palette.primary} / ${metadata.palette.accent} / ${metadata.palette.background}` })
    if (metadata.sections.length > 0)
      logItems.push({ icon: '\u2726', label: 'Sections', value: metadata.sections.join(' \u2192 ') })
  }

  return (
    <>
      <style>{dashboardCSS}</style>

      <div className="db">
        {/* ── MOBILE NAV ── */}
        <nav className="db-mobile-nav">
          <button className={mobilePanel === 'form' ? 'active' : ''} onClick={() => setMobilePanel('form')}>Edit</button>
          <button className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Preview</button>
          <button className={mobilePanel === 'log' ? 'active' : ''} onClick={() => setMobilePanel('log')}>Log</button>
        </nav>

        {/* ── LEFT PANEL: BRAND INPUT ── */}
        <aside className={`db-panel db-form ${mobilePanel === 'form' ? 'db-panel--active' : ''}`}>
          <div className="db-form-inner">
            <h1 className="db-logo">Irie<span>Builder</span></h1>
            <p className="db-sub">Describe your brand. Watch it come alive.</p>

            <label className="db-label" htmlFor="brandName">Brand Name</label>
            <input id="brandName" className="db-input" type="text" placeholder="e.g. Irie Threads"
              value={brandName} onChange={e => setBrandName(e.target.value)} />

            <label className="db-label" htmlFor="vibe">Vibe</label>
            <textarea id="vibe" className="db-textarea" rows={4}
              placeholder="Describe the feeling. What do you want someone to feel when they land here?"
              value={vibe} onChange={e => setVibe(e.target.value)} />

            <label className="db-label" htmlFor="audience">Audience</label>
            <input id="audience" className="db-input" type="text" placeholder="e.g. culture-driven fashion lovers 25-40"
              value={audience} onChange={e => setAudience(e.target.value)} />

            <fieldset className="db-fieldset">
              <legend className="db-label">Mood</legend>
              <div className="db-pills" role="radiogroup" aria-label="Mood selection">
                {(['light', 'dark', 'warm'] as MoodOption[]).map(m => (
                  <Pill key={m} value={m} label={m.charAt(0).toUpperCase() + m.slice(1)} selected={mood} onSelect={setMood} />
                ))}
              </div>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Page Type</legend>
              <div className="db-pills" role="radiogroup" aria-label="Page type selection">
                {(['landing', 'store', 'portfolio', 'event'] as PageOption[]).map(p => (
                  <Pill key={p} value={p} label={p.charAt(0).toUpperCase() + p.slice(1)} selected={pageType} onSelect={setPageType} />
                ))}
              </div>
            </fieldset>

            <label className="db-label">Colors</label>
            <div className="db-colors">
              <div className="db-color-item">
                <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} aria-label="Primary color" />
                <span>Primary<br /><code>{primary}</code></span>
              </div>
              <div className="db-color-item">
                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} aria-label="Accent color" />
                <span>Accent<br /><code>{accent}</code></span>
              </div>
              <div className="db-color-item">
                <input type="color" value={background} onChange={e => setBackground(e.target.value)} aria-label="Background color" />
                <span>Background<br /><code>{background}</code></span>
              </div>
            </div>

            <button className="db-generate" onClick={generate} disabled={loading || !brandName.trim() || !vibe.trim()}>
              {loading ? LOADING_MESSAGES[loadingMsgIdx] : genCount === 0 ? 'Generate Experience' : 'Regenerate'}
            </button>

            {genCount > 0 && <p className="db-gen-count">Generation #{genCount}</p>}
            {error && <p className="db-error">{error}</p>}
          </div>
        </aside>

        {/* ── CENTER PANEL: PREVIEW ── */}
        <main className={`db-panel db-preview ${mobilePanel === 'preview' ? 'db-panel--active' : ''}`}>
          {!html && !loading && (
            <div className="db-placeholder">
              <p className="db-placeholder-title">Describe your brand.</p>
              <p className="db-placeholder-sub">Watch it come alive.</p>
            </div>
          )}

          {loading && (
            <div className="db-loading">
              <div className="db-loading-pulse" />
              <p className="db-loading-msg">{LOADING_MESSAGES[loadingMsgIdx]}</p>
            </div>
          )}

          {html && !loading && (
            <>
              <div className="db-preview-actions">
                <button onClick={openFullScreen} className="db-action-btn">Full Screen</button>
                <button onClick={downloadHtml} className="db-action-btn">Download HTML</button>
                <button onClick={() => setMobilePanel('form')} className="db-action-btn db-back-btn">Back to Edit</button>
              </div>
              <iframe
                ref={iframeRef}
                title="Generated site preview"
                className="db-iframe"
                sandbox="allow-scripts allow-same-origin"
                onLoad={onIframeLoad}
              />
            </>
          )}
        </main>

        {/* ── RIGHT PANEL: GENERATION LOG ── */}
        <aside className={`db-panel db-log ${mobilePanel === 'log' ? 'db-panel--active' : ''}`}>
          <h2 className="db-log-title">Generation Log</h2>
          {logItems.length === 0 && (
            <p className="db-log-empty">Creative decisions will appear here after generation.</p>
          )}
          {logItems.map((item, i) => (
            <div key={i} className="db-log-item">
              <span className="db-log-icon">{item.icon}</span>
              <div>
                <span className="db-log-label">{item.label}</span>
                <span className="db-log-value">{item.value}</span>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  )
}

/* ── ALL CSS ────────────────────────────────────── */

const dashboardCSS = `
  /* reset */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --black: #080808;
    --surface: #0f0f0f;
    --border: rgba(201,168,76,0.18);
    --gold: #C9A84C;
    --gold-dim: rgba(201,168,76,0.12);
    --text: #F2EDE4;
    --muted: rgba(242,237,228,0.45);
    --radius: 6px;
  }

  body {
    font-family: 'Syne', system-ui, sans-serif;
    background: var(--black);
    color: var(--text);
    overflow: hidden;
    height: 100vh;
    height: 100dvh;
  }

  /* ── LAYOUT ── */
  .db {
    display: grid;
    grid-template-columns: 340px 1fr 280px;
    height: 100vh;
    height: 100dvh;
  }

  .db-panel {
    overflow-y: auto;
    height: 100%;
  }

  /* ── MOBILE NAV ── */
  .db-mobile-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 0;
  }
  .db-mobile-nav button {
    flex: 1;
    padding: 14px 0;
    background: none;
    border: none;
    color: var(--muted);
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    min-height: 48px;
  }
  .db-mobile-nav button.active {
    color: var(--gold);
    border-top: 2px solid var(--gold);
  }

  /* ── LEFT PANEL: FORM ── */
  .db-form {
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 28px 24px 32px;
  }
  .db-form-inner {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .db-logo {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.01em;
    margin-bottom: 2px;
  }
  .db-logo span {
    font-style: italic;
    font-weight: 400;
    color: var(--gold);
  }
  .db-sub {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 24px;
    line-height: 1.5;
  }

  .db-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-top: 16px;
    margin-bottom: 6px;
  }

  .db-input, .db-textarea {
    width: 100%;
    background: var(--black);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    color: var(--text);
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    transition: border-color 0.2s;
  }
  .db-input:focus, .db-textarea:focus {
    outline: none;
    border-color: var(--gold);
  }
  .db-textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* fieldset reset */
  .db-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  /* pills */
  .db-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 100px;
    background: transparent;
    color: var(--muted);
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .pill:hover { border-color: var(--gold); color: var(--text); }
  .pill--active {
    background: var(--gold-dim);
    border-color: var(--gold);
    color: var(--gold);
  }

  /* colors */
  .db-colors {
    display: flex;
    gap: 12px;
  }
  .db-color-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .db-color-item input[type="color"] {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2px;
    background: var(--black);
    cursor: pointer;
  }
  .db-color-item span {
    font-size: 11px;
    color: var(--muted);
    line-height: 1.4;
  }
  .db-color-item code {
    font-size: 10px;
    color: var(--text);
    font-family: 'Syne', monospace;
  }

  /* generate button */
  .db-generate {
    margin-top: 24px;
    width: 100%;
    padding: 16px;
    background: var(--gold);
    color: var(--black);
    border: none;
    border-radius: var(--radius);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: box-shadow 0.3s, opacity 0.2s;
    min-height: 52px;
  }
  .db-generate:hover:not(:disabled) {
    box-shadow: 0 0 24px rgba(201,168,76,0.35), 0 0 48px rgba(201,168,76,0.15);
  }
  .db-generate:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .db-gen-count {
    text-align: center;
    font-size: 11px;
    color: var(--muted);
    margin-top: 8px;
  }
  .db-error {
    text-align: center;
    font-size: 12px;
    color: #e55;
    margin-top: 8px;
  }

  /* ── CENTER: PREVIEW ── */
  .db-preview {
    background: var(--black);
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .db-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px;
  }
  .db-placeholder-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(24px, 3vw, 40px);
    font-style: italic;
    color: var(--text);
    margin-bottom: 8px;
  }
  .db-placeholder-sub {
    font-size: 14px;
    color: var(--gold);
    letter-spacing: 0.06em;
  }

  .db-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
  }
  .db-loading-pulse {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--gold);
    animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.2); opacity: 1; }
  }
  .db-loading-msg {
    font-size: 14px;
    color: var(--gold);
    letter-spacing: 0.04em;
    animation: fadeCycle 2.8s ease-in-out infinite;
  }
  @keyframes fadeCycle {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .db-preview-actions {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .db-action-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
    min-height: 44px;
  }
  .db-action-btn:hover { border-color: var(--gold); color: var(--gold); }
  .db-back-btn { display: none; }

  .db-iframe {
    flex: 1;
    width: 100%;
    border: none;
    background: white;
  }

  /* ── RIGHT: LOG ── */
  .db-log {
    background: var(--surface);
    border-left: 1px solid var(--border);
    padding: 28px 20px;
  }
  .db-log-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .db-log-empty {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.6;
  }
  .db-log-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .db-log-icon {
    color: var(--gold);
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .db-log-label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gold);
    margin-bottom: 2px;
    font-weight: 500;
  }
  .db-log-value {
    display: block;
    font-size: 13px;
    color: var(--text);
    line-height: 1.5;
  }

  /* ── GRAIN OVERLAY ── */
  .db::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 1024px) {
    .db {
      grid-template-columns: 300px 1fr 0;
    }
    .db-log { display: none; }
  }

  @media (max-width: 768px) {
    .db {
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .db-mobile-nav { display: flex; }
    .db-panel {
      position: absolute;
      inset: 0;
      bottom: 52px;
      display: none;
    }
    .db-panel--active { display: flex; flex-direction: column; }
    .db-form { padding-bottom: 80px; }
    .db-back-btn { display: inline-flex; }
    .db-log {
      display: none;
      border-left: none;
      border-top: 1px solid var(--border);
    }
    .db-log.db-panel--active { display: flex; flex-direction: column; }
  }

  /* reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .db-loading-pulse { animation: none; opacity: 0.8; }
    .db-loading-msg { animation: none; opacity: 1; }
  }

  /* scrollbar */
  .db-panel::-webkit-scrollbar { width: 4px; }
  .db-panel::-webkit-scrollbar-track { background: transparent; }
  .db-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* focus */
  :focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
`
