'use client'

import { useEffect } from 'react'

export interface Toast {
  id: number
  message: string
  /** Optional shortcut hint shown after the message, e.g. "⌘Z". */
  shortcut?: string
  ttl?: number
}

interface TunerToastsProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function TunerToasts({ toasts, onDismiss }: TunerToastsProps) {
  useEffect(() => {
    const timers = toasts.map((t) =>
      window.setTimeout(() => onDismiss(t.id), t.ttl ?? 4000),
    )
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [toasts, onDismiss])

  if (toasts.length === 0) return null

  return (
    <div className="tuner-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="tuner-toast">
          <span>{t.message}</span>
          {t.shortcut ? <kbd>{t.shortcut}</kbd> : null}
        </div>
      ))}
    </div>
  )
}
