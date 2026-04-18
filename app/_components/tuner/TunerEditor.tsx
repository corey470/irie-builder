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
  serializeForExport,
  serializeIframe,
  tunerChromeCss,
  tunerRuntimeCss,
} from '@/lib/tuner/bake-html'
import {
  annotateObjects,
  findImageElement,
  findTextElement,
  type ImageObject,
  type ObjectInventory,
  type TextObject,
} from '@/lib/tuner/object-model'
import { classifyClickTarget } from '@/lib/tuner/selection'
import {
  createUnifiedHistory,
  type HistoryControls,
  type HistoryEntry,
} from '@/lib/tuner/unified-history'
import { createClient } from '@/lib/supabase/client'
import {
  getCurrentEditorContext,
  logEdits,
  logPublish,
  type EditorContext,
} from '@/lib/persistence/edit-log'
import { LAST_GENERATION_KEY, STORAGE_EVENT } from '@/lib/persistence/keys'
import { usePersistenceStatus } from '@/lib/persistence/status'
import { TunerTopBar } from './TunerTopBar'
import { TunerLeftRail, type SectionMeta } from './TunerLeftRail'
import { TunerPreviewFrame } from './TunerPreviewFrame'
import { TunerPanel } from './TunerPanel'
import {
  TunerTextPanel,
  FONT_FAMILY_STACKS,
  type TextStyle,
} from './TunerTextPanel'
import { TunerImagePanel, type ImageStyle } from './TunerImagePanel'
import {
  TunerSectionStylePanel,
  type SectionStyleOverrides,
} from './TunerSectionStylePanel'
import { TunerAccentPopover } from './TunerAccentPopover'
import { TunerFullscreenOverlay } from './TunerFullscreenOverlay'
import { TunerMobileDrawer } from './TunerMobileDrawer'
import { TunerPalette, type PaletteAction } from './TunerPalette'
import { TunerToasts, type Toast } from './TunerToasts'
import { TunerSaveBar } from './TunerSaveBar'
import './tuner.css'

const isMacLike =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const cmdKey = isMacLike ? '⌘' : 'Ctrl+'

const DEFAULT_ACCENT = '#C9A84C'

export type SelectionMode =
  | 'section-tune'
  | 'section-style'
  | 'text'
  | 'image'

