'use client'

import type { ClassifiedSection, Dial, DialGroup, Preset } from '@/lib/tuner/types'
import { TunerDial } from './TunerDial'
import { TunerPresets } from './TunerPresets'
import { TunerEmptyState } from './TunerEmptyState'

interface TunerPanelProps {
  section: ClassifiedSection | null
  group: DialGroup | null
  values: Record<string, number | string>
  onDialChange: (dial: Dial, value: number | string) => void
  onDialCommit: (dial: Dial, value: number | string) => void
  onPreset: (preset: Preset) => void
  panelKey: string
}

function readout(group: DialGroup) {
  return {
    core: group.core,
    contextual: group.contextual,
  }
}

export function TunerPanel({
  section,
  group,
  values,
  onDialChange,
  onDialCommit,
  onPreset,
  panelKey,
}: TunerPanelProps) {
  if (!section || !group) {
    return (
      <aside className="tuner-right" aria-label="Section controls">
        <h2 className="tuner-right-heading">Tune</h2>
        <p className="tuner-right-meta">Section controls</p>
        <TunerEmptyState />
      </aside>
    )
  }
  const { core, contextual } = readout(group)
  const sectionTypeLabel =
    section.sectionType === 'product-grid' ? 'Grid' : section.sectionType

  const resolveValue = (dial: Dial): number | string => {
    if (dial.id in values) return values[dial.id]
    return dial.default
  }

  return (
    <aside className="tuner-right" aria-label="Section controls" key={panelKey}>
      <h2 className="tuner-right-heading">{section.label}</h2>
      <p className="tuner-right-meta">{sectionTypeLabel}</p>

      {group.presets.length > 0 && (
        <TunerPresets presets={group.presets} onApply={onPreset} />
      )}

      <div className="tuner-group tuner-group-core">
        <h3 className="tuner-group-label">Core</h3>
        {core.map((dial) => (
          <TunerDial
            key={dial.id}
            dial={dial}
            value={resolveValue(dial)}
            onChange={(v) => onDialChange(dial, v)}
            onCommit={(v) => onDialCommit(dial, v)}
          />
        ))}
      </div>

      {contextual.length > 0 ? (
        <div className="tuner-group tuner-group-context">
          <h3 className="tuner-group-label">Contextual</h3>
          {contextual.map((dial) => (
            <TunerDial
              key={dial.id}
              dial={dial}
              value={resolveValue(dial)}
              onChange={(v) => onDialChange(dial, v)}
              onCommit={(v) => onDialCommit(dial, v)}
            />
          ))}
        </div>
      ) : (
        <p className="tuner-right-meta" style={{ marginTop: '1rem' }}>
          Core dials only for this section.
        </p>
      )}
    </aside>
  )
}
