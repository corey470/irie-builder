'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Dial, Preset, TunerState } from '@/lib/tuner/types'
import type { ClassifiedSection } from '@/lib/tuner/types'
import { getDialGroupForSection } from '@/lib/tuner/dial-architect'
import {
  classifySections,
  findSectionNode,
  warnIfUnknown,
} from '@/lib/tuner/classify-sections'
import {
  applyDial,
  applyPreset,
  effectiveValue,
  replayTunerState,
} from '@/lib/tuner/apply-dial'
import {
  TUNER_CHROME_STYLE_ID,
  TUNER_RUNTIME_STYLE_ID,
  bakeTunerState,
  tunerChromeCss,
  tunerRuntimeCss,
} from '@/lib/tuner/bake-html'
import { createClient } from '@/lib/supabase/client'
import {
  getCurrentEditorContext,
  logEdits,
  type EditorContext,
} from '@/lib/persistence/edit-log'
import { LAST_GENERATION_KEY, STORAGE_EVENT } from '@/lib/persistence/keys'
import { usePersistenceStatus } from '@/lib/persistence/status'
import { TunerTopBar } from './TunerTopBar'
import { TunerLeftRail, type SectionMeta } from './TunerLeftRail'
import { TunerPreviewFrame } from './TunerPreviewFrame'
import { TunerPanel } from './TunerPanel'
import { TunerMobileDrawer } from './TunerMobileDrawer'
import { TunerPalette, type PaletteAction } from './TunerPalette'
import { TunerToasts, type Toast } from './TunerToasts'
import { TunerSaveBar } from './TunerSaveBar'
import './tuner.css'

const HISTORY_LIMIT = 80
const isMacLike =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const cmdKey = isMacLike ? '⌘' : 'Ctrl+'

interface GenerationSnapshot {
  html?: string
  createdAt?: string
  [key: string]: unknown
}

function readSnapshot(): GenerationSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_GENERATION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GenerationSnapshot
  } catch {
    return null
  }
}

/**
 * Client-side section annotation: inject data-irie-section-id on every
 * header/main/section/article/footer/nav so the classifier + dial application
 * both key off the same ids that existing /edit tooling uses. We also install
 * the runtime <style> block once per iframe load so custom properties wire up.
 */
function annotateIframeDocument(doc: Document): void {
  const counters = new Map<string, number>()
  const candidates = Array.from(
    doc.querySelectorAll('header, main, section, article, footer, nav'),
  )
  candidates.forEach((node) => {
    if (node.hasAttribute('data-irie-section-id')) return
    const tag = node.tagName.toLowerCase()
    const next = (counters.get(tag) || 0) + 1
    counters.set(tag, next)
    node.setAttribute('data-irie-section-id', `${tag}-${next}`)
  })

  // If the HTML already carries a runtime/baked block from a prior save, keep
  // it — baked properties survive refresh. Only inject runtime CSS when missing.
  if (!doc.getElementById(TUNER_RUNTIME_STYLE_ID)) {
    const style = doc.createElement('style')
    style.id = TUNER_RUNTIME_STYLE_ID
    style.textContent = tunerRuntimeCss()
    doc.head.appendChild(style)
  }
  // Always (re)install chrome-only ring CSS — we strip it before export, so
  // the iframe needs it freshly each load.
  doc.getElementById(TUNER_CHROME_STYLE_ID)?.remove()
  const chromeStyle = doc.createElement('style')
  chromeStyle.id = TUNER_CHROME_STYLE_ID
  chromeStyle.textContent = tunerChromeCss()
  doc.head.appendChild(chromeStyle)
}

function relTimeLabel(ms: number | null): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function readTunerStateFromSnapshot(snapshot: GenerationSnapshot | null): TunerState {
  const raw = snapshot?.tunerState
  if (!raw || typeof raw !== 'object') return {}
  return raw as TunerState
}

function emitStorageChange(key: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }))
}

