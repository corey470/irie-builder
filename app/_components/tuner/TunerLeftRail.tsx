'use client'

import { useMemo, useState } from 'react'
import type { ClassifiedSection, SectionType } from '@/lib/tuner/types'

export interface SectionMeta {
  /** Number of editable elements per section (texts/images). Optional. */
  counts?: { texts?: number; images?: number }
  /** Last edited time (ms epoch). */
  lastEditedAt?: number
  /** True when this section has tuner edits relative to original. */
  dirty?: boolean
}

interface TunerLeftRailProps {
  sections: ClassifiedSection[]
  activeId: string | null
  onSelect: (sectionId: string) => void
  meta?: Record<string, SectionMeta>
}

/* Inline icons. No icon library. */
function SectionIcon({ type }: { type: SectionType }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'hero':
      return (
        <svg {...props}>
          <rect x="1.5" y="2" width="11" height="10" rx="0.5" />
          <path d="M3.5 8h7M3.5 10h4" />
          <circle cx="4" cy="5" r="1" />
        </svg>
      )
    case 'product-grid':
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="4.5" height="4.5" />
          <rect x="8" y="1.5" width="4.5" height="4.5" />
          <rect x="1.5" y="8" width="4.5" height="4.5" />
          <rect x="8" y="8" width="4.5" height="4.5" />
        </svg>
      )
    case 'testimonial':
      return (
        <svg {...props}>
          <path d="M3 5.5c0-1.4 1-2.5 2.3-2.5M3 5.5v3.5h2.5V5.5M3 5.5h2.5" />
          <path d="M8.5 5.5c0-1.4 1-2.5 2.3-2.5M8.5 5.5v3.5H11V5.5M8.5 5.5H11" />
        </svg>
      )
    case 'pricing':
      return (
        <svg {...props}>
          <path d="M7 1.5v11" />
          <path d="M9.5 4.5H6a1.4 1.4 0 0 0 0 2.8H8a1.4 1.4 0 0 1 0 2.8H4.5" />
        </svg>
      )
    case 'cta':
      return (
        <svg {...props}>
          <rect x="1.5" y="5" width="11" height="4" rx="0.5" />
          <path d="M9 7l1.6-1.2M9 7l1.6 1.2" />
        </svg>
      )
    case 'trust':
      return (
        <svg {...props}>
          <path d="M7 1.5l4 1.5v3.5c0 2.6-2 4.4-4 5-2-0.6-4-2.4-4-5V3l4-1.5z" />
        </svg>
      )
    case 'footer':
      return (
        <svg {...props}>
          <rect x="1.5" y="2" width="11" height="10" rx="0.5" />
          <path d="M1.5 9.5h11" />
          <path d="M3.5 11.2h2.4M8.1 11.2h2.4" />
        </svg>
      )
    case 'marquee':
      return (
        <svg {...props}>
          <path d="M1.5 7h11" />
          <path d="M11 5.5L12.5 7 11 8.5" />
          <path d="M3 5.5L1.5 7 3 8.5" />
        </svg>
      )
    case 'story':
      return (
        <svg {...props}>
          <path d="M2.5 2.5h7M2.5 5h9M2.5 7.5h7.5M2.5 10h6" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="11" height="11" />
        </svg>
      )
  }
}

function relTime(ms?: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

export function TunerLeftRail({ sections, activeId, onSelect, meta }: TunerLeftRailProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.sectionType.toLowerCase().includes(q),
    )
  }, [sections, query])

  return (
    <aside className="tuner-left" aria-label="Sections">
      <div className="tuner-left-header">
        <span className="tuner-left-title">Sections</span>
        <span className="tuner-left-count">{sections.length}</span>
      </div>
      <div className="tuner-left-search">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="6" cy="6" r="4" />
          <path d="M9 9l2.5 2.5" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter sections"
        />
      </div>
      <ul className="tuner-section-list">
        {filtered.map((section, idx) => {
          const m = meta?.[section.sectionId] ?? {}
          const counts = m.counts
          const countLabel = counts
            ? `${counts.texts ?? 0}t · ${counts.images ?? 0}i`
            : ''
          const time = relTime(m.lastEditedAt)
          const dirty = m.dirty
          const cls = [
            'tuner-section-row',
            activeId === section.sectionId ? 'is-active' : '',
            dirty ? 'is-dirty' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={section.sectionId}>
              <button
                type="button"
                className={cls}
                onClick={() => onSelect(section.sectionId)}
                aria-current={activeId === section.sectionId ? 'true' : undefined}
                title={
                  idx < 9
                    ? `${section.label} · press ${idx + 1}`
                    : section.label
                }
              >
                <span className="tuner-section-icon">
                  <SectionIcon type={section.sectionType} />
                </span>
                <span className="tuner-section-label">{section.label}</span>
                {(countLabel || time) ? (
                  <span className="tuner-section-meta">
                    {countLabel ? <span className="tuner-section-count">{countLabel}</span> : null}
                    {time ? <span className="tuner-section-time">{time}</span> : null}
                  </span>
                ) : null}
                <span className="tuner-section-dot" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="tuner-left-shortcuts" aria-hidden="true">
        <kbd>1</kbd>–<kbd>9</kbd> jump · <kbd>[</kbd> <kbd>]</kbd> nav
      </div>
    </aside>
  )
}
