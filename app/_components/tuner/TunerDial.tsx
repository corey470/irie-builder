'use client'

import { useCallback } from 'react'
import type { Dial } from '@/lib/tuner/types'

interface TunerDialProps {
  dial: Dial
  value: number | string
  onChange: (next: number | string) => void
  onCommit?: (final: number | string) => void
}

function formatSlider(dial: Extract<Dial, { type: 'slider' }>, value: number): string {
  if (dial.format) return dial.format(value)
  return dial.unit ? `${value}${dial.unit}` : String(value)
}

export function TunerDial({ dial, value, onChange, onCommit }: TunerDialProps) {
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

  if (dial.type === 'slider') {
    const numValue = typeof value === 'number' ? value : Number.parseFloat(String(value))
    const tuned = numValue !== dial.default
    return (
      <div className="tuner-dial">
        <div className="tuner-dial-header">
          <span className="tuner-dial-label">{dial.label}</span>
          <span className={`tuner-dial-readout${tuned ? ' is-tuned' : ''}`} aria-hidden="true">
            {formatSlider(dial, Number.isFinite(numValue) ? numValue : dial.default)}
          </span>
        </div>
        <div className="tuner-slider-wrap">
          <input
            type="range"
            className="tuner-slider"
            min={dial.min}
            max={dial.max}
            step={dial.step}
            value={Number.isFinite(numValue) ? numValue : dial.default}
            onChange={handleSliderInput}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            onKeyUp={handleSliderCommit}
            aria-label={`${dial.label} — ${formatSlider(dial, Number.isFinite(numValue) ? numValue : dial.default)}`}
            data-hover="interactive"
          />
        </div>
      </div>
    )
  }

  if (dial.type === 'chips') {
    const current = String(value)
    const tuned = current !== dial.default
    const activeLabel =
      dial.options.find((o) => o.value === current)?.label ?? current
    return (
      <div className="tuner-dial">
        <div className="tuner-dial-header">
          <span className="tuner-dial-label">{dial.label}</span>
          <span className={`tuner-dial-readout${tuned ? ' is-tuned' : ''}`} aria-hidden="true">
            {activeLabel}
          </span>
        </div>
        <div
          className="tuner-chips"
          role="radiogroup"
          aria-label={dial.label}
        >
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
              data-hover="interactive"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Toggle
  const isOn = String(value) === 'on'
  const tuned = (isOn ? 'on' : 'off') !== dial.default
  return (
    <div className="tuner-dial">
      <div className="tuner-dial-header">
        <span className="tuner-dial-label">{dial.label}</span>
        <span className={`tuner-dial-readout${tuned ? ' is-tuned' : ''}`} aria-hidden="true">
          {isOn ? 'On' : 'Off'}
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
        data-hover="interactive"
      >
        <span className="tuner-toggle-track">
          <span className="tuner-toggle-knob" />
        </span>
        <span className="tuner-toggle-label">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}
