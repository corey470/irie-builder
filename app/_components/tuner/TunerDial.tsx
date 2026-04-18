'use client'

import { useCallback } from 'react'
import type { Dial } from '@/lib/tuner/types'

interface TunerDialProps {
  dial: Dial
  value: number | string
  onChange: (next: number | string) => void
  onCommit?: (final: number | string) => void
  onReset?: () => void
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4.5A4 4 0 1 0 12 8" />
      <path d="M11 1.5v3h-3" />
    </svg>
  )
}

function formatSlider(dial: Extract<Dial, { type: 'slider' }>, value: number): string {
  if (dial.format) return dial.format(value)
  return dial.unit ? `${value}${dial.unit}` : String(value)
}

function dialIsChanged(dial: Dial, value: number | string): boolean {
  if (dial.type === 'slider') {
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
    return Number.isFinite(n) ? n !== dial.default : false
  }
  return String(value) !== String(dial.default)
}

export function TunerDial({ dial, value, onChange, onCommit, onReset }: TunerDialProps) {
  const handleSliderInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number.parseFloat(event.target.value))
    },
    [onChange],
  )
  const handleSliderCommit = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      if (onCommit) onCommit(Number.parseFloat(event.currentTarget.value))
    },
    [onCommit],
  )

  const changed = dialIsChanged(dial, value)
  const dialCls = `tuner-dial${changed ? ' is-changed' : ''}`

  if (dial.type === 'slider') {
    const numValue = typeof value === 'number' ? value : Number.parseFloat(String(value))
    const safeValue = Number.isFinite(numValue) ? numValue : dial.default
    return (
      <div className={dialCls}>
        <div className="tuner-dial-header">
          <span className="tuner-dial-label">
            {dial.label}
            <span className="tuner-dial-changed" aria-hidden="true" />
          </span>
          <span className="tuner-dial-actions">
            <span className={`tuner-dial-readout${changed ? ' is-tuned' : ''}`} aria-hidden="true">
              {formatSlider(dial, safeValue)}
            </span>
            {changed && onReset ? (
              <button
                type="button"
                className="tuner-dial-reset"
                onClick={onReset}
                aria-label={`Reset ${dial.label}`}
                title={`Reset to ${formatSlider(dial, dial.default)}`}
              >
                <ResetIcon />
              </button>
            ) : null}
          </span>
        </div>
        <div className="tuner-slider-wrap">
          <input
            type="range"
            className="tuner-slider"
            min={dial.min}
            max={dial.max}
            step={dial.step}
            value={safeValue}
            onChange={handleSliderInput}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            onKeyUp={handleSliderCommit}
            aria-label={`${dial.label} — ${formatSlider(dial, safeValue)}`}
          />
        </div>
        <span className="tuner-dial-hint" aria-hidden="true">
          <kbd>←</kbd><kbd>→</kbd> ±{dial.step} · <kbd>⇧</kbd>×10
        </span>
      </div>
    )
  }

  if (dial.type === 'chips') {
    const current = String(value)
    const activeLabel =
      dial.options.find((o) => o.value === current)?.label ?? current
    return (
      <div className={dialCls}>
        <div className="tuner-dial-header">
          <span className="tuner-dial-label">
            {dial.label}
            <span className="tuner-dial-changed" aria-hidden="true" />
          </span>
          <span className="tuner-dial-actions">
            <span className={`tuner-dial-readout${changed ? ' is-tuned' : ''}`} aria-hidden="true">
              {activeLabel}
            </span>
            {changed && onReset ? (
              <button
                type="button"
                className="tuner-dial-reset"
                onClick={onReset}
                aria-label={`Reset ${dial.label}`}
                title="Reset to default"
              >
                <ResetIcon />
              </button>
            ) : null}
          </span>
        </div>
        <div className="tuner-chips" role="radiogroup" aria-label={dial.label}>
          {dial.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === current}
              className={`tuner-chip${option.value === current ? ' is-active' : ''}`}
              onClick={() => {
                onChange(option.value)
                if (onCommit) onCommit(option.value)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="tuner-dial-hint" aria-hidden="true">
          <kbd>↵</kbd> next option
        </span>
      </div>
    )
  }

  // Toggle
  const isOn = String(value) === 'on'
  return (
    <div className={dialCls}>
      <div className="tuner-dial-header">
        <span className="tuner-dial-label">
          {dial.label}
          <span className="tuner-dial-changed" aria-hidden="true" />
        </span>
        <span className="tuner-dial-actions">
          <span className={`tuner-dial-readout${changed ? ' is-tuned' : ''}`} aria-hidden="true">
            {isOn ? 'On' : 'Off'}
          </span>
          {changed && onReset ? (
            <button
              type="button"
              className="tuner-dial-reset"
              onClick={onReset}
              aria-label={`Reset ${dial.label}`}
              title="Reset to default"
            >
              <ResetIcon />
            </button>
          ) : null}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={dial.label}
        className={`tuner-toggle${isOn ? ' is-on' : ''}`}
        onClick={() => {
          const next = isOn ? 'off' : 'on'
          onChange(next)
          if (onCommit) onCommit(next)
        }}
      >
        <span className="tuner-toggle-track">
          <span className="tuner-toggle-knob" />
        </span>
        <span className="tuner-toggle-label">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}
