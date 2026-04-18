'use client'

import { useEffect, useState } from 'react'
import type { PersistenceStatus } from '@/lib/persistence/status'

interface TunerSaveBarProps {
  status: PersistenceStatus | undefined
}

/**
 * 2px gold progress strip across the top of the screen during save.
 * On save start: 0 → 80% over ~1.4s (asymptotic — feels honest, not fake)
 * On save success: 80% → 100% over 200ms then fades.
 */
export function TunerSaveBar({ status }: TunerSaveBarProps) {
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (status === 'saving') {
      setOpacity(1)
      setWidth(0)
      // ramp to 80
      const t1 = window.setTimeout(() => !cancelled && setWidth(80), 16)
      return () => {
        cancelled = true
        window.clearTimeout(t1)
      }
    }
    if (status === 'saved') {
      setWidth(100)
      const t2 = window.setTimeout(() => !cancelled && setOpacity(0), 220)
      const t3 = window.setTimeout(() => {
        if (!cancelled) setWidth(0)
      }, 600)
      return () => {
        cancelled = true
        window.clearTimeout(t2)
        window.clearTimeout(t3)
      }
    }
    if (status === 'error') {
      setOpacity(0)
      setWidth(0)
    }
  }, [status])

  return (
    <div
      className="tuner-save-bar"
      style={{
        width: `${width}vw`,
        opacity,
        transitionDuration:
          status === 'saving' ? '1400ms' : status === 'saved' ? '220ms' : '0ms',
      }}
      aria-hidden="true"
    />
  )
}
