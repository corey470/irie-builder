'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/* ── TYPES ─────────────────────────────────────── */

interface GeneratePayload {
  brandName: string
  headline: string
  heroImageUrl: string
  heroImageDescription: string
  ctaText: string
  vibe: string
  audience: string
  colors: { primary: string; accent: string; background: string }
  mood: 'light' | 'dark' | 'warm'
  pageType: 'landing' | 'store' | 'portfolio' | 'event'
  userFeedback?: string
  rawBrief?: string
}

interface Metadata {
  fonts: string[]
  sections: string[]
  palette: { primary: string; accent: string; background: string }
  motionVocabulary: string[]
}

interface CreativeDecision {
  label: string
  value: string
  reason: string
}

type MoodOption = 'light' | 'dark' | 'warm'
type PageOption = 'landing' | 'store' | 'portfolio' | 'event'

/* ── INTENT DETECTION (UPGRADE 2) ─────────────── */

const BRAND_KEYWORDS = ['dj', 'restaurant', 'streetwear', 'luxury', 'cannabis', 'jewelry', 'fitness', 'salon', 'bar', 'event', 'portfolio', 'photography', 'yoga', 'bakery', 'coffee', 'tattoo', 'music', 'fashion', 'creative', 'candle', 'catering', 'florist', 'barber', 'spa', 'club', 'gallery']
const MOOD_KEYWORDS = ['dark', 'light', 'moody', 'minimal', 'bold', 'warm', 'vibrant', 'earthy', 'clean', 'premium', 'edgy', 'soft', 'electric', 'chill', 'elevated', 'raw', 'elegant', 'gritty', 'dreamy', 'atmospheric']
const AUDIENCE_KEYWORDS = ['women', 'men', 'local', 'community', 'culture', 'lovers', 'fans', 'seekers', 'professionals', 'young', 'millennials', 'gen z']
const LOCATION_KEYWORDS = ['miami', 'brooklyn', 'nashville', 'atlanta', 'la', 'los angeles', 'new york', 'chicago', 'london', 'austin', 'portland', 'oakland', 'detroit', 'tokyo', 'paris', 'toronto', 'seattle', 'denver', 'houston', 'philly', 'memphis']
const ACTION_KEYWORDS = ['sell', 'serve', 'book', 'perform', 'create', 'make', 'build', 'offer', 'teach', 'design', 'cook', 'host']

