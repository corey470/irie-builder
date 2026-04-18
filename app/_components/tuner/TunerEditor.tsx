'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Dial, Preset, SectionType, TunerState } from '@/lib/tuner/types'
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
  TUNER_BAKED_STYLE_ID,
  TUNER_RUNTIME_STYLE_ID,
  bakeTunerState,
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
import { TunerLeftRail } from './TunerLeftRail'
import { TunerPreviewFrame } from './TunerPreviewFrame'
import { TunerPanel } from './TunerPanel'
import { TunerMobileDrawer } from './TunerMobileDrawer'
import './tuner.css'

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const supabaseRef = useRef(createClient())
  const ctxRef = useRef<EditorContext | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatus = usePersistenceStatus()
  const pendingDialBefore = useRef<Map<string, number | string>>(new Map())

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
      } catch {
        /* localStorage quota — ignore, sync will retry next keystroke */
      }
      setSnapshot(nextSnapshot)
    },
    [sections],
  )

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

  // Keep a ref to the latest tunerState for async callbacks.
  const tunerStateRef = useRef<TunerState>(tunerState)
  useEffect(() => {
    tunerStateRef.current = tunerState
  }, [tunerState])

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
      const next = { ...tunerStateRef.current }
      const forSection = { ...(next[activeSection.sectionId] || {}) }
      forSection[dial.id] = value
      next[activeSection.sectionId] = forSection
      persistSoon(next)
      void logDialEdit(activeSection, dial, before, value)
    },
    [activeSection, logDialEdit, persistSoon],
  )

  const handlePreset = useCallback(
    (preset: Preset) => {
      if (!activeSection || !activeGroup) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
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
      persistSoon(nextState)
      void logPresetEdit(activeSection, preset)
    },
    [activeGroup, activeSection, logPresetEdit, persistSoon],
  )

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

  const rootClass = `tuner-root${drawerOpen ? ' is-drawer-open' : ''}`

  return (
    <div className={rootClass}>
      <TunerTopBar
        saveStatus={saveStatus}
        crumbCurrent={activeSection?.label}
        viewport={viewport}
        onChangeViewport={setViewport}
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
        onPreset={handlePreset}
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
    </div>
  )
}
