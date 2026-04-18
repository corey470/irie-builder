'use client'

import { useState } from 'react'
import type { Preset } from '@/lib/tuner/types'

interface TunerPresetsProps {
  presets: Preset[]
  onApply: (preset: Preset) => void
}

export function TunerPresets({ presets, onApply }: TunerPresetsProps) {
  const [flashing, setFlashing] = useState<string | null>(null)

  return (
    <div className="tuner-presets" role="group" aria-label="Section presets">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`tuner-preset-chip${flashing === preset.id ? ' is-flashing' : ''}`}
          onClick={() => {
            setFlashing(preset.id)
            onApply(preset)
            window.setTimeout(() => setFlashing(null), 200)
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
