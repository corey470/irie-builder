'use client'

import type { ClassifiedSection, SectionType } from '@/lib/tuner/types'

interface TunerLeftRailProps {
  sections: ClassifiedSection[]
  activeId: string | null
  onSelect: (sectionId: string) => void
}

/** Hand-authored inline SVG icons — no icon libraries (DESIGN.md §1). */
function SectionIcon({ type }: { type: SectionType }) {
  const stroke = 'currentColor'
  const props = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke,
    strokeWidth: 1.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'hero':
      return (
        <svg {...props}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="0.5" />
          <path d="M4 9h8M4 11h5" />
          <circle cx="4.5" cy="5.5" r="1" />
        </svg>
      )
    case 'product-grid':
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="5.5" height="5.5" />
          <rect x="9" y="1.5" width="5.5" height="5.5" />
          <rect x="1.5" y="9" width="5.5" height="5.5" />
          <rect x="9" y="9" width="5.5" height="5.5" />
        </svg>
      )
    case 'testimonial':
      return (
        <svg {...props}>
          <path d="M3 6c0-1.5 1-2.5 2.5-2.5M3 6v4h3V6M3 6h3" />
          <path d="M9.5 6c0-1.5 1-2.5 2.5-2.5M9.5 6v4h3V6M9.5 6h3" />
        </svg>
      )
    case 'pricing':
      return (
        <svg {...props}>
          <path d="M8 2v12" />
          <path d="M11 5H6.5a1.5 1.5 0 0 0 0 3H9.5a1.5 1.5 0 0 1 0 3H5" />
        </svg>
      )
    case 'cta':
      return (
        <svg {...props}>
          <rect x="1.5" y="5.5" width="13" height="5" rx="0.5" />
          <path d="M10 8l2-1.5M10 8l2 1.5" />
        </svg>
      )
    case 'trust':
      return (
        <svg {...props}>
          <path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4l5-2z" />
        </svg>
      )
    case 'footer':
      return (
        <svg {...props}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="0.5" />
          <path d="M1.5 11h13" />
          <path d="M4 13h3M9 13h3" />
        </svg>
      )
    case 'marquee':
      return (
        <svg {...props}>
          <path d="M1.5 8h13" />
          <path d="M13 6l1.5 2L13 10" />
          <path d="M3 6L1.5 8 3 10" />
        </svg>
      )
    case 'story':
      return (
        <svg {...props}>
          <path d="M3 3h7M3 6h10M3 9h8M3 12h6" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="13" height="13" />
        </svg>
      )
  }
}

export function TunerLeftRail({ sections, activeId, onSelect }: TunerLeftRailProps) {
  const count = sections.length
  return (
    <aside className="tuner-left" aria-label="Sections">
      <h1 className="tuner-left-heading">Sections</h1>
      <p className="tuner-left-meta">{count} block{count === 1 ? '' : 's'}</p>
      <ul className="tuner-section-list">
        {sections.map((section) => (
          <li key={section.sectionId}>
            <button
              type="button"
              className={`tuner-section-row${activeId === section.sectionId ? ' is-active' : ''}`}
              onClick={() => onSelect(section.sectionId)}
              aria-current={activeId === section.sectionId ? 'true' : undefined}
              data-hover="interactive"
            >
              <span className="tuner-section-icon">
                <SectionIcon type={section.sectionType} />
              </span>
              <span className="tuner-section-label">{section.label}</span>
              <span className="tuner-section-type">{section.sectionType === 'product-grid' ? 'Grid' : section.sectionType}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
