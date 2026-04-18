'use client'

import type { PersistenceStatus } from '@/lib/persistence/status'

interface TunerTopBarProps {
  saveStatus: { status: PersistenceStatus; message?: string } | null
  onDownload: () => void
  onExport: () => void
}

const NAV = [
  { href: '/brief', label: 'Brief' },
  { href: '/generate', label: 'Generate' },
  { href: '/edit', label: 'Edit', active: true },
  { href: '#', label: 'Export', action: true },
] as const

export function TunerTopBar({ saveStatus, onDownload, onExport }: TunerTopBarProps) {
  const saveClass =
    saveStatus?.status === 'saved'
      ? 'is-saved'
      : saveStatus?.status === 'saving'
        ? 'is-saving'
        : ''

  return (
    <header className="tuner-topbar" role="banner">
      <span className="tuner-wordmark" aria-label="Irie Builder">
        Irie Builder
      </span>
      <nav className="tuner-nav" aria-label="Primary">
        {NAV.map((item) => {
          if ('active' in item && item.active) {
            return (
              <a key={item.label} href={item.href} className="is-active" aria-current="page">
                {item.label}
              </a>
            )
          }
          if ('action' in item && item.action) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={onExport}
                className="tuner-nav-action"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'inherit',
                  font: 'inherit',
                  padding: '0 0.875rem',
                  minHeight: 44,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                data-hover="interactive"
              >
                {item.label}
              </button>
            )
          }
          return (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="tuner-topbar-right">
        {saveStatus && saveStatus.message && (
          <span
            className={`tuner-save-status ${saveClass}`}
            role="status"
            aria-live="polite"
          >
            {saveStatus.message}
          </span>
        )}
        <button
          type="button"
          className="tuner-button is-ghost"
          onClick={onDownload}
          data-hover="interactive"
        >
          Download
        </button>
        <button
          type="button"
          className="tuner-button is-primary"
          onClick={onExport}
          data-hover="interactive"
        >
          Export
        </button>
      </div>
    </header>
  )
}
