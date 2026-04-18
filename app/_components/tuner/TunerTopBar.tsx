'use client'

import { useEffect, useRef, useState } from 'react'
import type { PersistenceStatus } from '@/lib/persistence/status'

type Viewport = 'mobile' | 'tablet' | 'desktop'

export interface TunerTopBarProps {
  saveStatus: { status: PersistenceStatus; message?: string } | null
  saveError?: string | null
  onRetrySave?: () => void
  savedAtLabel?: string
  workspaceLabel?: string
  crumbCurrent?: string
  zoomPercent?: number
  onCycleZoom?: () => void
  viewport?: Viewport
  onChangeViewport?: (v: Viewport) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onSave?: () => void
  onOpenHistory?: () => void
  onOpenPalette?: () => void
  onShare?: () => void
  onDownload: () => void
  onExport: () => void
  onCopyCode?: () => void
  /** Tuner v2: fullscreen toggle callback. */
  onToggleFullscreen?: () => void
  /** Tuner v2: current accent value (for visual indicator). */
  accent?: string
  /** Tuner v2: rendered accent popover slot (component + state). */
  accentPopover?: React.ReactNode
}

/* Tiny inline icons. No icon library. 14×14 viewbox, 1.4 stroke. */
const Icon = {
  Workspace: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="10" height="10" rx="1.5" />
      <path d="M2 6h10" />
    </svg>
  ),
  Chevron: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5.5L7 9l3.5-3.5" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 3.5L9 7l-3.5 3.5" />
    </svg>
  ),
  Mobile: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="1.5" width="6" height="11" rx="1" />
      <path d="M6 11h2" />
    </svg>
  ),
  Tablet: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2" width="9" height="10" rx="1" />
      <path d="M6 10.5h2" />
    </svg>
  ),
  Desktop: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="2.5" width="12" height="8" rx="1" />
      <path d="M5 12.5h4M7 10.5v2" />
    </svg>
  ),
  Undo: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4.5L2.5 7 5 9.5" />
      <path d="M2.5 7h6.5a3 3 0 0 1 0 6H7" />
    </svg>
  ),
  Redo: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4.5L11.5 7 9 9.5" />
      <path d="M11.5 7H5a3 3 0 0 0 0 6h2" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4v3l2 1.5" />
    </svg>
  ),
  Share: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="3.5" cy="7" r="1.5" />
      <circle cx="10.5" cy="3.5" r="1.5" />
      <circle cx="10.5" cy="10.5" r="1.5" />
      <path d="M5 6.2l4-2M5 7.8l4 2" />
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 2v7M4 6.5L7 9.5l3-3M2.5 11.5h9" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4" />
      <path d="M9 9l2.5 2.5" />
    </svg>
  ),
  Fit: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5V2h3M12 5V2H9M2 9v3h3M12 9v3H9" />
    </svg>
  ),
}

