'use client'

import { useMemo, useState } from 'react'
import type { ClassifiedSection, SectionType } from '@/lib/tuner/types'
import type { ImageObject, TextObject } from '@/lib/tuner/object-model'
import type { SelectionMode } from './TunerEditor'

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
  /** Tuner v2: sections currently expanded to reveal child object list. */
  expanded?: Set<string>
  onToggleExpand?: (sectionId: string) => void
  textsBySection?: TextObject[]
  imagesBySection?: ImageObject[]
  selectedObjectId?: string | null
  selectionMode?: SelectionMode
  onSelectText?: (id: string) => void
  onSelectImage?: (id: string) => void
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

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 3.5L9 7l-3.5 3.5" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 3.5h7M7 3.5v7" />
    </svg>
  )
}
function ImageIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="11" height="9" rx="0.5" />
      <circle cx="5" cy="6" r="0.9" />
      <path d="M2 10l3-2.5 3 2L11 7l1.5 1" />
    </svg>
  )
}

function relTime(ms?: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

export function TunerLeftRail({
  sections,
  activeId,
  onSelect,
  meta,
  expanded,
  onToggleExpand,
  textsBySection,
  imagesBySection,
  selectedObjectId,
  selectionMode,
  onSelectText,
  onSelectImage,
}: TunerLeftRailProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'text' | 'image'>('all')

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
          const time = relTime(m.lastEditedAt)
          const dirty = m.dirty
          const isExpanded = expanded?.has(section.sectionId) ?? false
          const cls = [
            'tuner-section-row',
            activeId === section.sectionId ? 'is-active' : '',
            dirty ? 'is-dirty' : '',
            isExpanded ? 'is-expanded' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const sectionTexts = textsBySection?.filter((t) => t.sectionId === section.sectionId) ?? []
          const sectionImages = imagesBySection?.filter((i) => i.sectionId === section.sectionId) ?? []
          return (
            <li key={section.sectionId}>
              <div
                className={cls}
                onClick={() => onSelect(section.sectionId)}
                role="button"
                tabIndex={0}
                aria-current={activeId === section.sectionId ? 'true' : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(section.sectionId)
                  }
                }}
                title={
                  idx < 9
                    ? `${section.label} · press ${idx + 1}`
                    : section.label
                }
              >
                {onToggleExpand ? (
                  <button
                    type="button"
                    className="tuner-section-expand"
                    aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleExpand(section.sectionId)
                    }}
                    tabIndex={-1}
                  >
                    <ChevronIcon />
                  </button>
                ) : null}
                <span className="tuner-section-icon">
                  <SectionIcon type={section.sectionType} />
                </span>
                <span className="tuner-section-label">{section.label}</span>
                {(counts || time) ? (
                  <span className="tuner-section-meta">
                    {counts ? (
                      <span className="tuner-section-count">
                        <button
                          type="button"
                          className="tuner-section-count-chip"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilter('text')
                            onToggleExpand?.(section.sectionId)
                          }}
                          title={`${counts.texts ?? 0} text objects`}
                        >
                          {counts.texts ?? 0}t
                        </button>
                        <span aria-hidden="true"> · </span>
                        <button
                          type="button"
                          className="tuner-section-count-chip"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilter('image')
                            onToggleExpand?.(section.sectionId)
                          }}
                          title={`${counts.images ?? 0} image objects`}
                        >
                          {counts.images ?? 0}i
                        </button>
                      </span>
                    ) : null}
                    {time ? <span className="tuner-section-time">{time}</span> : null}
                  </span>
                ) : null}
                <span className="tuner-section-dot" aria-hidden="true" />
              </div>
              {isExpanded ? (
                <ul className="tuner-section-children">
                  {(filter === 'all' || filter === 'text') &&
                    sectionTexts.map((t) => {
                      const active =
                        selectionMode === 'text' && selectedObjectId === t.id
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            className={`tuner-section-child${active ? ' is-active' : ''}`}
                            onClick={() => onSelectText?.(t.id)}
                            title={t.text}
                          >
                            <TextIcon />
                            <span>{t.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  {(filter === 'all' || filter === 'image') &&
                    sectionImages.map((i) => {
                      const active =
                        selectionMode === 'image' && selectedObjectId === i.id
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            className={`tuner-section-child${active ? ' is-active' : ''}`}
                            onClick={() => onSelectImage?.(i.id)}
                            title={i.alt || i.src}
                          >
                            <ImageIcon />
                            <span>{i.label}</span>
                          </button>
                        </li>
                      )
                    })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      <div className="tuner-left-shortcuts" aria-hidden="true">
        <kbd>1</kbd>–<kbd>9</kbd> jump · <kbd>[</kbd> <kbd>]</kbd> nav · <kbd>S</kbd> style
      </div>
    </aside>
  )
}