interface GenerationSnapshot {
  html?: string
  createdAt?: string
  tunerState?: TunerState
  textContent?: Record<string, string>
  textStyles?: Record<string, TextStyle>
  imageStyles?: Record<string, ImageStyle>
  sectionStyleOverrides?: Record<string, SectionStyleOverrides>
  accent?: string
  metadata?: {
    palette?: { accent?: string; [key: string]: unknown }
    [key: string]: unknown
  }
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
 * Apply a TextStyle map to a live element. Empty string clears the property
 * (falls back to the generator's original value).
 */
export function applyTextStyle(el: HTMLElement, style: TextStyle): void {
  if (style.fontFamilyKind !== undefined) {
    el.style.fontFamily = FONT_FAMILY_STACKS[style.fontFamilyKind] ?? ''
  }
  if (style.fontWeight !== undefined) el.style.fontWeight = style.fontWeight
  if (style.fontSize !== undefined) el.style.fontSize = style.fontSize
  if (style.lineHeight !== undefined) el.style.lineHeight = style.lineHeight
  if (style.letterSpacing !== undefined) {
    el.style.letterSpacing = style.letterSpacing
  }
  if (style.color !== undefined) el.style.color = style.color
  if (style.textAlign !== undefined) el.style.textAlign = style.textAlign
  if (style.backgroundColor !== undefined) {
    el.style.backgroundColor = style.backgroundColor
  }
  if (style.borderColor !== undefined) {
    el.style.borderColor = style.borderColor
    if (style.borderColor) el.style.borderStyle = 'solid'
    if (style.borderColor && !el.style.borderWidth) el.style.borderWidth = '1px'
  }
  if (style.borderRadius !== undefined) {
    el.style.borderRadius = style.borderRadius
  }
  if (style.paddingInline !== undefined) {
    el.style.paddingInline = style.paddingInline
  }
  if (style.paddingBlock !== undefined) {
    el.style.paddingBlock = style.paddingBlock
  }
}

/**
 * Read the current inline style off an element into a TextStyle shape.
 * Used to seed "before" snapshots for the history stack.
 */
function readTextStyle(el: HTMLElement): TextStyle {
  const style = el.style
  return {
    fontFamilyKind: (() => {
      const family = style.fontFamily
      if (!family) return ''
      if (family.includes('Playfair')) return 'display'
      if (family.includes('Syne')) return 'body'
      if (family.includes('mono')) return 'mono'
      return ''
    })(),
    fontWeight: (style.fontWeight as TextStyle['fontWeight']) || '',
    fontSize: style.fontSize || '',
    lineHeight: style.lineHeight || '',
    letterSpacing: style.letterSpacing || '',
    color: style.color || '',
    textAlign: (style.textAlign as TextStyle['textAlign']) || '',
    backgroundColor: style.backgroundColor || '',
    borderColor: style.borderColor || '',
    borderRadius: style.borderRadius || '',
    paddingInline: style.paddingInline || '',
    paddingBlock: style.paddingBlock || '',
  }
}

export function applyImageStyle(el: HTMLImageElement, style: ImageStyle): void {
  if (style.alt !== undefined) el.alt = style.alt
  if (style.objectFit !== undefined) el.style.objectFit = style.objectFit
  if (style.objectPosition !== undefined) {
    el.style.objectPosition = style.objectPosition
  }
  if (style.borderRadius !== undefined) el.style.borderRadius = style.borderRadius
}

export function applySectionStyleOverrides(
  el: HTMLElement,
  style: SectionStyleOverrides,
): void {
  if (style.paddingTop !== undefined) el.style.paddingTop = style.paddingTop
  if (style.paddingBottom !== undefined) el.style.paddingBottom = style.paddingBottom
  if (style.backgroundColor !== undefined) el.style.backgroundColor = style.backgroundColor
  if (style.backgroundImage !== undefined || style.overlayOpacity !== undefined) {
    const bg = style.backgroundImage || ''
    const opacity = style.overlayOpacity
      ? Math.max(0, Math.min(1, Number.parseFloat(style.overlayOpacity)))
      : 0.25
    if (bg) {
      el.style.backgroundImage = `linear-gradient(rgba(8,8,8,${opacity}), rgba(8,8,8,${opacity})), url("${bg}")`
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center'
    } else {
      el.style.backgroundImage = ''
      el.style.backgroundSize = ''
      el.style.backgroundPosition = ''
    }
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

  // Object-mode state
  const [objects, setObjects] = useState<ObjectInventory>({ texts: [], images: [] })
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('section-tune')
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<Record<string, string>>(
    readSnapshot()?.textContent ?? {},
  )
  const [textStyles, setTextStyles] = useState<Record<string, TextStyle>>(
    readSnapshot()?.textStyles ?? {},
  )
  const [imageStyles, setImageStyles] = useState<Record<string, ImageStyle>>(
    readSnapshot()?.imageStyles ?? {},
  )
  const [sectionStyleOverrides, setSectionStyleOverrides] = useState<
    Record<string, SectionStyleOverrides>
  >(readSnapshot()?.sectionStyleOverrides ?? {})
  const [accent, setAccent] = useState<string>(
    readSnapshot()?.accent ||
      readSnapshot()?.metadata?.palette?.accent ||
      DEFAULT_ACCENT,
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  )
  const [fullscreenOpen, setFullscreenOpen] = useState(false)

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
  const [historyVersion, setHistoryVersion] = useState(0)
  const lastPersistedRef = useRef<TunerState | null>(null)

  // Unified undo/redo — reads iframe doc lazily so it survives remounts.
  const historyRef = useRef<HistoryControls | null>(null)
  if (historyRef.current === null) {
    historyRef.current = createUnifiedHistory(
      () => iframeRef.current?.contentDocument ?? null,
      80,
    )
  }
  const history = historyRef.current!

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

  /** Initial HTML to render in iframe. Pulled from localStorage. */
  const initialHtml = useMemo(() => snapshot?.html ?? '', [snapshot])

  // Refs kept in sync with the latest state for async callbacks.
  const tunerStateRef = useRef<TunerState>(tunerState)
  useEffect(() => {
    tunerStateRef.current = tunerState
  }, [tunerState])
  const textContentRef = useRef(textContent)
  useEffect(() => {
    textContentRef.current = textContent
  }, [textContent])
  const textStylesRef = useRef(textStyles)
  useEffect(() => {
    textStylesRef.current = textStyles
  }, [textStyles])
  const imageStylesRef = useRef(imageStyles)
  useEffect(() => {
    imageStylesRef.current = imageStyles
  }, [imageStyles])
  const sectionStyleOverridesRef = useRef(sectionStyleOverrides)
  useEffect(() => {
    sectionStyleOverridesRef.current = sectionStyleOverrides
  }, [sectionStyleOverrides])
  const accentRef = useRef(accent)
  useEffect(() => {
    accentRef.current = accent
  }, [accent])

  /** Called on iframe load — annotate sections + text/image, install runtime
   * CSS, classify, replay saved TunerState, replay text/style overrides, auto-
   * select first section. */
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
    // Annotate text/image objects with stable ids; this is idempotent.
    const inventory = annotateObjects(doc)
    setObjects(inventory)
    // Replay tuner state
    replayTunerState(
      doc,
      (sectionId) => {
        const match = classified.find((s) => s.sectionId === sectionId)
        if (!match) return null
        return getDialGroupForSection(match.sectionType)
      },
      tunerStateRef.current,
    )
    // Replay text content / styles / image styles / section style overrides
    Object.entries(textContentRef.current).forEach(([id, text]) => {
      const el = findTextElement(doc, id)
      if (el) el.textContent = text
    })
    Object.entries(textStylesRef.current).forEach(([id, style]) => {
      const el = findTextElement(doc, id)
      if (el) applyTextStyle(el, style)
    })
    Object.entries(imageStylesRef.current).forEach(([id, style]) => {
      const el = findImageElement(doc, id)
      if (el) {
        applyImageStyle(el, style)
        if (style.src) el.src = style.src
      }
    })
    Object.entries(sectionStyleOverridesRef.current).forEach(([id, style]) => {
      const el = findSectionNode(doc, id)
      if (el) applySectionStyleOverrides(el, style)
    })
    // Apply accent CSS var at document root.
    if (accentRef.current) {
      doc.documentElement.style.setProperty('--color-accent', accentRef.current)
      doc.documentElement.style.setProperty('--irie-accent', accentRef.current)
    }
  }, [])

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

  // Selected object lookups
  const selectedText = useMemo<TextObject | null>(() => {
    if (selectionMode !== 'text' || !selectedObjectId) return null
    return objects.texts.find((t) => t.id === selectedObjectId) ?? null
  }, [selectionMode, selectedObjectId, objects.texts])
  const selectedImage = useMemo<ImageObject | null>(() => {
    if (selectionMode !== 'image' || !selectedObjectId) return null
    return objects.images.find((i) => i.id === selectedObjectId) ?? null
  }, [selectionMode, selectedObjectId, objects.images])

  // ───── Toasts ─────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, shortcut?: string, ttl?: number) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev.slice(-3), { id, message, shortcut, ttl }])
  }, [])
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ───── Persistence ────────────────────────────────────────────────────
  const persistSoon = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistNow()
    }, 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistNow = useCallback(async () => {
    if (typeof window === 'undefined') return
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) => {
      const match = byId.get(sid)
      return match ? getDialGroupForSection(match.sectionType) : null
    }
    // Serialize the live iframe (captures text edits, inline styles, etc.)
    const baked = serializeIframe(doc, tunerStateRef.current, getDials)
    const snap = readSnapshot()
    const nextSnapshot: GenerationSnapshot = {
      ...(snap ?? {}),
      html: baked,
      tunerState: tunerStateRef.current,
      textContent: textContentRef.current,
      textStyles: textStylesRef.current,
      imageStyles: imageStylesRef.current,
      sectionStyleOverrides: sectionStyleOverridesRef.current,
      accent: accentRef.current,
      metadata: snap?.metadata
        ? {
            ...snap.metadata,
            palette: { ...(snap.metadata.palette ?? {}), accent: accentRef.current },
          }
        : { palette: { accent: accentRef.current } },
    }
    try {
      window.localStorage.setItem(
        LAST_GENERATION_KEY,
        JSON.stringify(nextSnapshot),
      )
      emitStorageChange(LAST_GENERATION_KEY)
      setSavedAt(Date.now())
      setSaveError(null)
      lastPersistedRef.current = tunerStateRef.current
    } catch (err) {
      setSaveError('Local storage full or unavailable')
      // eslint-disable-next-line no-console
      console.error('[tuner] persist failed', err)
    }
    setSnapshot(nextSnapshot)
  }, [sections])

  const handleSaveNow = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void persistNow()
    addToast('Saved')
  }, [persistNow, addToast])

  const handleRetrySave = useCallback(() => {
    setSaveError(null)
    void persistNow()
  }, [persistNow])

  // ───── Edit-log helpers (writes to builder_edits + final_html) ───────
  const logDialEdit = useCallback(
    async (
      section: ClassifiedSection,
      dial: Dial,
      before: number | string | null,
      after: number | string,
    ) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
      const getDials = (sid: string) => {
        const match = byId.get(sid)
        return match ? getDialGroupForSection(match.sectionType) : null
      }
      const bakedHtml = serializeIframe(doc, tunerStateRef.current, getDials)
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
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
      const getDials = (sid: string) => {
        const match = byId.get(sid)
        return match ? getDialGroupForSection(match.sectionType) : null
      }
      const bakedHtml = serializeIframe(doc, tunerStateRef.current, getDials)
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

  const bakeCurrentHtml = useCallback((): string => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return ''
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) => {
      const match = byId.get(sid)
      return match ? getDialGroupForSection(match.sectionType) : null
    }
    return serializeIframe(doc, tunerStateRef.current, getDials)
  }, [sections])

  const logObjectEdit = useCallback(
    async (
      diff:
        | {
            kind: 'text'
            element_id: string
            before: string | null
            after: string
          }
        | {
            kind: 'style'
            element_id: string
            before: Record<string, string>
            after: Record<string, string>
          }
        | {
            kind: 'image'
            element_id: string
            before_summary: string
            after_summary: string
          }
        | { kind: 'accent'; before: string; after: string },
    ) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const html = bakeCurrentHtml()
      // Accent is the only kind that lives in agent_outputs_json.metadata
      // (picker reads palette.accent on fresh load), so patch it there too.
      let agentOutputs: Record<string, unknown> | null = null
      if (diff.kind === 'accent') {
        const snap = readSnapshot()
        agentOutputs = {
          metadata: {
            ...(snap?.metadata ?? {}),
            palette: { ...(snap?.metadata?.palette ?? {}), accent: diff.after },
          },
          blueprint: snap?.blueprint ?? null,
          critique: snap?.critique ?? null,
          decisions: Array.isArray(snap?.decisions) ? snap.decisions : [],
          label: typeof snap?.label === 'string' ? snap.label : 'Generation',
        }
      }
      await logEdits(supabaseRef.current, ctx, [diff], html, agentOutputs)
    },
    [bakeCurrentHtml],
  )

  // ───── History helpers ────────────────────────────────────────────────
  const bump = useCallback(() => setHistoryVersion((v) => v + 1), [])

  const pushEntry = useCallback(
    (entry: HistoryEntry) => {
      history.push(entry)
      bump()
    },
    [bump, history],
  )

  const handleUndo = useCallback(() => {
    const ok = history.undo()
    if (!ok) return
    bump()
    persistSoon()
    addToast('Undo', `${cmdKey}⇧Z to redo`)
  }, [addToast, bump, history, persistSoon])

  const handleRedo = useCallback(() => {
    const ok = history.redo()
    if (!ok) return
    bump()
    persistSoon()
  }, [bump, history, persistSoon])

  // ───── Replay helpers (used by history revert for Tuner-state snapshot) ─
  const replayInto = useCallback(
    (state: TunerState, flashSectionId?: string) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      // Clear inline dial properties then re-apply
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

  // ───── Selection rings ────────────────────────────────────────────────
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

  const clearObjectRings = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('.is-irie-object-selected').forEach((n) => {
      n.classList.remove('is-irie-object-selected')
      n.removeAttribute('contenteditable')
    })
  }, [])

  const setObjectRing = useCallback(
    (id: string | null, kind: 'text' | 'image' | null) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      clearObjectRings()
      if (!id || !kind) return
      const el =
        kind === 'text' ? findTextElement(doc, id) : findImageElement(doc, id)
      if (!el) return
      el.classList.add('is-irie-object-selected')
      if (kind === 'text') {
        el.setAttribute('contenteditable', 'true')
        ;(el as HTMLElement).focus()
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [clearObjectRings],
  )

  // Sync active ring when section OR mode changes
  useEffect(() => {
    if (selectionMode === 'section-tune' || selectionMode === 'section-style') {
      setActiveRing(activeId)
      clearObjectRings()
    } else {
      // Object mode: clear section highlight, highlight object
      setActiveRing(null)
      setObjectRing(
        selectedObjectId,
        selectionMode === 'text' ? 'text' : 'image',
      )
    }
  }, [activeId, selectionMode, selectedObjectId, setActiveRing, clearObjectRings, setObjectRing])

  // ───── Object selection from preview click / left rail ────────────────
  const selectTextObject = useCallback(
    (id: string) => {
      const match = objects.texts.find((t) => t.id === id)
      if (!match) return
      if (match.sectionId) setActiveId(match.sectionId)
      setSelectionMode('text')
      setSelectedObjectId(id)
      if (match.sectionId) {
        setExpandedSections((prev) => {
          if (prev.has(match.sectionId!)) return prev
          const next = new Set(prev)
          next.add(match.sectionId!)
          return next
        })
      }
      setDrawerOpen(true)
    },
    [objects.texts],
  )

  const selectImageObject = useCallback(
    (id: string) => {
      const match = objects.images.find((i) => i.id === id)
      if (!match) return
      if (match.sectionId) setActiveId(match.sectionId)
      setSelectionMode('image')
      setSelectedObjectId(id)
      if (match.sectionId) {
        setExpandedSections((prev) => {
          if (prev.has(match.sectionId!)) return prev
          const next = new Set(prev)
          next.add(match.sectionId!)
          return next
        })
      }
      setDrawerOpen(true)
    },
    [objects.images],
  )

  const selectSection = useCallback(
    (id: string, mode: 'section-tune' | 'section-style' = 'section-tune') => {
      setActiveId(id)
      setSelectionMode(mode)
      setSelectedObjectId(null)
      setDrawerOpen(true)
    },
    [],
  )

  // ───── Iframe event listeners ─────────────────────────────────────────
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

    // Click: classify target → text / image / section
    function onClick(e: MouseEvent) {
      const result = classifyClickTarget(e.target)
      if (!result.kind) return
      e.preventDefault()
      if (result.kind === 'text' && result.id) {
        selectTextObject(result.id)
        return
      }
      if (result.kind === 'image' && result.id) {
        selectImageObject(result.id)
        return
      }
      if (result.kind === 'section' && result.sectionId) {
        selectSection(result.sectionId, 'section-tune')
      }
    }
    doc.addEventListener('click', onClick)

    // Input: contenteditable text edits → live state
    function onInput(e: Event) {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      const textEl = target.closest<HTMLElement>('[data-irie-edit-id]')
      if (!textEl) return
      const id = textEl.getAttribute('data-irie-edit-id')
      if (!id) return
      const value = textEl.textContent || ''
      setTextContent((prev) => ({ ...prev, [id]: value }))
    }
    doc.addEventListener('input', onInput)

    // Blur: when leaving contenteditable, commit final text (for history)
    const pendingTextBefore = new Map<string, string>()
    function onFocusIn(e: Event) {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      const textEl = target.closest<HTMLElement>('[data-irie-edit-id]')
      if (!textEl) return
      const id = textEl.getAttribute('data-irie-edit-id')
      if (!id) return
      if (!pendingTextBefore.has(id)) {
        pendingTextBefore.set(id, textEl.textContent || '')
      }
    }
    function onFocusOut(e: Event) {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      const textEl = target.closest<HTMLElement>('[data-irie-edit-id]')
      if (!textEl) return
      const id = textEl.getAttribute('data-irie-edit-id')
      if (!id) return
      const before = pendingTextBefore.get(id)
      pendingTextBefore.delete(id)
      const after = textEl.textContent || ''
      if (before === undefined || before === after) return
      // Push onto history as kind 'text'
      const entry: HistoryEntry = {
        kind: 'text',
        apply: (d) => {
          const el = findTextElement(d, id)
          if (el) el.textContent = after
        },
        revert: (d) => {
          const el = findTextElement(d, id)
          if (el) el.textContent = before
          setTextContent((prev) => {
            const next = { ...prev }
            if (before === '') delete next[id]
            else next[id] = before
            return next
          })
        },
        onApplyState: () => {
          setTextContent((prev) => ({ ...prev, [id]: after }))
        },
      }
      pushEntry(entry)
      setTextContent((prev) => ({ ...prev, [id]: after }))
      persistSoon()
      void logObjectEdit({
        kind: 'text',
        element_id: id,
        before,
        after,
      })
    }
    doc.addEventListener('focusin', onFocusIn)
    doc.addEventListener('focusout', onFocusOut)

    return () => {
      doc.removeEventListener('mouseover', onOver)
      doc.removeEventListener('mouseleave', onLeave)
      doc.removeEventListener('click', onClick)
      doc.removeEventListener('input', onInput)
      doc.removeEventListener('focusin', onFocusIn)
      doc.removeEventListener('focusout', onFocusOut)
    }
  }, [sections.length, objects.texts.length, objects.images.length, pushEntry, persistSoon, selectTextObject, selectImageObject, selectSection, logObjectEdit])

  // Stamp data-irie-section-label on each section so ring tooltips read it
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    sections.forEach((s) => {
      const node = findSectionNode(doc, s.sectionId)
      node?.setAttribute('data-irie-section-label', s.sectionType)
    })
  }, [sections])

  // ───── Section meta ───────────────────────────────────────────────────
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const counts: Record<string, { texts: number; images: number }> = {}
    sections.forEach((s) => {
      const texts = objects.texts.filter((t) => t.sectionId === s.sectionId).length
      const images = objects.images.filter((i) => i.sectionId === s.sectionId).length
      counts[s.sectionId] = { texts, images }
    })
    setSectionMeta((prev) => {
      const next: Record<string, SectionMeta> = { ...prev }
      sections.forEach((s) => {
        next[s.sectionId] = {
          ...(next[s.sectionId] || {}),
          counts: counts[s.sectionId],
          dirty:
            !!tunerStateRef.current[s.sectionId] &&
            Object.keys(tunerStateRef.current[s.sectionId]).length > 0,
        }
      })
      return next
    })
  }, [sections, objects])

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

  // ───── Tuner dial handlers (preserved bit-for-bit) ───────────────────
  const handleDialChange = useCallback(
    (dial: Dial, value: number | string) => {
      if (!activeSection) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
      applyDial(node, dial, value)
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
      const priorValue =
        tunerStateRef.current[activeSection.sectionId]?.[dial.id]
      if (priorValue === value) return
      const snapshotBefore = JSON.parse(JSON.stringify(tunerStateRef.current)) as TunerState
      const next = { ...tunerStateRef.current }
      const forSection = { ...(next[activeSection.sectionId] || {}) }
      forSection[dial.id] = value
      next[activeSection.sectionId] = forSection
      const snapshotAfter = JSON.parse(JSON.stringify(next)) as TunerState
      pushEntry({
        kind: 'tuner',
        apply: () => {
          setTunerState(snapshotAfter)
          tunerStateRef.current = snapshotAfter
          replayInto(snapshotAfter, activeSection.sectionId)
        },
        revert: () => {
          setTunerState(snapshotBefore)
          tunerStateRef.current = snapshotBefore
          replayInto(snapshotBefore, activeSection.sectionId)
        },
      })
      setTunerState(next)
      setSectionMeta((prev) => ({
        ...prev,
        [activeSection.sectionId]: {
          ...(prev[activeSection.sectionId] || {}),
          lastEditedAt: Date.now(),
        },
      }))
      persistSoon()
      void logDialEdit(activeSection, dial, before, value)
    },
    [activeSection, logDialEdit, persistSoon, pushEntry, replayInto],
  )

  const handlePreset = useCallback(
    (preset: Preset) => {
      if (!activeSection || !activeGroup) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const node = findSectionNode(doc, activeSection.sectionId)
      if (!node) return
      const snapshotBefore = JSON.parse(JSON.stringify(tunerStateRef.current)) as TunerState
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
      const snapshotAfter = JSON.parse(JSON.stringify(nextState)) as TunerState
      pushEntry({
        kind: 'tuner-preset',
        apply: () => {
          setTunerState(snapshotAfter)
          tunerStateRef.current = snapshotAfter
          replayInto(snapshotAfter, activeSection.sectionId)
        },
        revert: () => {
          setTunerState(snapshotBefore)
          tunerStateRef.current = snapshotBefore
          replayInto(snapshotBefore, activeSection.sectionId)
        },
      })
      setTunerState(nextState)
      setSectionMeta((prev) => ({
        ...prev,
        [activeSection.sectionId]: {
          ...(prev[activeSection.sectionId] || {}),
          lastEditedAt: Date.now(),
        },
      }))
      persistSoon()
      addToast(`Applied "${preset.label}"`, `${cmdKey}Z to undo`)
      void logPresetEdit(activeSection, preset)
    },
    [activeGroup, activeSection, logPresetEdit, persistSoon, pushEntry, addToast, replayInto],
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
      const snapshotBefore = JSON.parse(JSON.stringify(tunerStateRef.current)) as TunerState
      node.style.removeProperty(dial.cssVar)
      const next: TunerState = { ...tunerStateRef.current }
      const forSection = { ...(next[activeSection.sectionId] || {}) }
      delete forSection[dial.id]
      if (Object.keys(forSection).length === 0) {
        delete next[activeSection.sectionId]
      } else {
        next[activeSection.sectionId] = forSection
      }
      const snapshotAfter = JSON.parse(JSON.stringify(next)) as TunerState
      pushEntry({
        kind: 'tuner',
        apply: () => {
          setTunerState(snapshotAfter)
          tunerStateRef.current = snapshotAfter
          replayInto(snapshotAfter, activeSection.sectionId)
        },
        revert: () => {
          setTunerState(snapshotBefore)
          tunerStateRef.current = snapshotBefore
          replayInto(snapshotBefore, activeSection.sectionId)
        },
      })
      setTunerState(next)
      persistSoon()
      void logDialEdit(activeSection, dial, prior, dial.default as number | string)
    },
    [activeSection, logDialEdit, persistSoon, pushEntry, replayInto],
  )

  const handleRevertSection = useCallback(() => {
    if (!activeSection) return
    if (!tunerStateRef.current[activeSection.sectionId]) return
    const snapshotBefore = JSON.parse(JSON.stringify(tunerStateRef.current)) as TunerState
    const next: TunerState = { ...tunerStateRef.current }
    delete next[activeSection.sectionId]
    const snapshotAfter = JSON.parse(JSON.stringify(next)) as TunerState
    pushEntry({
      kind: 'tuner',
      apply: () => {
        setTunerState(snapshotAfter)
        tunerStateRef.current = snapshotAfter
        replayInto(snapshotAfter, activeSection.sectionId)
      },
      revert: () => {
        setTunerState(snapshotBefore)
        tunerStateRef.current = snapshotBefore
        replayInto(snapshotBefore, activeSection.sectionId)
      },
    })
    setTunerState(next)
    replayInto(next, activeSection.sectionId)
    persistSoon()
    addToast(`Reverted "${activeSection.label}"`, `${cmdKey}Z to undo`)
  }, [activeSection, persistSoon, pushEntry, replayInto, addToast])

  const handleRevertAll = useCallback(() => {
    if (Object.keys(tunerStateRef.current).length === 0) return
    const snapshotBefore = JSON.parse(JSON.stringify(tunerStateRef.current)) as TunerState
    const next: TunerState = {}
    pushEntry({
      kind: 'tuner',
      apply: () => {
        setTunerState(next)
        tunerStateRef.current = next
        replayInto(next)
      },
      revert: () => {
        setTunerState(snapshotBefore)
        tunerStateRef.current = snapshotBefore
        replayInto(snapshotBefore)
      },
    })
    setTunerState(next)
    replayInto(next)
    persistSoon()
    addToast('Reverted all tuner edits', `${cmdKey}Z to undo`)
  }, [persistSoon, pushEntry, replayInto, addToast])

  // ───── Object-mode mutators ───────────────────────────────────────────
  const handleTextStyleChange = useCallback(
    <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => {
      if (!selectedText) return
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const el = findTextElement(doc, selectedText.id)
      if (!el) return
      applyTextStyle(el, { [key]: value } as TextStyle)
      setTextStyles((prev) => ({
        ...prev,
        [selectedText.id]: { ...(prev[selectedText.id] || {}), [key]: value },
      }))
    },
    [selectedText],
  )

  const handleTextStyleCommit = useCallback(
    <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => {
      if (!selectedText) return
      const id = selectedText.id
      const prior = textStylesRef.current[id] || {}
      const priorValue = prior[key]
      if (priorValue === value) return
      const before: Partial<TextStyle> = { [key]: priorValue ?? '' }
      const after: Partial<TextStyle> = { [key]: value }
      pushEntry({
        kind: 'text-style',
        apply: (d) => {
          const el = findTextElement(d, id)
          if (el) applyTextStyle(el, after as TextStyle)
          setTextStyles((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || {}), ...after },
          }))
        },
        revert: (d) => {
          const el = findTextElement(d, id)
          if (el) applyTextStyle(el, before as TextStyle)
          setTextStyles((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || {}), ...before },
          }))
        },
      })
      persistSoon()
      void logObjectEdit({
        kind: 'style',
        element_id: id,
        before: before as Record<string, string>,
        after: after as Record<string, string>,
      })
    },
    [persistSoon, pushEntry, selectedText, logObjectEdit],
  )

  const handleTextStyleReset = useCallback(
    (key: keyof TextStyle) => {
      if (!selectedText) return
      handleTextStyleChange(key, '' as TextStyle[typeof key])
      handleTextStyleCommit(key, '' as TextStyle[typeof key])
    },
    [handleTextStyleChange, handleTextStyleCommit, selectedText],
  )

  const handleRevertText = useCallback(() => {
    if (!selectedText) return
    const id = selectedText.id
    const prior = textStylesRef.current[id]
    if (!prior || Object.keys(prior).length === 0) return
    pushEntry({
      kind: 'text-style',
      apply: (d) => {
        const el = findTextElement(d, id)
        if (el) {
          // Clear all style properties in `prior`
          Object.keys(prior).forEach((k) => {
            ;(el.style as unknown as Record<string, string>)[k] = ''
          })
          el.style.fontFamily = ''
        }
        setTextStyles((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      },
      revert: (d) => {
        const el = findTextElement(d, id)
        if (el) applyTextStyle(el, prior)
        setTextStyles((prev) => ({ ...prev, [id]: prior }))
      },
    })
    const doc = iframeRef.current?.contentDocument
    if (doc) {
      const el = findTextElement(doc, id)
      if (el) {
        Object.keys(prior).forEach((k) => {
          ;(el.style as unknown as Record<string, string>)[k] = ''
        })
        el.style.fontFamily = ''
      }
    }
    setTextStyles((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    persistSoon()
  }, [persistSoon, pushEntry, selectedText])

  // Image handlers (stubbed until Phase C but wired for shape compat)
  const handleImageChange = useCallback(
    (id: string, patch: Partial<ImageStyle>, commit: boolean) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const el = findImageElement(doc, id)
      if (!el) return
      applyImageStyle(el, patch as ImageStyle)
      if (patch.src) el.src = patch.src
      setImageStyles((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), ...patch },
      }))
      if (!commit) return
      const prior = imageStylesRef.current[id] || {}
      const before: Partial<ImageStyle> = {}
      const after: Partial<ImageStyle> = { ...patch }
      ;(Object.keys(patch) as Array<keyof ImageStyle>).forEach((k) => {
        // Seed the "before" snapshot with prior values for every key the
        // patch touches. Cast via `as never` so TS stops balking on the
        // discriminated union inside ImageStyle (objectFit has a limited
        // literal union that can't accept a generic string).
        ;(before as Record<string, unknown>)[k] = (prior as Record<string, unknown>)[k] ?? ''
      })
      pushEntry({
        kind: 'image',
        apply: (d) => {
          const e = findImageElement(d, id)
          if (e) {
            applyImageStyle(e, after as ImageStyle)
            if (after.src) e.src = after.src
          }
          setImageStyles((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || {}), ...after },
          }))
        },
        revert: (d) => {
          const e = findImageElement(d, id)
          if (e) {
            applyImageStyle(e, before as ImageStyle)
            if (before.src) e.src = before.src
          }
          setImageStyles((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || {}), ...before },
          }))
        },
      })
      persistSoon()
      // Log image src replace as 'image'; other prop changes as 'style'.
      if (typeof patch.src === 'string') {
        const priorSrc = typeof prior.src === 'string' ? prior.src : ''
        const nextSrc = patch.src
        void logObjectEdit({
          kind: 'image',
          element_id: id,
          before_summary: priorSrc
            ? priorSrc.length > 80
              ? `${priorSrc.slice(0, 80)}…`
              : priorSrc
            : '<empty>',
          after_summary: nextSrc.startsWith('data:')
            ? `<data: ${nextSrc.length}b>`
            : nextSrc,
        })
      } else {
        void logObjectEdit({
          kind: 'style',
          element_id: id,
          before: before as Record<string, string>,
          after: after as Record<string, string>,
        })
      }
    },
    [persistSoon, pushEntry, logObjectEdit],
  )

  // Section-style (absolute px padding + bg + overlay) handlers
  const handleSectionStyleChange = useCallback(
    (
      id: string,
      patch: Partial<SectionStyleOverrides>,
      commit: boolean,
    ) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const el = findSectionNode(doc, id)
      if (!el) return
      const merged = {
        ...(sectionStyleOverridesRef.current[id] || {}),
        ...patch,
      }
      applySectionStyleOverrides(el, merged)
      setSectionStyleOverrides((prev) => ({ ...prev, [id]: merged }))
      if (!commit) return
      const prior = sectionStyleOverridesRef.current[id] || {}
      const before: Partial<SectionStyleOverrides> = {}
      const after: Partial<SectionStyleOverrides> = { ...patch }
      ;(Object.keys(patch) as Array<keyof SectionStyleOverrides>).forEach((k) => {
        before[k] = prior[k] ?? ''
      })
      pushEntry({
        kind: 'style',
        apply: (d) => {
          const e = findSectionNode(d, id)
          if (!e) return
          const m = {
            ...(sectionStyleOverridesRef.current[id] || {}),
            ...after,
          }
          applySectionStyleOverrides(e, m)
          setSectionStyleOverrides((prev) => ({ ...prev, [id]: m }))
        },
        revert: (d) => {
          const e = findSectionNode(d, id)
          if (!e) return
          const m = {
            ...(sectionStyleOverridesRef.current[id] || {}),
            ...before,
          }
          applySectionStyleOverrides(e, m)
          setSectionStyleOverrides((prev) => ({ ...prev, [id]: m }))
        },
      })
      persistSoon()
      void logObjectEdit({
        kind: 'style',
        element_id: id,
        before: before as Record<string, string>,
        after: after as Record<string, string>,
      })
    },
    [persistSoon, pushEntry, logObjectEdit],
  )

  // Accent
  const handleAccentChange = useCallback(
    (next: string, commit: boolean) => {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      doc.documentElement.style.setProperty('--color-accent', next)
      doc.documentElement.style.setProperty('--irie-accent', next)
      setAccent(next)
      if (!commit) return
      const before = accentRef.current
      if (before === next) return
      pushEntry({
        kind: 'accent',
        apply: (d) => {
          d.documentElement.style.setProperty('--color-accent', next)
          d.documentElement.style.setProperty('--irie-accent', next)
          setAccent(next)
          void logObjectEdit({ kind: 'accent', before, after: next })
        },
        revert: (d) => {
          d.documentElement.style.setProperty('--color-accent', before)
          d.documentElement.style.setProperty('--irie-accent', before)
          setAccent(before)
          void logObjectEdit({ kind: 'accent', before: next, after: before })
        },
      })
      persistSoon()
      void logObjectEdit({ kind: 'accent', before, after: next })
    },
    [persistSoon, pushEntry, logObjectEdit],
  )

  // ───── Download / copy / share ────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) => {
      const match = byId.get(sid)
      return match ? getDialGroupForSection(match.sectionType) : null
    }
    const html = serializeForExport(doc, tunerStateRef.current, getDials)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'irie-builder.html'
    a.click()
    URL.revokeObjectURL(url)
    // Restore pre-Tuner behavior: writes builder_publishes row.
    const ctx = ctxRef.current
    if (ctx) {
      void logPublish(supabaseRef.current, ctx, html)
    }
  }, [sections])

  const handleExport = useCallback(() => {
    handleDownload()
  }, [handleDownload])

  const handleCopyCode = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const byId = new Map(sections.map((s) => [s.sectionId, s] as const))
    const getDials = (sid: string) =>
      byId.get(sid) ? getDialGroupForSection(byId.get(sid)!.sectionType) : null
    const baked = serializeForExport(doc, tunerStateRef.current, getDials)
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

  const handleFullscreenToggle = useCallback(() => {
    setFullscreenOpen((v) => !v)
  }, [])

  // ───── Viewport / zoom ────────────────────────────────────────────────
  const cycleViewport = useCallback(() => {
    setViewport((v) =>
      v === 'desktop' ? 'tablet' : v === 'tablet' ? 'mobile' : 'desktop',
    )
  }, [])
  const cycleZoom = useCallback(() => {
    addToast('Zoom is fixed at 100% in v1')
  }, [addToast])

  // ───── Section navigation ────────────────────────────────────────────
  const focusSectionByIndex = useCallback(
    (idx: number) => {
      const s = sections[idx]
      if (!s) return
      selectSection(s.sectionId, 'section-tune')
    },
    [sections, selectSection],
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

  // ───── Section-style mode toggle (S key) ──────────────────────────────
  const toggleSectionStyle = useCallback(() => {
    setSelectionMode((m) =>
      m === 'section-style' ? 'section-tune' : 'section-style',
    )
  }, [])

  // Currently selected section style + palette
  const palette = useMemo<string[]>(() => {
    const paletteRaw = snapshot?.metadata?.palette as
      | Record<string, string>
      | undefined
    const values: string[] = []
    if (paletteRaw) {
      Object.values(paletteRaw).forEach((v) => {
        if (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)) values.push(v)
      })
    }
    return values
  }, [snapshot])

  const activeSectionStyleOverrides = useMemo<SectionStyleOverrides>(() => {
    if (!activeSection) return {}
    return sectionStyleOverrides[activeSection.sectionId] || {}
  }, [activeSection, sectionStyleOverrides])

  const activeSelectedImageStyle = useMemo<ImageStyle>(() => {
    if (!selectedImage) return {}
    return imageStyles[selectedImage.id] || {}
  }, [selectedImage, imageStyles])

  const activeSelectedTextStyle = useMemo<TextStyle>(() => {
    if (!selectedText) return {}
    return textStyles[selectedText.id] || {}
  }, [selectedText, textStyles])

  const currentSelectedText = useMemo<string>(() => {
    if (!selectedText) return ''
    return textContent[selectedText.id] ?? selectedText.text
  }, [selectedText, textContent])

  // ───── Palette actions ───────────────────────────────────────────────
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
        disabled: !history.canUndo(),
      },
      {
        id: 'redo',
        label: 'Redo',
        group: 'Edit',
        shortcut: `${cmdKey}⇧Z`,
        keywords: 'redo forward',
        run: handleRedo,
        disabled: !history.canRedo(),
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
        disabled:
          !activeSection || !tunerStateRef.current[activeSection?.sectionId ?? ''],
      },
      {
        id: 'revert-all',
        label: 'Revert ALL tuner edits',
        group: 'Edit',
        run: handleRevertAll,
        disabled: Object.keys(tunerStateRef.current).length === 0,
      },
      {
        id: 'toggle-section-style',
        label: 'Toggle section style mode',
        group: 'Edit',
        shortcut: 'S',
        run: toggleSectionStyle,
      },
      {
        id: 'replace-image',
        label: 'Replace image in focused section',
        group: 'Edit',
        run: () => {
          if (!activeSection) return
          const first = objects.images.find(
            (i) => i.sectionId === activeSection.sectionId,
          )
          if (first) selectImageObject(first.id)
          else addToast('No images in this section')
        },
      },
      {
        id: 'edit-text',
        label: 'Edit text in focused section',
        group: 'Edit',
        run: () => {
          if (!activeSection) return
          const first = objects.texts.find(
            (t) =>
              t.sectionId === activeSection.sectionId && t.kind === 'headline',
          )
          const target = first || objects.texts.find((t) => t.sectionId === activeSection.sectionId)
          if (target) selectTextObject(target.id)
          else addToast('No text in this section')
        },
      },
      {
        id: 'change-accent',
        label: 'Change accent color…',
        group: 'Theme',
        run: () => setAccentPopoverOpen(true),
      },
      {
        id: 'fullscreen',
        label: 'Fullscreen preview',
        group: 'View',
        run: handleFullscreenToggle,
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
          // /logout is POST-only (CSRF hardening) — submit a hidden form
          // rather than navigating via GET.
          if (typeof document === 'undefined') return
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = '/logout'
          document.body.appendChild(form)
          form.submit()
        },
      },
    )
    return a
  }, [
    sections,
    activeGroup,
    activeSection,
    objects,
    handlePreset,
    handleUndo,
    handleRedo,
    handleSaveNow,
    handleRevertSection,
    handleRevertAll,
    handleDownload,
    handleCopyCode,
    handleShare,
    handleFullscreenToggle,
    focusSectionByIndex,
    selectTextObject,
    selectImageObject,
    toggleSectionStyle,
    historyVersion,
    tunerState,
    history,
    addToast,
  ])

  const [accentPopoverOpen, setAccentPopoverOpen] = useState(false)

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

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveNow()
        return
      }

      if (isTypingTarget(e.target)) return

      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setAccentPopoverOpen(false)
        if (fullscreenOpen) {
          setFullscreenOpen(false)
          return
        }
        if (selectionMode === 'text' || selectionMode === 'image') {
          setSelectionMode('section-tune')
          setSelectedObjectId(null)
          clearObjectRings()
          return
        }
        setDrawerOpen(false)
        setActiveId(null)
        return
      }

      if (e.key >= '1' && e.key <= '9' && !mod && !e.shiftKey && !e.altKey) {
        const idx = Number(e.key) - 1
        if (idx < sections.length) {
          e.preventDefault()
          focusSectionByIndex(idx)
        }
        return
      }

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

      if (e.key === 's' || e.key === 'S') {
        if (activeSection && !mod && !e.shiftKey) {
          e.preventDefault()
          toggleSectionStyle()
        }
        return
      }

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
    toggleSectionStyle,
    activeSection,
    selectionMode,
    clearObjectRings,
    fullscreenOpen,
  ])

  // ───── Saved-at clock ─────────────────────────────────────────────────
  useEffect(() => {
    if (!savedAt) return
    const i = window.setInterval(() => setSavedAtTick((t) => t + 1), 15_000)
    return () => window.clearInterval(i)
  }, [savedAt])

  const savedAtLabel = useMemo(() => {
    void savedAtTick
    return relTimeLabel(savedAt)
  }, [savedAt, savedAtTick])

  const rootClass = `tuner-root${drawerOpen ? ' is-drawer-open' : ''}`

  // Right-panel mode toggle chips
  function renderModeChips() {
    if (!activeSection && !selectedText && !selectedImage) return null
    return (
      <div className="tuner-mode-chips" role="tablist" aria-label="Edit mode">
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'section-tune'}
          className={selectionMode === 'section-tune' ? 'is-active' : ''}
          disabled={!activeSection}
          onClick={() => {
            if (!activeSection) return
            setSelectionMode('section-tune')
            setSelectedObjectId(null)
          }}
        >
          Tune
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'section-style'}
          className={selectionMode === 'section-style' ? 'is-active' : ''}
          disabled={!activeSection}
          onClick={() => {
            if (!activeSection) return
            setSelectionMode('section-style')
            setSelectedObjectId(null)
          }}
          title="Section style (S)"
        >
          Style
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'text'}
          className={selectionMode === 'text' ? 'is-active' : ''}
          disabled={!selectedText}
        >
          Text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectionMode === 'image'}
          className={selectionMode === 'image' ? 'is-active' : ''}
          disabled={!selectedImage}
        >
          Image
        </button>
      </div>
    )
  }

  // Right-panel body: routes to Section-TUNE / Section-STYLE / Text / Image.
  function renderRightPanel() {
    if (selectionMode === 'text' && selectedText) {
      return (
        <aside className="tuner-right" aria-label="Text controls">
          <header className="tuner-right-header">
            <span className="tuner-section-badge">text · {selectedText.kind}</span>
            <h2 className="tuner-right-title">{selectedText.label}</h2>
            {renderModeChips()}
          </header>
          <div className="tuner-right-body">
            <TunerTextPanel
              target={selectedText}
              style={activeSelectedTextStyle}
              currentText={currentSelectedText}
              onStyleChange={handleTextStyleChange}
              onStyleCommit={handleTextStyleCommit}
              onStyleReset={handleTextStyleReset}
              onRevertObject={handleRevertText}
            />
          </div>
        </aside>
      )
    }
    if (selectionMode === 'image' && selectedImage) {
      return (
        <aside className="tuner-right" aria-label="Image controls">
          <header className="tuner-right-header">
            <span className="tuner-section-badge">image</span>
            <h2 className="tuner-right-title">{selectedImage.label}</h2>
            {renderModeChips()}
          </header>
          <div className="tuner-right-body">
            <TunerImagePanel
              target={selectedImage}
              style={activeSelectedImageStyle}
              onChange={(patch) => handleImageChange(selectedImage.id, patch, false)}
              onCommit={(patch) => handleImageChange(selectedImage.id, patch, true)}
              onRevertObject={() => {
                const prior = imageStylesRef.current[selectedImage.id]
                if (!prior) return
                setImageStyles((prev) => {
                  const next = { ...prev }
                  delete next[selectedImage.id]
                  return next
                })
                const doc = iframeRef.current?.contentDocument
                if (doc) {
                  const el = findImageElement(doc, selectedImage.id)
                  if (el) {
                    el.style.objectFit = ''
                    el.style.objectPosition = ''
                    el.style.borderRadius = ''
                  }
                }
                persistSoon()
              }}
            />
          </div>
        </aside>
      )
    }
    if (selectionMode === 'section-style' && activeSection) {
      return (
        <aside className="tuner-right" aria-label="Section style">
          <header className="tuner-right-header">
            <span className="tuner-section-badge">{activeSection.sectionType}</span>
            <h2 className="tuner-right-title">{activeSection.label}</h2>
            {renderModeChips()}
          </header>
          <div className="tuner-right-body">
            <TunerSectionStylePanel
              sectionId={activeSection.sectionId}
              style={activeSectionStyleOverrides}
              onChange={(patch) =>
                handleSectionStyleChange(activeSection.sectionId, patch, false)
              }
              onCommit={(patch) =>
                handleSectionStyleChange(activeSection.sectionId, patch, true)
              }
              onRevertObject={() => {
                const id = activeSection.sectionId
                const prior = sectionStyleOverridesRef.current[id]
                if (!prior || Object.keys(prior).length === 0) return
                setSectionStyleOverrides((prev) => {
                  const next = { ...prev }
                  delete next[id]
                  return next
                })
                const doc = iframeRef.current?.contentDocument
                if (doc) {
                  const el = findSectionNode(doc, id)
                  if (el) {
                    el.style.paddingTop = ''
                    el.style.paddingBottom = ''
                    el.style.backgroundColor = ''
                    el.style.backgroundImage = ''
                    el.style.backgroundSize = ''
                    el.style.backgroundPosition = ''
                  }
                }
                persistSoon()
              }}
            />
          </div>
        </aside>
      )
    }
    // Default: Section-TUNE (preserved bit-for-bit)
    return (
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
        extraHeader={renderModeChips()}
      />
    )
  }

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
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSaveNow}
        onOpenPalette={() => setPaletteOpen(true)}
        onShare={handleShare}
        onCopyCode={handleCopyCode}
        onDownload={handleDownload}
        onExport={handleExport}
        onToggleFullscreen={handleFullscreenToggle}
        accent={accent}
        accentPopover={
          <TunerAccentPopover
            open={accentPopoverOpen}
            accent={accent}
            palette={palette}
            onRequestOpen={() => setAccentPopoverOpen((v) => !v)}
            onClose={() => setAccentPopoverOpen(false)}
            onChange={(next) => handleAccentChange(next, false)}
            onCommit={(next) => handleAccentChange(next, true)}
          />
        }
      />
      <TunerLeftRail
        sections={sections}
        activeId={activeId}
        onSelect={(id) => selectSection(id, 'section-tune')}
        meta={sectionMeta}
        expanded={expandedSections}
        onToggleExpand={(id) => {
          setExpandedSections((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
        textsBySection={objects.texts}
        imagesBySection={objects.images}
        selectedObjectId={selectedObjectId}
        selectionMode={selectionMode}
        onSelectText={selectTextObject}
        onSelectImage={selectImageObject}
      />
      <TunerPreviewFrame
        ref={iframeRef}
        html={initialHtml}
        onLoad={handleIframeLoad}
        viewport={viewport}
      />
      {renderRightPanel()}
      <div className="tuner-mobile-only">
        <TunerMobileDrawer
          sections={sections}
          activeId={activeId}
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen((v) => !v)}
          onSelect={(id) => selectSection(id, 'section-tune')}
        />
      </div>
      <TunerPalette
        open={paletteOpen}
        actions={paletteActions}
        onClose={() => setPaletteOpen(false)}
      />
      <TunerToasts toasts={toasts} onDismiss={dismissToast} />
      {fullscreenOpen ? (
        <TunerFullscreenOverlay
          html={bakeCurrentHtml()}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}
    </div>
  )
}
