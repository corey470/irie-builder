'use client'

import { SliderField } from '@/app/_components/builder-platform'

export interface SectionStyleOverrides {
  paddingTop?: string
  paddingBottom?: string
  backgroundColor?: string
  backgroundImage?: string
  /** '0' — '1' as string for SliderField compat. */
  overlayOpacity?: string
}

export interface TunerSectionStylePanelProps {
  sectionId: string
  style: SectionStyleOverrides
  onChange: (patch: Partial<SectionStyleOverrides>) => void
  onCommit: (patch: Partial<SectionStyleOverrides>) => void
  onRevertObject: () => void
}

export function TunerSectionStylePanel({
  style,
  onChange,
  onCommit,
  onRevertObject,
}: TunerSectionStylePanelProps) {
  const paddingTop = style.paddingTop ?? ''
  const paddingBottom = style.paddingBottom ?? ''
  const bgColor = style.backgroundColor ?? ''
  const bgImage = style.backgroundImage ?? ''
  const overlay = style.overlayOpacity ?? '0.25'

  return (
    <div className="tuner-object-panel">
      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Padding</h3>
        <p className="tuner-object-hint">
          Absolute pixel overrides. Tuner&apos;s scale multiplier still applies
          if no override is set.
        </p>
        <SliderField
          label="Padding top"
          value={paddingTop}
          unit="px"
          min={0}
          max={240}
          step={4}
          fallback={48}
          onChange={(next) => {
            onChange({ paddingTop: next })
            onCommit({ paddingTop: next })
          }}
        />
        <SliderField
          label="Padding bottom"
          value={paddingBottom}
          unit="px"
          min={0}
          max={240}
          step={4}
          fallback={48}
          onChange={(next) => {
            onChange({ paddingBottom: next })
            onCommit({ paddingBottom: next })
          }}
        />
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Background</h3>
        <div className="tuner-color-row">
          <span className="tuner-color-label">Color</span>
          <input
            type="color"
            className="tuner-color-swatch"
            value={bgColor || '#0a0a0a'}
            onChange={(e) => {
              onChange({ backgroundColor: e.target.value })
              onCommit({ backgroundColor: e.target.value })
            }}
            aria-label="Background color"
          />
          <input
            type="text"
            className="tuner-color-hex"
            value={bgColor}
            placeholder="#0a0a0a"
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v === '' || /^#[0-9a-fA-F]{3,6}$/.test(v)) {
                onCommit({ backgroundColor: v })
              }
            }}
          />
        </div>
        <div className="tuner-color-row" style={{ marginTop: 6 }}>
          <span className="tuner-color-label">Image URL</span>
          <input
            type="text"
            className="tuner-color-hex"
            value={bgImage}
            placeholder="https://…"
            onChange={(e) => onChange({ backgroundImage: e.target.value })}
            onBlur={(e) => onCommit({ backgroundImage: e.target.value.trim() })}
          />
          {bgImage ? (
            <button
              type="button"
              className="tuner-chip is-clear"
              onClick={() => {
                onChange({ backgroundImage: '' })
                onCommit({ backgroundImage: '' })
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
        {bgImage ? (
          <SliderField
            label="Overlay opacity"
            value={overlay}
            unit=""
            min={0}
            max={1}
            step={0.05}
            fallback={0.25}
            onChange={(next) => {
              onChange({ overlayOpacity: next })
              onCommit({ overlayOpacity: next })
            }}
          />
        ) : null}
      </section>

      <section className="tuner-object-section">
        <button
          type="button"
          className="tuner-object-revert"
          onClick={onRevertObject}
        >
          Revert section style
        </button>
      </section>
    </div>
  )
}