function analyzeIntent(input: string): number {
  const lower = input.toLowerCase()
  let score = 0
  if (BRAND_KEYWORDS.some(kw => lower.includes(kw))) score += 2
  if (MOOD_KEYWORDS.some(kw => lower.includes(kw))) score += 2
  if (AUDIENCE_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (LOCATION_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (ACTION_KEYWORDS.some(kw => lower.includes(kw))) score += 1
  if (input.trim().split(/\s+/).length > 6) score += 1
  return score
}

/* ── CHAT QUESTION DEFINITIONS ────────────────── */

interface ChatQuestion {
  key: string
  question: string
  placeholder: string
}

const CHAT_QUESTIONS: ChatQuestion[] = [
  { key: 'brandName', question: "What's your brand called?", placeholder: '' },
  { key: 'vibe', question: 'What do you want someone to feel when they land here?', placeholder: 'e.g. Warm, like a festival at golden hour. Art you wear. Peace you carry.' },
  { key: 'audience', question: 'Who are you talking to?', placeholder: 'e.g. Culture-driven fashion lovers who live at the intersection of music and art.' },
  { key: 'headline', question: "What's your hero headline — the first thing they read?", placeholder: 'e.g. Art you wear. Peace you carry.' },
  { key: 'heroImage', question: 'Got an image for your hero? Paste a URL — or describe what it should feel like and the AI will find one.', placeholder: 'e.g. A hand reaching up at a concert, atmospheric, bokeh lights' },
  { key: 'ctaText', question: 'What do you want them to do?', placeholder: 'e.g. Shop the collection, Reserve a table, Join the community' },
]

/* ── PRESETS ───────────────────────────────────── */

interface Preset {
  label: string
  answers: string[]
  mood: MoodOption
  pageType: PageOption
  colors: { primary: string; accent: string; background: string }
}

const PRESETS: Preset[] = [
  {
    label: 'Streetwear Brand',
    answers: ['Your Brand', 'Bold, urban, premium streetwear. The energy of a drop day. Confident, slightly rebellious, always authentic.', 'Culture-driven streetwear fans 18-35', 'Built different. Worn proud.', 'skip', 'Shop the Drop'],
    mood: 'dark', pageType: 'store',
    colors: { primary: '#0A0A0A', accent: '#E8C547', background: '#0A0A0A' },
  },
  {
    label: 'Luxury Brand',
    answers: ['Your Brand', 'Quiet luxury. Refined, minimal, timeless. The feeling of quality before you even touch it.', 'Discerning buyers 30-55 who value craftsmanship over logos', 'Refined by design. Defined by you.', 'skip', 'Explore the Collection'],
    mood: 'light', pageType: 'store',
    colors: { primary: '#1A1A1A', accent: '#C9A84C', background: '#F8F5F0' },
  },
  {
    label: 'Restaurant',
    answers: ['Your Restaurant', 'Warm, soulful, inviting. The smell of something good cooking. Neighborhood spot with a premium feel.', 'Local food lovers and experience seekers 25-55', 'Food that stays with you.', 'skip', 'Reserve a Table'],
    mood: 'warm', pageType: 'landing',
    colors: { primary: '#1C0F00', accent: '#D47C2F', background: '#FDF6EC' },
  },
  {
    label: 'Creator Portfolio',
    answers: ['Your Name', 'Creative, editorial, confident. The portfolio of someone who knows exactly what they do and does it exceptionally well.', 'Brands and businesses looking for creative partnership', 'This is my work.', 'skip', 'See My Work'],
    mood: 'dark', pageType: 'portfolio',
    colors: { primary: '#080808', accent: '#FF4D00', background: '#080808' },
  },
  {
    label: 'Event Page',
    answers: ['Your Event', 'High energy, exclusive, electric. The anticipation before the doors open. FOMO in the best way.', 'Event-goers and culture community 21-40', "You don't want to miss this.", 'skip', 'Get Your Tickets'],
    mood: 'dark', pageType: 'event',
    colors: { primary: '#0A0008', accent: '#9B5DE5', background: '#0A0008' },
  },
]

/* ── LOADING MESSAGES (UPGRADE 4) ─────────────── */

const LOADING_MESSAGES = [
  'Reading your brief\u2026',
  'Deciding on your typography\u2026',
  'Building your color system\u2026',
  'Choosing your motion vocabulary\u2026',
  'Writing your headlines\u2026',
  'Designing your sections\u2026',
  'Adding atmosphere\u2026',
  'Placing the unexpected detail\u2026',
  'Bringing it alive\u2026',
  'Almost there\u2026',
]

const PLACEHOLDER_DECISIONS = [
  'Typography pairing',
  'Color system',
  'Motion personality',
  'Atmosphere layer',
  'Section architecture',
  'Section headings',
  'Unexpected detail',
  'Brand voice',
  'Hero treatment',
  'Overall direction',
]

/* ── PILL BUTTON ───────────────────────────────── */

function Pill<T extends string>({
  value, label, selected, onSelect,
}: { value: T; label: string; selected: T; onSelect: (v: T) => void }) {
  const active = value === selected
  return (
    <button type="button" onClick={() => onSelect(value)}
      className={`pill ${active ? 'pill--active' : ''}`}>
      {label}
    </button>
  )
}

/* ── CHAT MESSAGE TYPE ────────────────────────── */

interface ChatMessage {
  role: 'ai' | 'user'
  text: string
}

/* ── DASHBOARD PAGE ────────────────────────────── */

export default function DashboardPage() {
  /* Just Build It state */
  const [briefInput, setBriefInput] = useState('')
  const [chatExpanded, setChatExpanded] = useState(false)

  /* chat state */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chatPhase, setChatPhase] = useState<'conversation' | 'generating' | 'complete' | 'feedback'>('conversation')
  const [answers, setAnswers] = useState<string[]>([])

  /* form state — Your Vibe */
  const [vibeText, setVibeText] = useState('')
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
  const [decisions, setDecisions] = useState<CreativeDecision[]>([])
  const [visibleDecisions, setVisibleDecisions] = useState(0)
  const [genCount, setGenCount] = useState(0)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [errorLog, setErrorLog] = useState<{ time: string; message: string }[]>([])

  /* mobile panel */
  const [mobilePanel, setMobilePanel] = useState<'form' | 'preview' | 'log'>('form')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const briefInputRef = useRef<HTMLInputElement>(null)

  /* scroll chat to bottom on new messages */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* focus input after typing indicator clears */
  useEffect(() => {
    if (!isTyping && chatPhase === 'conversation' && chatExpanded) {
      inputRef.current?.focus()
    }
  }, [isTyping, chatPhase, chatExpanded])

  /* cycle loading messages — 2.5s each (UPGRADE 4) */
  useEffect(() => {
    if (!loading) return
    setLoadingMsgIdx(0)
    const iv = setInterval(() => {
      setLoadingMsgIdx(prev => {
        const next = prev + 1
        return next < LOADING_MESSAGES.length ? next : prev
      })
    }, 2500)
    return () => clearInterval(iv)
  }, [loading])

  /* Stagger visible decisions in sync with loading (UPGRADE 4) */
  useEffect(() => {
    if (!loading) return
    setVisibleDecisions(0)
    const iv = setInterval(() => {
      setVisibleDecisions(prev => {
        const next = prev + 1
        return next <= PLACEHOLDER_DECISIONS.length ? next : prev
      })
    }, 2500)
    return () => clearInterval(iv)
  }, [loading])

  /* ── GENERATE ── */
  const generate = useCallback(async (
    collectedAnswers?: string[],
    feedback?: string,
    rawBrief?: string,
  ) => {
    const brandName = collectedAnswers?.[0] || ''
    const vibe = collectedAnswers?.[1] || ''
    const audience = collectedAnswers?.[2] || ''
    const headline = collectedAnswers?.[3] || ''
    const heroRaw = collectedAnswers?.[4] || ''
    const ctaText = collectedAnswers?.[5] || ''

    const isUrl = heroRaw.match(/^https?:\/\//i)
    const isSkip = heroRaw.toLowerCase() === 'skip' || heroRaw.trim() === ''

    const mergedVibe = vibeText.trim() ? `${vibe}. ${vibeText.trim()}` : vibe
    const finalVibe = feedback ? `${mergedVibe} — User feedback: ${feedback}` : mergedVibe

    // For rawBrief mode, we only need the brief
    if (!rawBrief && !brandName.trim() && !finalVibe.trim()) return

    setLoading(true)
    setError(null)
    setDecisions([])
    setVisibleDecisions(0)

    const payload: GeneratePayload = {
      brandName: brandName.trim(),
      headline: headline.trim(),
      heroImageUrl: isUrl ? heroRaw.trim() : '',
      heroImageDescription: (!isUrl && !isSkip) ? heroRaw.trim() : '',
      ctaText: ctaText.trim(),
      vibe: finalVibe.trim(),
      audience: audience.trim(),
      colors: { primary, accent, background },
      mood,
      pageType,
      ...(feedback ? { userFeedback: feedback } : {}),
      ...(rawBrief ? { rawBrief } : {}),
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data: Record<string, unknown>
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        const preview = text.slice(0, 120).replace(/<[^>]*>/g, '').trim()
        throw new Error(`Server returned non-JSON (HTTP ${res.status}): ${preview || 'empty response'}`)
      }

      if (!res.ok || data.error) {
        throw new Error((data.message as string) || (data.error as string) || `Generation failed (HTTP ${res.status})`)
      }

      setHtml(data.html as string)
      setMetadata(data.metadata as Metadata)
      setGenCount(prev => prev + 1)
      setMobilePanel('preview')

      // Parse creative decisions from response
      const apiDecisions = (data.decisions as CreativeDecision[] | undefined) || []
      if (apiDecisions.length > 0) {
        setDecisions(apiDecisions)
        setVisibleDecisions(apiDecisions.length)
      }

      if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument
        if (doc) { doc.open(); doc.write(data.html as string); doc.close() }
      }

      // UPGRADE 5 — 3-bubble completion
      setChatPhase('complete')
      setMessages(prev => [...prev, { role: 'ai', text: "There's no perfect website. Only one that feels right to you." }])

      // Second bubble — reference decisions
      const decisionSummary = apiDecisions.length > 0
        ? apiDecisions.slice(0, 3).map(d => `${d.label}: ${d.value}`).join('. ')
        : 'typography, color system, and motion'

      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: `I made ${apiDecisions.length || 'several'} creative decisions for you. Here's what I chose \u2014 ${decisionSummary}.`,
        }])
      }, 1500)

      // Third bubble
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: 'Does this feel right? Tell me anything you want to change.' }])
        setChatPhase('feedback')
      }, 3000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      setErrorLog(prev => [...prev, { time: new Date().toLocaleTimeString(), message: msg }])
      setMessages(prev => [...prev, { role: 'ai', text: `Something went wrong: ${msg}. Try again?` }])
      setChatPhase('feedback')
    } finally {
      setLoading(false)
    }
  }, [vibeText, primary, accent, background, mood, pageType])

  /* ── JUST BUILD IT (UPGRADE 1) ── */
  const handleJustBuildIt = useCallback(() => {
    const brief = briefInput.trim()
    if (!brief) return

    const score = analyzeIntent(brief)

    // Expand chat, show brief as user message, show "Got it"
    setChatExpanded(true)
    setMessages([
      { role: 'user', text: brief },
    ])
    setAnswers([])
    setCurrentStep(0)
    setError(null)

    if (score >= 3) {
      // High intent — skip questionnaire entirely
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
        setChatPhase('generating')
        generate(undefined, undefined, brief)
      }, 600)
    } else {
      // Low intent — start questionnaire
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, {
          role: 'ai',
          text: "I want to get this right. Let me ask you a few quick things.",
        }])
        setTimeout(() => {
          setIsTyping(true)
          setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[0].question }])
            setChatPhase('conversation')
          }, 400)
        }, 600)
      }, 600)
    }
  }, [briefInput, generate])

  /* ── SUBMIT ANSWER ── */
  const submitAnswer = useCallback((value?: string) => {
    const answer = (value ?? inputValue).trim()
    if (!answer && currentStep !== 4) return

    const displayAnswer = answer || 'skip'
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', text: displayAnswer }])

    const newAnswers = [...answers, displayAnswer]
    setAnswers(newAnswers)
    const nextStep = currentStep + 1

    if (nextStep < CHAT_QUESTIONS.length) {
      setIsTyping(true)
      setCurrentStep(nextStep)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[nextStep].question }])
      }, 600)
    } else {
      setCurrentStep(nextStep)
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
        setChatPhase('generating')
        generate(newAnswers)
      }, 600)
    }
  }, [inputValue, currentStep, answers, generate])

  /* ── SUBMIT FEEDBACK ── */
  const submitFeedback = useCallback(() => {
    const feedback = inputValue.trim()
    if (!feedback) return
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', text: feedback }])

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'ai', text: "Rebuilding around your feedback\u2026" }])
      setChatPhase('generating')
      setHtml(null)
      setMetadata(null)
      setDecisions([])
      generate(answers.length > 0 ? answers : undefined, feedback, briefInput.trim() || undefined)
    }, 600)
  }, [inputValue, answers, generate, briefInput])

  /* ── HANDLE SEND ── */
  const handleSend = useCallback(() => {
    if (chatPhase === 'feedback') {
      submitFeedback()
    } else if (chatPhase === 'conversation') {
      submitAnswer()
    }
  }, [chatPhase, submitAnswer, submitFeedback])

  /* ── PRESET SPEED-RUN ── */
  const applyPreset = useCallback((p: Preset) => {
    setMood(p.mood)
    setPageType(p.pageType)
    setPrimary(p.colors.primary)
    setAccent(p.colors.accent)
    setBackground(p.colors.background)
    setChatExpanded(true)

    setMessages([])
    setAnswers([])
    setCurrentStep(0)
    setError(null)
    setChatPhase('conversation')

    let delay = 0
    for (let i = 0; i < CHAT_QUESTIONS.length; i++) {
      const qDelay = delay
      const aDelay = delay + 150
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: CHAT_QUESTIONS[i].question }])
      }, qDelay)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'user', text: p.answers[i] }])
      }, aDelay)
      delay += 300
    }

    setTimeout(() => {
      setAnswers(p.answers)
      setCurrentStep(CHAT_QUESTIONS.length)
      setIsTyping(true)
    }, delay)

    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, { role: 'ai', text: 'Got it. Building your experience now.' }])
      setChatPhase('generating')
      generate(p.answers)
    }, delay + 600)
  }, [generate])

  /* ── START OVER ── */
  const startOver = useCallback(() => {
    setMessages([])
    setAnswers([])
    setCurrentStep(0)
    setInputValue('')
    setBriefInput('')
    setIsTyping(false)
    setError(null)
    setChatPhase('conversation')
    setChatExpanded(false)
    setDecisions([])
    setVisibleDecisions(0)
  }, [])

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
    a.href = url; a.download = `${(answers[0] || briefInput || 'site').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.html`
    a.click(); URL.revokeObjectURL(url)
  }
  const onIframeLoad = useCallback(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) { doc.open(); doc.write(html); doc.close() }
    }
  }, [html])

  const showInput = chatPhase === 'conversation' || chatPhase === 'feedback'

  return (
    <>
      <style>{dashboardCSS}</style>

      <div className="db">
        {/* ── MOBILE NAV ── */}
        <nav className="db-mobile-nav">
          <button className={mobilePanel === 'form' ? 'active' : ''} onClick={() => setMobilePanel('form')}>Edit</button>
          <button className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Preview</button>
          <button className={mobilePanel === 'log' ? 'active' : ''} onClick={() => setMobilePanel('log')}>Decisions</button>
        </nav>

        {/* ══════════════ LEFT PANEL ══════════════ */}
        <aside className={`db-panel db-form ${mobilePanel === 'form' ? 'db-panel--active' : ''}`}>
          <div className="db-form-inner">
            <h1 className="db-logo">Irie<span>Builder</span></h1>
            <p className="db-sub">Your vision. AI brings it alive.</p>

            {/* ── PRESETS ── */}
            <div className="db-presets">
              <p className="db-presets-label">{'\u2728'} Try a preset:</p>
              <div className="db-presets-row">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" className="db-preset-pill"
                    onClick={() => applyPreset(p)}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* ── JUST BUILD IT (UPGRADE 1) ── */}
            <div className="jbi">
              <input
                ref={briefInputRef}
                type="text"
                className="jbi-input"
                value={briefInput}
                onChange={e => setBriefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleJustBuildIt() }}
                placeholder="Describe your vision. One sentence is enough."
              />
              <button
                type="button"
                className="jbi-btn"
                onClick={handleJustBuildIt}
                disabled={!briefInput.trim() || loading}
              >
                Build It {'\u2192'}
              </button>
            </div>

            {/* ── Conversation toggle ── */}
            <button
              type="button"
              className="chat-toggle"
              onClick={() => {
                setChatExpanded(!chatExpanded)
                if (!chatExpanded && messages.length === 0) {
                  setTimeout(() => {
                    setMessages([{ role: 'ai', text: CHAT_QUESTIONS[0].question }])
                  }, 300)
                }
              }}
            >
              <span className="chat-toggle-line" />
              <span className="chat-toggle-text">
                {chatExpanded ? 'collapse conversation' : 'or have a conversation \u2192'}
              </span>
              <span className="chat-toggle-line" />
            </button>

            {/* ── AI CHAT INTERFACE ── */}
            {chatExpanded && (
              <div className="chat">
                {/* Progress dots */}
                <div className="chat-progress">
                  {CHAT_QUESTIONS.map((_, i) => (
                    <div key={i} className={`chat-dot ${i < answers.length ? 'chat-dot--filled' : ''}`} />
                  ))}
                  {(currentStep > 0 || messages.length > 0) && (
                    <button type="button" className="chat-restart" onClick={startOver}>
                      Start over
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="chat-messages">
                  {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble chat-bubble--${msg.role}`}>
                      {msg.text}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="chat-typing">
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                      <span className="chat-typing-dot" />
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input row */}
                {showInput && !isTyping && (
                  <div className="chat-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      className="chat-input"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                      placeholder={
                        chatPhase === 'feedback'
                          ? 'Tell me what to change\u2026'
                          : currentStep < CHAT_QUESTIONS.length
                            ? CHAT_QUESTIONS[currentStep].placeholder || 'Type your answer\u2026'
                            : ''
                      }
                    />
                    <button type="button" className="chat-send" onClick={handleSend} aria-label="Send">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── DIVIDER ── */}
            <div className="db-divider" />

            {/* ── YOUR VIBE ── */}
            <p className="db-group-header">Your Vibe</p>

            <label className="db-label" htmlFor="vibe">Vibe (optional extra detail)</label>
            <textarea id="vibe" className="db-textarea db-textarea-sm" rows={2}
              placeholder="Add more vibe detail here \u2014 merges with what you told the AI above"
              value={vibeText} onChange={e => setVibeText(e.target.value)} />

            <fieldset className="db-fieldset">
              <legend className="db-label">Mood</legend>
              <div className="db-pills" role="radiogroup" aria-label="Mood selection">
                {(['light', 'dark', 'warm'] as MoodOption[]).map(m => (
                  <Pill key={m} value={m} label={m.toUpperCase()} selected={mood} onSelect={setMood} />
                ))}
              </div>
            </fieldset>

            <fieldset className="db-fieldset">
              <legend className="db-label">Page Type</legend>
              <div className="db-pills" role="radiogroup" aria-label="Page type selection">
                {(['landing', 'store', 'portfolio', 'event'] as PageOption[]).map(p => (
                  <Pill key={p} value={p} label={p.toUpperCase()} selected={pageType} onSelect={setPageType} />
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

            {genCount > 0 && <p className="db-gen-count">Generation #{genCount}</p>}
            {error && <p className="db-error">{error}</p>}
          </div>
        </aside>

        {/* ══════════════ CENTER PANEL ══════════════ */}
        <main className={`db-panel db-preview ${mobilePanel === 'preview' ? 'db-panel--active' : ''}`}>
          {!html && !loading && (
            <div className="db-placeholder">
              <p className="db-placeholder-title">Describe your brand.</p>
              <p className="db-placeholder-title">Watch it come alive.</p>
              <p className="db-placeholder-sub">Every scroll, every motion, every detail \u2014 built around your vibe.</p>
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
                <button onClick={openFullScreen} className="db-action-btn">View Full Screen</button>
                <button onClick={downloadHtml} className="db-action-btn">Download HTML</button>
                <button onClick={() => { setHtml(null); setMetadata(null); setDecisions([]); setMobilePanel('form') }} className="db-action-btn">Regenerate</button>
                <button onClick={() => setMobilePanel('form')} className="db-action-btn db-back-btn">Back to Edit</button>
              </div>
              <iframe ref={iframeRef} title="Generated site preview"
                className="db-iframe" sandbox="allow-scripts allow-same-origin"
                onLoad={onIframeLoad} />
            </>
          )}
        </main>

        {/* ══════════════ RIGHT PANEL — CREATIVE DECISIONS ══════════════ */}
        <aside className={`db-panel db-log ${mobilePanel === 'log' ? 'db-panel--active' : ''}`}>
          <h2 className="db-log-title">Creative Decisions</h2>

          {errorLog.length > 0 && (
            <div className="db-log-errors">
              {errorLog.map((e, i) => (
                <div key={i} className="db-log-error">
                  <span className="db-log-error-time">{e.time}</span>
                  <span className="db-log-error-msg">{e.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Real decisions from API */}
          {decisions.length > 0 && decisions.map((d, i) => (
            <div key={i} className={`db-log-item db-log-item--stagger ${i < visibleDecisions ? 'db-log-item--visible' : ''}`}
              style={{ transitionDelay: `${i * 400}ms` }}>
              <span className="db-log-icon">{'\u2726'}</span>
              <div>
                <span className="db-log-label">{d.label}</span>
                <span className="db-log-value">{d.value}</span>
                {d.reason && <span className="db-log-reason">{d.reason}</span>}
              </div>
            </div>
          ))}

          {/* Placeholder decisions during loading / idle */}
          {decisions.length === 0 && (
            <div className="db-log-placeholders">
              {PLACEHOLDER_DECISIONS.map((text, i) => (
                <div key={i} className={`db-log-ph ${loading && i < visibleDecisions ? 'db-log-ph--lit' : ''}`}>
                  <span className="db-log-ph-icon">{'\u2726'}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */

const dashboardCSS = `
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  :root{
    --black:#080808;--surface:#0f0f0f;--border:rgba(201,168,76,0.18);
    --gold:#C9A84C;--gold-dim:rgba(201,168,76,0.12);
    --text:#F2EDE4;--muted:rgba(242,237,228,0.45);--radius:6px;
    --chat-bg:#0D0D0D;--chat-user-bg:#1A1A1A;
  }
  body{font-family:'Syne',system-ui,sans-serif;background:var(--black);color:var(--text);overflow:hidden;height:100dvh}

  /* ── LAYOUT ── */
  .db{display:grid;grid-template-columns:380px 1fr 280px;height:100dvh}
  .db-panel{overflow-y:auto;height:100%}

  /* ── MOBILE NAV ── */
  .db-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:50;background:var(--surface);border-top:1px solid var(--border)}
  .db-mobile-nav button{flex:1;padding:14px 0;background:none;border:none;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;min-height:48px}
  .db-mobile-nav button.active{color:var(--gold);border-top:2px solid var(--gold)}

  /* ── LEFT PANEL ── */
  .db-form{background:var(--surface);border-right:1px solid var(--border);padding:24px 24px 32px}
  .db-form-inner{display:flex;flex-direction:column}

  .db-logo{font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;letter-spacing:0.01em;margin-bottom:2px}
  .db-logo span{font-style:italic;font-weight:400;color:var(--gold)}
  .db-sub{font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5}

  /* presets */
  .db-presets{margin-bottom:16px}
  .db-presets-label{font-size:12px;color:var(--gold);margin-bottom:8px;letter-spacing:0.02em}
  .db-presets-row{display:flex;gap:6px;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .db-preset-pill{padding:7px 14px;border:1px solid var(--gold);border-radius:100px;background:transparent;color:var(--gold);font-family:'Syne',system-ui,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.03em;cursor:pointer;transition:all 0.2s;white-space:nowrap;min-height:44px;display:flex;align-items:center}
  .db-preset-pill:hover{background:var(--gold-dim);color:var(--text)}

  /* ── JUST BUILD IT (UPGRADE 1) ── */
  .jbi{display:flex;flex-direction:column;gap:8px;margin-bottom:4px}
  .jbi-input{width:100%;height:56px;background:#0D0D0D;border:1px solid rgba(201,168,76,0.3);border-radius:var(--radius);padding:0 16px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;transition:border-color 0.3s,box-shadow 0.3s}
  .jbi-input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 12px rgba(201,168,76,0.15)}
  .jbi-input::placeholder{color:var(--gold);opacity:0.5;transition:opacity 0.3s}
  .jbi-input:focus::placeholder{opacity:0}
  .jbi-btn{width:100%;height:52px;background:var(--gold);color:#0A0A0A;border:none;border-radius:var(--radius);font-family:'Syne',system-ui,sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:filter 0.2s,transform 0.2s;min-height:44px}
  .jbi-btn:hover:not(:disabled){filter:brightness(1.1);transform:scale(1.01)}
  .jbi-btn:disabled{opacity:0.5;cursor:not-allowed}

  /* ── Chat toggle ── */
  .chat-toggle{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;cursor:pointer;padding:12px 0 8px;margin-bottom:4px}
  .chat-toggle-line{flex:1;height:1px;background:var(--border)}
  .chat-toggle-text{font-family:'Syne',system-ui,sans-serif;font-size:11px;color:var(--muted);letter-spacing:0.03em;white-space:nowrap;transition:color 0.2s;min-height:44px;display:flex;align-items:center}
  .chat-toggle:hover .chat-toggle-text{color:var(--gold)}

  /* ── CHAT INTERFACE ── */
  .chat{background:var(--chat-bg);border-radius:12px;display:flex;flex-direction:column;max-height:380px;position:relative;overflow-x:hidden;width:100%;animation:chatFadeIn 0.3s ease-out}

  .chat-progress{display:flex;align-items:center;gap:6px;padding:12px 16px 0;flex-shrink:0}
  .chat-dot{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--gold);opacity:0.35;transition:all 0.3s}
  .chat-dot--filled{background:var(--gold);opacity:1;border-color:var(--gold)}
  .chat-restart{margin-left:auto;background:none;border:none;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:11px;cursor:pointer;letter-spacing:0.02em;transition:color 0.2s;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center}
  .chat-restart:hover{color:var(--gold)}

  .chat-messages{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:120px}
  .chat-messages::-webkit-scrollbar{width:3px}
  .chat-messages::-webkit-scrollbar-track{background:transparent}
  .chat-messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

  .chat-bubble{max-width:88%;line-height:1.5;animation:chatFadeIn 0.3s ease-out;word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap;box-sizing:border-box}
  .chat-bubble--ai{align-self:flex-start;color:var(--gold);font-family:'Syne',system-ui,sans-serif;font-size:14px;padding:0}
  .chat-bubble--user{align-self:flex-end;background:var(--chat-user-bg);color:var(--text);font-size:13px;padding:8px 14px;border-radius:12px 12px 4px 12px}
  @keyframes chatFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

  .chat-typing{display:flex;gap:4px;padding:4px 0;align-self:flex-start}
  .chat-typing-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);opacity:0.4;animation:typingBounce 1.2s ease-in-out infinite}
  .chat-typing-dot:nth-child(2){animation-delay:0.15s}
  .chat-typing-dot:nth-child(3){animation-delay:0.3s}
  @keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-4px);opacity:1}}

  .chat-input-row{display:flex;gap:8px;padding:8px 12px 12px;border-top:1px solid rgba(201,168,76,0.1);flex-shrink:0}
  .chat-input{flex:1;background:var(--chat-user-bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;line-height:1.4;transition:border-color 0.2s;min-width:0;box-sizing:border-box;word-break:break-word;overflow-wrap:break-word}
  .chat-input:focus{outline:none;border-color:var(--gold)}
  .chat-input::placeholder{color:var(--muted);font-size:12px}
  .chat-send{width:44px;height:44px;border-radius:8px;background:var(--gold);border:none;color:var(--black);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:box-shadow 0.2s}
  .chat-send:hover{box-shadow:0 0 16px rgba(201,168,76,0.3)}

  /* group headers */
  .db-group-header{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.14em;color:var(--gold);margin-top:4px;margin-bottom:12px}
  .db-divider{height:1px;background:var(--border);margin:16px 0 12px}

  /* labels & inputs */
  .db-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-top:12px;margin-bottom:5px}
  .db-input,.db-textarea{width:100%;background:var(--black);border:1px solid var(--border);border-radius:var(--radius);padding:11px 13px;color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:16px;line-height:1.5;transition:border-color 0.2s}
  .db-input:focus,.db-textarea:focus{outline:none;border-color:var(--gold)}
  .db-textarea{resize:vertical;min-height:72px}
  .db-textarea-sm{min-height:56px}

  .db-fieldset{border:none;padding:0;margin:0}

  .db-pills{display:flex;gap:6px;flex-wrap:wrap}
  .pill{padding:8px 16px;border:1px solid var(--border);border-radius:100px;background:transparent;color:var(--muted);font-family:'Syne',system-ui,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;cursor:pointer;transition:all 0.2s;min-height:44px;display:flex;align-items:center}
  .pill:hover{border-color:var(--gold);color:var(--text)}
  .pill--active{background:var(--gold-dim);border-color:var(--gold);color:var(--gold)}

  .db-colors{display:flex;gap:12px}
  .db-color-item{display:flex;align-items:center;gap:8px}
  .db-color-item input[type="color"]{width:36px;height:36px;border:1px solid var(--border);border-radius:var(--radius);padding:2px;background:var(--black);cursor:pointer}
  .db-color-item span{font-size:11px;color:var(--muted);line-height:1.4}
  .db-color-item code{font-size:10px;color:var(--text);font-family:'Syne',monospace}

  .db-gen-count{text-align:center;font-size:11px;color:var(--muted);margin-top:16px}
  .db-error{text-align:center;font-size:12px;color:#e55;margin-top:8px}

  /* ── CENTER: PREVIEW ── */
  .db-preview{background:var(--black);position:relative;display:flex;flex-direction:column}
  .db-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;gap:4px}
  .db-placeholder-title{font-family:'Playfair Display',Georgia,serif;font-size:clamp(26px,3.5vw,44px);font-style:italic;color:var(--text);line-height:1.15}
  .db-placeholder-sub{font-size:13px;color:var(--gold);letter-spacing:0.04em;margin-top:12px;max-width:380px;line-height:1.5;opacity:0.7}

  .db-loading{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
  .db-loading-pulse{width:48px;height:48px;border-radius:50%;background:var(--gold);animation:pulse 1.8s ease-in-out infinite}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.2);opacity:1}}
  .db-loading-msg{font-size:14px;color:var(--gold);letter-spacing:0.04em;animation:fadeCycle 2.5s ease-in-out infinite}
  @keyframes fadeCycle{0%,100%{opacity:0.5}50%{opacity:1}}

  .db-preview-actions{display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;flex-wrap:wrap}
  .db-action-btn{padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:'Syne',system-ui,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;transition:border-color 0.2s,color 0.2s;min-height:44px}
  .db-action-btn:hover{border-color:var(--gold);color:var(--gold)}
  .db-back-btn{display:none}
  .db-iframe{flex:1;width:100%;border:none;background:white}

  /* ── RIGHT: CREATIVE DECISIONS ── */
  .db-log{background:var(--surface);border-left:1px solid var(--border);padding:28px 20px}
  .db-log-title{font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;margin-bottom:20px}

  .db-log-errors{margin-bottom:16px}
  .db-log-error{display:flex;flex-direction:column;gap:2px;padding:10px 12px;margin-bottom:8px;background:rgba(220,60,60,0.08);border:1px solid rgba(220,60,60,0.2);border-radius:var(--radius)}
  .db-log-error-time{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums}
  .db-log-error-msg{font-size:12px;color:#e88;line-height:1.5;word-break:break-word}

  .db-log-item{display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)}
  .db-log-item--stagger{opacity:0;transform:translateY(8px);transition:opacity 0.4s ease-out,transform 0.4s ease-out}
  .db-log-item--visible{opacity:1;transform:translateY(0)}
  .db-log-icon{color:var(--gold);font-size:14px;flex-shrink:0;margin-top:2px}
  .db-log-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);margin-bottom:2px;font-weight:500}
  .db-log-value{display:block;font-size:13px;color:var(--text);line-height:1.5}
  .db-log-reason{display:block;font-size:11px;color:var(--muted);line-height:1.4;font-style:italic;margin-top:3px}

  /* placeholder decisions */
  .db-log-placeholders{display:flex;flex-direction:column;gap:12px}
  .db-log-ph{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);opacity:0.35;transition:opacity 0.6s,color 0.6s}
  .db-log-ph--lit{opacity:1;color:var(--gold)}
  .db-log-ph-icon{font-size:14px;color:var(--gold);opacity:0.4;transition:opacity 0.6s}
  .db-log-ph--lit .db-log-ph-icon{opacity:1}

  /* ── GRAIN ── */
  .db::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:100;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:256px 256px}

  /* ── RESPONSIVE ── */
  @media(max-width:1024px){.db{grid-template-columns:340px 1fr 0}.db-log{display:none}}
  @media(max-width:768px){
    .db{display:flex;flex-direction:column;position:relative}
    .db-mobile-nav{display:flex}
    .db-panel{position:absolute;inset:0;bottom:52px;display:none}
    .db-panel--active{display:flex;flex-direction:column}
    .db-form{padding-bottom:80px;border-right:none}
    .db-back-btn{display:inline-flex}
    .db-log{display:none;border-left:none;border-top:1px solid var(--border)}
    .db-log.db-panel--active{display:flex;flex-direction:column}
    .db-presets-row{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}
    .chat{max-height:300px}
    .jbi-input,.jbi-btn{width:100%}
  }

  @media(prefers-reduced-motion:reduce){
    .db-loading-pulse{animation:none;opacity:0.8}
    .db-loading-msg{animation:none;opacity:1}
    .chat-bubble{animation:none}
    .chat-typing-dot{animation:none;opacity:0.6}
    .db-log-item--stagger{opacity:1;transform:none;transition:none}
  }

  .db-panel::-webkit-scrollbar{width:4px}
  .db-panel::-webkit-scrollbar-track{background:transparent}
  .db-panel::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
`
