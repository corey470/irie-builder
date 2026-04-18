'use client'

import { useEffect, useRef, useState } from 'react'

export interface TunerAccentPopoverProps {
  open: boolean
  accent: string
  /** Seed swatches from the generation palette. */
  palette: string[]
  onRequestOpen: () => void
  onClose: () => void
  onChange: (next: string) => void
  onCommit: (next: string) => void
}

const DEFAULT_PRESETS = ['#C9A84C', '#F2EDE4', '#FAFAF7', '#0A0A0A']
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function TunerAccentPopover({
  open,
  accent,
  palette,
  onRequestOpen,
  onClose,
  onChange,
  onCommit,
}: TunerAccentPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [hexDraft, setHexDraft] = useState(accent)

  useEffect(() => {
    setHexDraft(accent)
  }, [accent])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  // Merge presets with palette seeds, de-duplicated.
  const presets = Array.from(
    new Set([...DEFAULT_PRESETS, ...palette.filter((p) => HEX_PATTERN.test(p))]),
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="tuner-accent-button"
        onClick={onRequestOpen}
        aria-label="Accent color"
        aria-expanded={open}
        title="Accent color"
      >
        <span
          className="tuner-accent-swatch"
          style={{ background: accent }}
        />
      </button>
      {open ? (
        <div className="tuner-accent-popover" role="dialog" aria-label="Accent color">
          <div className="tuner-accent-row">
            <span
              className="tuner-color-swatch"
              style={{ background: accent, cursor: 'default' }}
              aria-hidden="true"
            />
            <input
              type="color"
              className="tuner-color-swatch"
              value={accent}
              onChange={(e) => onChange(e.target.value)}
              onBlur={(e) => onCommit(e.target.value)}
              aria-label="Pick accent"
            />
            <input
              type="text"
              className="tuner-color-hex"
              value={hexDraft}
              onChange={(e) => {
                setHexDraft(e.target.value)
                if (HEX_PATTERN.test(e.target.value)) onChange(e.target.value)
              }}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (HEX_PATTERN.test(v)) onCommit(v)
                else setHexDraft(accent)
              }}
              placeholder="#c9a84c"
              spellCheck={false}
            />
          </div>
          <div className="tuner-accent-preset-row">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`tuner-accent-preset${p.toLowerCase() === accent.toLowerCase() ? ' is-active' : ''}`}
                style={{ background: p }}
                onClick={() => {
                  onChange(p)
                  onCommit(p)
                }}
                aria-label={`Accent ${p}`}
                title={p}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