export function TunerTopBar(props: TunerTopBarProps) {
  const {
    saveStatus,
    saveError,
    onRetrySave,
    savedAtLabel,
    workspaceLabel = 'Your project',
    crumbCurrent,
    zoomPercent = 100,
    onCycleZoom,
    viewport = 'desktop',
    onChangeViewport,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
    onSave,
    onOpenHistory,
    onOpenPalette,
    onShare,
    onDownload,
    onExport,
    onCopyCode,
    onToggleFullscreen,
    accentPopover,
  } = props

  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return
    function onDoc(e: MouseEvent) {
      if (!exportRef.current) return
      if (!exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [exportOpen])

  const saveClass =
    saveError
      ? 'is-error'
      : saveStatus?.status === 'saved'
        ? 'is-saved is-idle'
        : saveStatus?.status === 'saving'
          ? 'is-saving'
          : saveStatus?.status === 'error'
            ? 'is-error'
            : 'is-idle'

  const saveText = saveError
    ? 'Save failed'
    : saveStatus?.status === 'saving'
      ? 'Saving…'
      : savedAtLabel
        ? `Saved ${savedAtLabel}`
        : saveStatus?.message ?? 'Saved'

  return (
    <header className="tuner-topbar" role="banner">
      <div className="tuner-topbar-group">
        <button type="button" className="tuner-workspace" aria-label="Workspace">
          <Icon.Workspace />
          <span>{workspaceLabel}</span>
          <Icon.Chevron />
        </button>
      </div>

      <div className="tuner-crumb" aria-label="Breadcrumb">
        <span className="tuner-crumb-sep">/</span>
        <span className="tuner-crumb-current">{crumbCurrent ?? 'Untitled'}</span>
      </div>

      <div className="tuner-topbar-divider" />

      <div className="tuner-topbar-group">
        <button
          type="button"
          className="tuner-zoom"
          onClick={onCycleZoom}
          aria-label={`Zoom ${zoomPercent}%`}
          title="Cycle zoom (50/75/100/125)"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          className="tuner-icon-btn"
          aria-label="Fit to screen"
          title="Fit to screen"
        >
          <Icon.Fit />
        </button>
      </div>

      <div className="tuner-device-toggle" role="radiogroup" aria-label="Preview viewport">
        <button
          type="button"
          role="radio"
          aria-checked={viewport === 'desktop'}
          className={viewport === 'desktop' ? 'is-active' : ''}
          onClick={() => onChangeViewport?.('desktop')}
          title="Desktop (1440px)"
        >
          <Icon.Desktop />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={viewport === 'tablet'}
          className={viewport === 'tablet' ? 'is-active' : ''}
          onClick={() => onChangeViewport?.('tablet')}
          title="Tablet (768px)"
        >
          <Icon.Tablet />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={viewport === 'mobile'}
          className={viewport === 'mobile' ? 'is-active' : ''}
          onClick={() => onChangeViewport?.('mobile')}
          title="Mobile (375px)"
        >
          <Icon.Mobile />
        </button>
      </div>

      <div className="tuner-topbar-divider" />

      <div className="tuner-topbar-group">
        <button
          type="button"
          className="tuner-icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Cmd/Ctrl+Z)"
        >
          <Icon.Undo />
        </button>
        <button
          type="button"
          className="tuner-icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Shift+Cmd/Ctrl+Z)"
        >
          <Icon.Redo />
        </button>
      </div>

      <div className="tuner-topbar-right">
        {saveError ? (
          <span className="tuner-save-error" role="alert">
            <span>Save failed</span>
            <button type="button" onClick={onRetrySave}>Retry</button>
          </span>
        ) : (
          <span
            className={`tuner-save-status ${saveClass}`}
            role="status"
            aria-live="polite"
            title={saveText}
          >
            <span className="tuner-save-dot" aria-hidden="true" />
            <span>{saveText}</span>
          </span>
        )}

        <button
          type="button"
          className="tuner-icon-btn"
          onClick={onOpenPalette}
          aria-label="Command palette (Cmd/Ctrl+K)"
          title="Command palette · ⌘K"
        >
          <Icon.Search />
        </button>
        <button
          type="button"
          className="tuner-icon-btn"
          onClick={onOpenHistory}
          aria-label="Edit history"
          title="Edit history"
        >
          <Icon.History />
        </button>
        <button
          type="button"
          className="tuner-icon-btn"
          onClick={onShare}
          aria-label="Share preview link"
          title="Copy preview link"
        >
          <Icon.Share />
        </button>

        {onToggleFullscreen ? (
          <button
            type="button"
            className="tuner-icon-btn"
            onClick={onToggleFullscreen}
            aria-label="Fullscreen preview"
            title="Fullscreen preview"
          >
            <svg
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 5V2h3M12 5V2H9M2 9v3h3M12 9v3H9" />
            </svg>
          </button>
        ) : null}

        {accentPopover}

        <div className="tuner-dropdown" ref={exportRef}>
          <button
            type="button"
            className="tuner-btn is-primary"
            onClick={() => setExportOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            <Icon.Download />
            <span>Export</span>
            <Icon.Chevron />
          </button>
          {exportOpen ? (
            <div className="tuner-dropdown-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false)
                  onDownload()
                }}
              >
                <span>Download HTML</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false)
                  onExport()
                }}
              >
                <span>Publish</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false)
                  onCopyCode?.()
                }}
              >
                <span>Copy code</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
