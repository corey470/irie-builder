'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MarqueeObject, MarqueeStyle } from '@/lib/tuner/object-model'

export interface TunerObjectMarqueeProps {
  target: MarqueeObject
  style: MarqueeStyle
  onChange: (patch: Partial<MarqueeStyle>) => void
  onCommit: (patch: Partial<MarqueeStyle>) => void
  onRevertObject: () => void
}

const COLOR_CHIPS: Array<{ value: NonNullable<MarqueeStyle['colorMode']>; label: string }> = [
  { value: 'cream', label: 'All cream' },
  { value: 'gold', label: 'All gold' },
  { value: 'alternating', label: 'Alternating' },
]

const FONT_CHIPS: Array<{ value: NonNullable<MarqueeStyle['font']>; label: string }> = [
  { value: 'display', label: 'Display' },
  { value: 'body', label: 'Body' },
]

export function TunerObjectMarquee({
  target,
  style,
  onChange,
  onCommit,
  onRevertObject,
}: TunerObjectMarqueeProps) {
  // Show user-edited words if present, else fall back to what annotate saw.
  const baselineText = (style.words ?? target.words).join('\n')
  const [text, setText] = useState(baselineText)

  // If the caller swaps the selected marquee (different target id), pull
  // the new baseline. We key the effect on target.id so in-panel edits
  // don't fight the typed value.
  useEffect(() => {
    setText((style.words ?? target.words).join('\n'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id])

  const speed = style.durationSeconds ?? 20
  const colorMode = style.colorMode ?? 'alternating'
  const font = style.font ?? 'display'

  const commitWords = useCallback(
    (value: string) => {
      const words = value
        .split('\n')
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
      onCommit({ words })
    },
    [onCommit],
  )

  return (
    <div className="tuner-object-panel">
      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Text — one phrase per line</h3>
        <textarea
          className="tuner-color-hex"
          style={{ minHeight: 160, fontFamily: 'var(--tool-font-mono)', fontSize: 12, padding: 8 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitWords(e.target.value)}
          placeholder={`into\nexclusive\ndrop\nfound\n...`}
          aria-label="Marquee phrases"
        />
        <p
          className="tuner-meta"
          style={{ fontSize: 11, marginTop: 4, color: 'var(--tool-text-muted)' }}
        >
          Separator: <code>{target.separator}</code>
        </p>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Speed</h3>
        <input
          type="range"
          min={10}
          max={40}
          step={1}
          value={speed}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange({ durationSeconds: v })
          }}
          onMouseUp={(e) =>
            onCommit({ durationSeconds: Number((e.target as HTMLInputElement).value) })
          }
          onTouchEnd={(e) =>
            onCommit({ durationSeconds: Number((e.target as HTMLInputElement).value) })
          }
          style={{ width: '100%' }}
          aria-label="Marquee scroll speed in seconds"
        />
        <p
          className="tuner-meta"
          style={{ fontSize: 11, marginTop: 2, color: 'var(--tool-text-muted)' }}
        >
          {speed}s per loop
        </p>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Color</h3>
        <div className="tuner-chips" role="radiogroup" aria-label="Marquee color mode">
          {COLOR_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === colorMode}
              className={`tuner-chip${opt.value === colorMode ? ' is-active' : ''}`}
              onClick={() => {
                onChange({ colorMode: opt.value })
                onCommit({ colorMode: opt.value })
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Font</h3>
        <div className="tuner-chips" role="radiogroup" aria-label="Marquee font">
          {FONT_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === font}
              className={`tuner-chip${opt.value === font ? ' is-active' : ''}`}
              onClick={() => {
                onChange({ font: opt.value })
                onCommit({ font: opt.value })
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tuner-object-section">
        <button
          type="button"
          className="tuner-object-revert"
          onClick={onRevertObject}
        >
          Revert this marquee
        </button>
      </section>
    </div>
  )
}