export function TunerEditor() {
  const [snapshot, setSnapshot] = useState<GenerationSnapshot | null>(readSnapshot)
  const [sections, setSections] = useState<ClassifiedSection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tunerState, setTunerState] = useState<TunerState>(
    readTunerStateFromSnapshot(readSnapshot()),
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [savedAtTick, setSavedAtTick] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sectionMeta, setSectionMeta] = useState<Record<string, SectionMeta>>({})
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const supabaseRef = useRef(createClient())
  const ctxRef = useRef<EditorContext | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatus = usePersistenceStatus()
  const pendingDialBefore = useRef<Map<string, number | string>>(new Map())
  const toastIdRef = useRef(0)
  const undoStackRef = useRef<TunerState[]>([])
  const redoStackRef = useRef<TunerState[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const lastPersistedRef = useRef<TunerState | null>(null)

  /** Load the editor context once for edit-log writes. Silently opts out if
   * unauthenticated (same contract as brief/generate). */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ctx = await getCurrentEditorContext(supabaseRef.current)
      if (!cancelled) ctxRef.current = ctx
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Initial HTML to render in iframe. We pull from localStorage and keep it
   * static — custom-property mutations never re-render this iframe. */
  const initialHtml = useMemo(() => snapshot?.html ?? '', [snapshot])

  /** Called on iframe load — annotate sections, install runtime CSS, classify,
   * replay saved TunerState, and auto-select the first section. */
  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    annotateIframeDocument(doc)
    const classified = classifySections(doc)
    warnIfUnknown(classified)
    setSections(classified)
    if (classified.length > 0) {
      setActiveId((prev) => prev ?? classified[0].sectionId)
    }
    // Replay baked state onto live DOM (also survives in style block, but
    // this makes subsequent mutations consistent with state map).
    replayTunerState(
      doc,
      (sectionId) => {
        const match = classified.find((s) => s.sectionId === sectionId)
        if (!match) return null
        return getDialGroupForSection(match.sectionType)
      },
      tunerState,
    )
  }, [tunerState])

  const activeSection = useMemo(
    () => sections.find((s) => s.sectionId === activeId) ?? null,
    [sections, activeId],
  )
  const activeGroup = useMemo(() => {
    if (!activeSection) return null
    return getDialGroupForSection(activeSection.sectionType)
  }, [activeSection])

  const activeValues = useMemo<Record<string, number | string>>(() => {
    if (!activeSection || !activeGroup) return {}
    const saved = tunerState[activeSection.sectionId] || {}
    const out: Record<string, number | string> = {}
    ;[...activeGroup.core, ...activeGroup.contextual].forEach((dial) => {
      out[dial.id] = effectiveValue(dial, saved)
    })
    return out
  }, [activeGroup, activeSection, tunerState])

  // Refs/helpers used by both persist + commit paths must be declared first.
  // Keep a ref to the latest tunerState for async callbacks.
  const tunerStateRef = useRef<TunerState>(tunerState)
  useEffect(() => {
    tunerStateRef.current = tunerState
  }, [tunerState])

  // Toasts:
  const addToast = useCallback((message: string, shortcut?: string, ttl?: number) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev.slice(-3), { id, message, shortcut, ttl }])
  }, [])
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /** Persist current TunerState into localStorage + Supabase. Writes both the
   * snapshot metadata (tunerState map) AND a baked final_html so refresh
   * restores with no JS. Debounced 600ms. */
  const persistSoon = useCallback((nextState: TunerState) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistNow(nextState)
    }, 600)
  }, [])

  const persistNow = useCallback(
    async (nextState: TunerState) => {
      if (typeof window === 'undefined') return
      const snap = readSnapshot()
      if (!snap?.html) return
      // Build a getDials map keyed by sectionId (snapshot of current classification)
      const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
      const getDials = (sid: string) => {
        const match = byId.get(sid)
        return match ? getDialGroupForSection(match.sectionType) : null
      }
      const bakedHtml = bakeTunerState(snap.html, nextState, getDials)
      const nextSnapshot: GenerationSnapshot = {
        ...snap,
        html: bakedHtml,
        tunerState: nextState,
      }
      try {
        window.localStorage.setItem(
          LAST_GENERATION_KEY,
          JSON.stringify(nextSnapshot),
        )
        emitStorageChange(LAST_GENERATION_KEY)
        setSavedAt(Date.now())
        setSaveError(null)
        lastPersistedRef.current = nextState
      } catch (err) {
        setSaveError('Local storage full or unavailable')
        // eslint-disable-next-line no-console
        console.error('[tuner] persist failed', err)
      }
      setSnapshot(nextSnapshot)
    },
    [sections],
  )

  const handleSaveNow = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void persistNow(tunerStateRef.current)
    addToast('Saved')
  }, [persistNow, addToast])

  const handleRetrySave = useCallback(() => {
    setSaveError(null)
    void persistNow(tunerStateRef.current)
  }, [persistNow])

  const logDialEdit = useCallback(
    async (
      section: ClassifiedSection,
      dial: Dial,
      before: number | string | null,
      after: number | string,
    ) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const snap = readSnapshot()
      if (!snap?.html) return
      const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
      const getDials = (sid: string) => {
        const match = byId.get(sid)
        return match ? getDialGroupForSection(match.sectionType) : null
      }
      const bakedHtml = bakeTunerState(snap.html, tunerStateRef.current, getDials)
      await logEdits(
        supabaseRef.current,
        ctx,
        [
          {
            kind: 'tuner',
            section_id: section.sectionId,
            section_type: section.sectionType,
            dial_id: dial.id,
            before,
            after,
          },
        ],
        bakedHtml,
      )
    },
    [sections],
  )

  const logPresetEdit = useCallback(
    async (section: ClassifiedSection, preset: Preset) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const snap = readSnapshot()
      if (!snap?.html) return
      const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
      const getDials = (sid: string) => {
        const match = byId.get(sid)
        return match ? getDialGroupForSection(match.sectionType) : null
      }
      const bakedHtml = bakeTunerState(snap.html, tunerStateRef.current, getDials)
      await logEdits(
        supabaseRef.current,
        ctx,
        [
          {
            kind: 'tuner-preset',
            section_id: section.sectionId,
            section_type: section.sectionType,
            preset_id: preset.id,
            values: preset.values,
          },
        ],
        bakedHtml,
      )
    },
    [sections],
  )

  // ───── History (undo/redo) ────────────────────────────────────────────
  /**
   * Push the *previous* state onto the undo stack, clear redo.
   * Must be called BEFORE applying a new state — captures the state to
   * walk back to.
   */
  const pushHistory = useCallback((prev: TunerState) => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(prev)))
    if (undoStackRef.current.length > HISTORY_LIMIT) {
      undoStackRef.current.shift()
    }
    redoStackRef.current = []
    setHistoryVersion((v) => v + 1)
  }, [])

  /** Replay a state snapshot onto the iframe DOM (no React iframe re-render). */
  const replayInto = useCallback(
    (state: TunerState, flashSectionId?: string) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      // First clear any inline styles on every section so removed dials revert
      sections.forEach((s) => {
        const node = findSectionNode(doc, s.sectionId)
        if (!node) return
        const group = getDialGroupForSection(s.sectionType)
        ;[...group.core, ...group.contextual].forEach((dial) => {
          node.style.removeProperty(dial.cssVar)
        })
      })
      replayTunerState(
        doc,
        (sid) => {
          const m = sections.find((s) => s.sectionId === sid)
          return m ? getDialGroupForSection(m.sectionType) : null
        },
        state,
      )
      if (flashSectionId) {
        const node = findSectionNode(doc, flashSectionId)
        if (node) {
          node.setAttribute('data-irie-tuner-flash', '')
          window.setTimeout(() => node.removeAttribute('data-irie-tuner-flash'), 700)
        }
      }
    },
    [sections],
  )

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    redoStackRef.current.push(JSON.parse(JSON.stringify(tunerStateRef.current)))
    if (redoStackRef.current.length > HISTORY_LIMIT) redoStackRef.current.shift()
    setTunerState(prev)
    tunerStateRef.current = prev
    // Find a changed section to flash
    const flashId = activeId ?? Object.keys(prev)[0]
    replayInto(prev, flashId)
    persistSoon(prev)
    setHistoryVersion((v) => v + 1)
    addToast('Undo', `${cmdKey}⇧Z to redo`)
  }, [activeId, persistSoon, replayInto, addToast])

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(JSON.parse(JSON.stringify(tunerStateRef.current)))
    if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift()
    setTunerState(next)
    tunerStateRef.current = next
    const flashId = activeId ?? Object.keys(next)[0]
    replayInto(next, flashId)
    persistSoon(next)
    setHistoryVersion((v) => v + 1)
  }, [activeId, persistSoon, replayInto])

  // ───── Selection rings inside iframe ──────────────────────────────────
  const hoveredIdRef = useRef<string | null>(null)
  const setActiveRing = useCallback((sectionId: string | null) => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('[data-irie-tuner-active]').forEach((n) =>
      n.removeAttribute('data-irie-tuner-active'),
    )
    if (sectionId) {
      const node = findSectionNode(doc, sectionId)
      node?.setAttribute('data-irie-tuner-active', '')
    }
  }, [])

  // Sync active ring whenever activeId changes
  useEffect(() => {
    setActiveRing(activeId)
  }, [activeId, setActiveRing])

  // Hover ring tracking — bind once iframe mounts
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    function onOver(e: Event) {
      const target = e.target as HTMLElement | null
      const sectionEl = target?.closest('[data-irie-section-id]') as HTMLElement | null
      const sid = sectionEl?.getAttribute('data-irie-section-id') || null
      if (sid === hoveredIdRef.current) return
      if (hoveredIdRef.current) {
        const prev = doc!.querySelector(
          `[data-irie-section-id="${CSS.escape(hoveredIdRef.current)}"]`,
        )
        prev?.removeAttribute('data-irie-tuner-hover')
      }
      if (sectionEl) sectionEl.setAttribute('data-irie-tuner-hover', '')
      hoveredIdRef.current = sid
    }
    function onLeave() {
      if (hoveredIdRef.current) {
        const prev = doc!.querySelector(
          `[data-irie-section-id="${CSS.escape(hoveredIdRef.current)}"]`,
        )
        prev?.removeAttribute('data-irie-tuner-hover')
        hoveredIdRef.current = null
      }
    }
    doc.addEventListener('mouseover', onOver)
    doc.addEventListener('mouseleave', onLeave)
    // Click sections to focus
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      const sectionEl = target?.closest('[data-irie-section-id]') as HTMLElement | null
      const sid = sectionEl?.getAttribute('data-irie-section-id')
      if (sid) {
        e.preventDefault()
        setActiveId(sid)
        setDrawerOpen(true)
      }
    }
    doc.addEventListener('click', onClick)
    return () => {
      doc.removeEventListener('mouseover', onOver)
      doc.removeEventListener('mouseleave', onLeave)
      doc.removeEventListener('click', onClick)
    }
  }, [sections.length])

  // Stamp data-irie-section-label on each section so ring tooltips read it
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    sections.forEach((s) => {
      const node = findSectionNode(doc, s.sectionId)
      node?.setAttribute('data-irie-section-label', s.sectionType)
    })
  }, [sections])

  // ───── Saved-at clock — refreshes label every 15s ─────────────────────
  useEffect(() => {
    if (!savedAt) return
    const i = window.setInterval(() => setSavedAtTick((t) => t + 1), 15_000)
    return () => window.clearInterval(i)
  }, [savedAt])

  // ───── Section meta (count + dirty + last edited) ─────────────────────
  // Counts: derive from iframe DOM after load.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const counts: Record<string, { texts: number; images: number }> = {}
    sections.forEach((s) => {
      const node = findSectionNode(doc, s.sectionId)
      if (!node) return
      const texts = node.querySelectorAll('h1,h2,h3,h4,p,a,button,li,span').length
      const images = node.querySelectorAll('img,picture').length
      counts[s.sectionId] = { texts, images }
    })
    setSectionMeta((prev) => {
      const next: Record<string, SectionMeta> = { ...prev }
      sections.forEach((s) => {
        next[s.sectionId] = {
          ...(next[s.sectionId] || {}),
          counts: counts[s.sectionId],
          dirty: !!tunerStateRef.current[s.sectionId] &&
            Object.keys(tunerStateRef.current[s.sectionId]).length > 0,
        }
      })
      return next
    })
  }, [sections])

  // Update dirty + lastEditedAt when state changes
  useEffect(() => {
    setSectionMeta((prev) => {
      const next: Record<string, SectionMeta> = { ...prev }
      sections.forEach((s) => {
        const dirty =
          !!tunerState[s.sectionId] &&
          Object.keys(tunerState[s.sectionId]).length > 0
        next[s.sectionId] = { ...(next[s.sectionId] || {}), dirty }
      })
      return next
    })
  }, [tunerState, sections])

  /** Live mutation path — zero React re-render of the iframe. Only the readout
   * re-renders (local to the dial). */
  const handleDialChange = useCallback(
    (dial: Dial, value: number | string) => {
      if (!activeSection) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
      applyDial(node, dial, value)
      // Track "before" the first time we see this dial in this drag so we can
      // produce a meaningful edit log on commit.
      const key = `${activeSection.sectionId}:${dial.id}`
      if (!pendingDialBefore.current.has(key)) {
        const prior = tunerState[activeSection.sectionId]?.[dial.id]
        pendingDialBefore.current.set(
          key,
          prior !== undefined ? prior : (dial.default as number | string),
        )
      }
      setTunerState((prev) => {
        const next: TunerState = { ...prev }
        const forSection = { ...(next[activeSection.sectionId] || {}) }
        forSection[dial.id] = value
        next[activeSection.sectionId] = forSection
        return next
      })
    },
    [activeSection, tunerState],
  )

  const handleDialCommit = useCallback(
    (dial: Dial, value: number | string) => {
      if (!activeSection) return
      const key = `${activeSection.sectionId}:${dial.id}`
      const before = pendingDialBefore.current.get(key) ?? null
      pendingDialBefore.current.delete(key)
      // Don't push history if value unchanged from last committed state
      const priorValue =
        tunerStateRef.current[activeSection.sectionId]?.[dial.id]
      if (priorValue === value) return
      pushHistory(tunerStateRef.current)
      const next = { ...tunerStateRef.current }
      const forSection = { ...(next[activeSection.sectionId] || {}) }
      forSection[dial.id] = value
      next[activeSection.sectionId] = forSection
      setSectionMeta((prev) => ({
        ...prev,
        [activeSection.sectionId]: {
          ...(prev[activeSection.sectionId] || {}),
          lastEditedAt: Date.now(),
        },
      }))
      persistSoon(next)
      void logDialEdit(activeSection, dial, before, value)
    },
    [activeSection, logDialEdit, persistSoon, pushHistory],
  )

  const handlePreset = useCallback(
    (preset: Preset) => {
      if (!activeSection || !activeGroup) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
      pushHistory(tunerStateRef.current)
      applyPreset(node, activeGroup, preset)
      const nextValues = {
        ...(tunerStateRef.current[activeSection.sectionId] || {}),
      }
      Object.entries(preset.values).forEach(([dialId, value]) => {
        nextValues[dialId] = value
      })
      const nextState: TunerState = {
        ...tunerStateRef.current,
        [activeSection.sectionId]: nextValues,
      }
      setTunerState(nextState)
      setSectionMeta((prev) => ({
        ...prev,
        [activeSection.sectionId]: {
          ...(prev[activeSection.sectionId] || {}),
          lastEditedAt: Date.now(),
        },
      }))
      persistSoon(nextState)
      addToast(`Applied "${preset.label}"`, `${cmdKey}Z to undo`)
      void logPresetEdit(activeSection, preset)
    },
    [activeGroup, activeSection, logPresetEdit, persistSoon, pushHistory, addToast],
  )

  const handleDialReset = useCallback(
    (dial: Dial) => {
      if (!activeSection) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
      const prior = tunerStateRef.current[activeSection.sectionId]?.[dial.id]
      if (prior === undefined) return
      pushHistory(tunerStateRef.current)
      // Remove inline + remove from state
      node.style.removeProperty(dial.cssVar)
      const next: TunerState = { ...tunerStateRef.current }
      const forSection = { ...(next[activeSection.sectionId] || {}) }
      delete forSection[dial.id]
      if (Object.keys(forSection).length === 0) {
        delete next[activeSection.sectionId]
      } else {
        next[activeSection.sectionId] = forSection
      }
      setTunerState(next)
      persistSoon(next)
      void logDialEdit(activeSection, dial, prior, dial.default as number | string)
    },
    [activeSection, logDialEdit, persistSoon, pushHistory],
  )

  const handleRevertSection = useCallback(() => {
    if (!activeSection) return
    if (!tunerStateRef.current[activeSection.sectionId]) return
    pushHistory(tunerStateRef.current)
    const next: TunerState = { ...tunerStateRef.current }
    delete next[activeSection.sectionId]
    setTunerState(next)
    replayInto(next, activeSection.sectionId)
    persistSoon(next)
    addToast(`Reverted "${activeSection.label}"`, `${cmdKey}Z to undo`)
  }, [activeSection, persistSoon, pushHistory, replayInto, addToast])

  const handleRevertAll = useCallback(() => {
    if (Object.keys(tunerStateRef.current).length === 0) return
    pushHistory(tunerStateRef.current)
    const next: TunerState = {}
    setTunerState(next)
    replayInto(next)
    persistSoon(next)
    addToast('Reverted all tuner edits', `${cmdKey}Z to undo`)
  }, [persistSoon, pushHistory, replayInto, addToast])

  const handleDownload = useCallback(() => {
    const snap = readSnapshot()
    if (!snap?.html) return
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) => {
      const match = byId.get(sid)
      return match ? getDialGroupForSection(match.sectionType) : null
    }
    const baked = bakeTunerState(snap.html, tunerStateRef.current, getDials)
    // Strip the annotation attributes only from a copy — keep the baked block.
    const parser = new DOMParser()
    const doc = parser.parseFromString(baked, 'text/html')
    doc.querySelectorAll(
      '[data-irie-edit-id], [data-irie-editable], [data-irie-image-id]',
    ).forEach((node) => {
      node.removeAttribute('data-irie-edit-id')
      node.removeAttribute('data-irie-editable')
      node.removeAttribute('data-irie-image-id')
    })
    const html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'irie-builder.html'
    a.click()
    URL.revokeObjectURL(url)
  }, [sections])

  const handleExport = useCallback(() => {
    handleDownload()
  }, [handleDownload])

  const handleCopyCode = useCallback(async () => {
    const snap = readSnapshot()
    if (!snap?.html) return
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) =>
      byId.get(sid) ? getDialGroupForSection(byId.get(sid)!.sectionType) : null
    const baked = bakeTunerState(snap.html, tunerStateRef.current, getDials)
    try {
      await navigator.clipboard.writeText(baked)
      addToast('Code copied to clipboard')
    } catch {
      addToast('Could not copy to clipboard')
    }
  }, [sections, addToast])

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      addToast('Preview link copied')
    } catch {
      addToast('Could not copy link')
    }
  }, [addToast])

  // ───── Viewport cycle ─────────────────────────────────────────────────
  const cycleViewport = useCallback(() => {
    setViewport((v) => (v === 'desktop' ? 'tablet' : v === 'tablet' ? 'mobile' : 'desktop'))
  }, [])
  const cycleZoom = useCallback(() => {
    addToast('Zoom is fixed at 100% in v1')
  }, [addToast])

  // ───── Section navigation helpers ─────────────────────────────────────
  const focusSectionByIndex = useCallback(
    (idx: number) => {
      const s = sections[idx]
      if (!s) return
      setActiveId(s.sectionId)
      setDrawerOpen(true)
    },
    [sections],
  )
  const focusNextSection = useCallback(
    (delta: number) => {
      if (sections.length === 0) return
      const idx = sections.findIndex((s) => s.sectionId === activeId)
      const nextIdx = idx < 0 ? 0 : (idx + delta + sections.length) % sections.length
      focusSectionByIndex(nextIdx)
    },
    [sections, activeId, focusSectionByIndex],
  )

  // ───── Palette actions ────────────────────────────────────────────────
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const a: PaletteAction[] = []
    sections.forEach((s, i) => {
      a.push({
        id: `jump:${s.sectionId}`,
        label: `Jump to "${s.label}"`,
        group: i < 9 ? `Section · ${i + 1}` : 'Section',
        keywords: `section ${s.sectionType} ${s.label}`,
        run: () => focusSectionByIndex(i),
      })
    })
    if (activeGroup) {
      activeGroup.presets.forEach((p) => {
        a.push({
          id: `preset:${p.id}`,
          label: `Apply preset "${p.label}"`,
          group: 'Preset',
          keywords: `preset ${p.label}`,
          run: () => handlePreset(p),
        })
      })
    }
    a.push(
      {
        id: 'undo',
        label: 'Undo',
        group: 'Edit',
        shortcut: `${cmdKey}Z`,
        keywords: 'undo revert back',
        run: handleUndo,
        disabled: undoStackRef.current.length === 0,
      },
      {
        id: 'redo',
        label: 'Redo',
        group: 'Edit',
        shortcut: `${cmdKey}⇧Z`,
        keywords: 'redo forward',
        run: handleRedo,
        disabled: redoStackRef.current.length === 0,
      },
      {
        id: 'save',
        label: 'Save now',
        group: 'Edit',
        shortcut: `${cmdKey}S`,
        run: handleSaveNow,
      },
      {
        id: 'revert-section',
        label: 'Revert this section',
        group: 'Edit',
        run: handleRevertSection,
        disabled: !activeSection || !tunerStateRef.current[activeSection?.sectionId ?? ''],
      },
      {
        id: 'revert-all',
        label: 'Revert ALL tuner edits',
        group: 'Edit',
        run: handleRevertAll,
        disabled: Object.keys(tunerStateRef.current).length === 0,
      },
      {
        id: 'view-desktop',
        label: 'View · Desktop (1440px)',
        group: 'View',
        run: () => setViewport('desktop'),
      },
      {
        id: 'view-tablet',
        label: 'View · Tablet (768px)',
        group: 'View',
        run: () => setViewport('tablet'),
      },
      {
        id: 'view-mobile',
        label: 'View · Mobile (375px)',
        group: 'View',
        run: () => setViewport('mobile'),
      },
      {
        id: 'export-html',
        label: 'Export · Download HTML',
        group: 'Export',
        run: handleDownload,
      },
      {
        id: 'export-copy',
        label: 'Export · Copy code',
        group: 'Export',
        run: handleCopyCode,
      },
      {
        id: 'share',
        label: 'Copy preview link',
        group: 'Share',
        run: handleShare,
      },
      {
        id: 'logout',
        label: 'Sign out',
        group: 'Account',
        run: () => {
          window.location.href = '/logout'
        },
      },
    )
    return a
    // historyVersion forces re-eval of disabled flags
  }, [
    sections,
    activeGroup,
    activeSection,
    handlePreset,
    handleUndo,
    handleRedo,
    handleSaveNow,
    handleRevertSection,
    handleRevertAll,
    handleDownload,
    handleCopyCode,
    handleShare,
    focusSectionByIndex,
    historyVersion,
    tunerState,
  ])

  // ───── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!t) return false
      const el = t as HTMLElement
      const tag = el.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      )
    }

    function onKey(e: KeyboardEvent) {
      const mod = isMacLike ? e.metaKey : e.ctrlKey

      // ⌘K — palette (always)
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // ⌘Z / ⌘⇧Z
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      // ⌘S
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveNow()
        return
      }

      // Skip the rest if typing
      if (isTypingTarget(e.target)) return

      // Escape — close drawer / palette
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setDrawerOpen(false)
        setActiveId(null)
        return
      }

      // 1-9 jump
      if (e.key >= '1' && e.key <= '9' && !mod && !e.shiftKey && !e.altKey) {
        const idx = Number(e.key) - 1
        if (idx < sections.length) {
          e.preventDefault()
          focusSectionByIndex(idx)
        }
        return
      }

      // [ / ] navigate sections
      if (e.key === '[') {
        e.preventDefault()
        focusNextSection(-1)
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        focusNextSection(1)
        return
      }

      // ? open shortcuts (= open palette pre-filled)
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [
    sections,
    focusSectionByIndex,
    focusNextSection,
    handleUndo,
    handleRedo,
    handleSaveNow,
  ])

  const savedAtLabel = useMemo(() => {
    // savedAtTick triggers a re-render every 15s
    void savedAtTick
    return relTimeLabel(savedAt)
  }, [savedAt, savedAtTick])

  const rootClass = `tuner-root${drawerOpen ? ' is-drawer-open' : ''}`

  return (
    <div className={rootClass}>
      <TunerSaveBar status={saveStatus?.status} />
      <TunerTopBar
        saveStatus={saveStatus}
        savedAtLabel={savedAtLabel}
        saveError={saveError}
        onRetrySave={handleRetrySave}
        crumbCurrent={activeSection?.label}
        zoomPercent={100}
        onCycleZoom={cycleZoom}
        viewport={viewport}
        onChangeViewport={setViewport}
        canUndo={undoStackRef.current.length > 0}
        canRedo={redoStackRef.current.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSaveNow}
        onOpenPalette={() => setPaletteOpen(true)}
        onShare={handleShare}
        onCopyCode={handleCopyCode}
        onDownload={handleDownload}
        onExport={handleExport}
      />
      <TunerLeftRail
        sections={sections}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id)
          setDrawerOpen(true)
        }}
        meta={sectionMeta}
      />
      <TunerPreviewFrame
        ref={iframeRef}
        html={initialHtml}
        onLoad={handleIframeLoad}
        viewport={viewport}
      />
      <TunerPanel
        section={activeSection}
        group={activeGroup}
        values={activeValues}
        onDialChange={handleDialChange}
        onDialCommit={handleDialCommit}
        onDialReset={handleDialReset}
        onPreset={handlePreset}
        onRevertSection={handleRevertSection}
        onRevertAll={handleRevertAll}
        panelKey={activeId ?? 'empty'}
      />
      {/* Mobile-only drawer bar; collapses to section picker + Tune button. */}
      <div className="tuner-mobile-only">
        <TunerMobileDrawer
          sections={sections}
          activeId={activeId}
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen((v) => !v)}
          onSelect={(id) => {
            setActiveId(id)
            setDrawerOpen(true)
          }}
        />
      </div>
      <TunerPalette
        open={paletteOpen}
        actions={paletteActions}
        onClose={() => setPaletteOpen(false)}
      />
      <TunerToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
