'use client'

import type { ClassifiedSection, Dial, DialGroup, Preset, SectionType } from '@/lib/tuner/types'
import { TunerDial } from './TunerDial'
import { TunerPresets } from './TunerPresets'
import { TunerEmptyState } from './TunerEmptyState'

interface TunerPanelProps {
  section: ClassifiedSection | null
  group: DialGroup | null
  values: Record<string, number | string>
  onDialChange: (dial: Dial, value: number | string) => void
  onDialCommit: (dial: Dial, value: number | string) => void
  onDialReset?: (dial: Dial) => void
  onPreset: (preset: Preset) => void
  onRevertSection?: () => void
  onRevertAll?: () => void
  panelKey: string
  /** Optional extra UI rendered at the right of the header (mode chips). */
  extraHeader?: React.ReactNode
}

function SectionBadgeIcon({ type }: { type: SectionType }) {
  const props = {
    width: 10,
    height: 10,
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'product-grid':
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="4.5" height="4.5" />
          <rect x="8" y="1.5" width="4.5" height="4.5" />
          <rect x="1.5" y="8" width="4.5" height="4.5" />
          <rect x="8" y="8" width="4.5" height="4.5" />
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

export function TunerPanel({
  section,
  group,
  values,
  onDialChange,
  onDialCommit,
  onDialReset,
  onPreset,
  onRevertSection,
  onRevertAll,
  panelKey,
  extraHeader,
}: TunerPanelProps) {
  if (!section || !group) {
    return (
      <aside className="tuner-right" aria-label="Section controls">
        <div className="tuner-right-body">
          <TunerEmptyState />
        </div>
      </aside>
    )
  }
  const { core, contextual } = group
  const sectionTypeLabel =
    section.sectionType === 'product-grid' ? 'grid' : section.sectionType

  const resolveValue = (dial: Dial): number | string => {
    if (dial.id in values) return values[dial.id]
    return dial.default
  }

  return (
    <aside className="tuner-right" aria-label="Section controls" key={panelKey}>
      <header className="tuner-right-header">
        <span className="tuner-section-badge">
          <SectionBadgeIcon type={section.sectionType} />
          {sectionTypeLabel}
        </span>
        <h2 className="tuner-right-title">{section.label}</h2>
        {extraHeader}
      </header>

      <div className="tuner-right-body">
        {group.presets.length > 0 && (
          <TunerPresets presets={group.presets} onApply={onPreset} />
        )}

        <div className="tuner-group">
          <h3 className="tuner-group-label">Core</h3>
          {core.map((dial) => (
            <TunerDial
              key={dial.id}
              dial={dial}
              value={resolveValue(dial)}
              onChange={(v) => onDialChange(dial, v)}
              onCommit={(v) => onDialCommit(dial, v)}
              onReset={onDialReset ? () => onDialReset(dial) : undefined}
            />
          ))}
        </div>

        {contextual.length > 0 ? (
          <div className="tuner-group">
            <h3 className="tuner-group-label">Contextual</h3>
            {contextual.map((dial) => (
              <TunerDial
                key={dial.id}
                dial={dial}
                value={resolveValue(dial)}
                onChange={(v) => onDialChange(dial, v)}
                onCommit={(v) => onDialCommit(dial, v)}
                onReset={onDialReset ? () => onDialReset(dial) : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>

      <footer className="tuner-right-footer">
        <button type="button" onClick={onRevertSection} title="Revert this section to generated">
          Revert section
        </button>
        <button type="button" onClick={onRevertAll} title="Revert all tuner edits in this project">
          Revert all edits
        </button>
        <p className="tuner-keybd-legend">
          <kbd>←</kbd><kbd>→</kbd> ±1 · <kbd>⇧</kbd>±10 · <kbd>Tab</kbd> next dial · <kbd>?</kbd> help
        </p>
      </footer>
    </aside>
  )
}
