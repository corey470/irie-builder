'use client'

import type { ClassifiedSection } from '@/lib/tuner/types'

interface TunerMobileDrawerProps {
  sections: ClassifiedSection[]
  activeId: string | null
  isOpen: boolean
  onToggle: () => void
  onSelect: (sectionId: string) => void
}

/**
 * Mobile: 56px persistent bar at the top with horizontal section picker.
 * A drag handle + "Tune" title rides above the right-panel when open.
 * Drawer slide is handled purely via tuner.css; this only renders handles.
 */
export function TunerMobileDrawer({
  sections,
  activeId,
  isOpen,
  onToggle,
  onSelect,
}: TunerMobileDrawerProps) {
  const active = sections.find((s) => s.sectionId === activeId)
  return (
    <>
      <div className="tuner-drawer-bar" aria-label="Section picker">
        <div className="tuner-mobile-section-picker" role="tablist">
          {sections.map((section) => (
            <button
              key={section.sectionId}
              type="button"
              role="tab"
              aria-selected={activeId === section.sectionId}
              className={activeId === section.sectionId ? 'is-active' : ''}
              onClick={() => onSelect(section.sectionId)}
              data-hover="interactive"
            >
              {section.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close dials' : 'Open dials'}
          className="tuner-button is-ghost"
          style={{ minHeight: 44 }}
          data-hover="interactive"
        >
          {isOpen ? 'Close' : 'Tune'}
        </button>
      </div>
      {/* Handle + peek title live inside the drawer. Handle toggles open/closed. */}
      <button
        type="button"
        className="tuner-drawer-handle"
        onClick={onToggle}
        aria-label={isOpen ? 'Close dial drawer' : 'Open dial drawer'}
      />
      <div className="tuner-drawer-peek" aria-hidden="true">
        <span className="tuner-drawer-peek-title">
          {active?.label ?? 'Tune'}
        </span>
        <span className="tuner-drawer-peek-meta">
          {isOpen ? 'Drag to close' : 'Drag to open'}
        </span>
      </div>
    </>
  )
}
