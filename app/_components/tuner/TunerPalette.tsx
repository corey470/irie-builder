'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface PaletteAction {
  id: string
  label: string
  group?: string
  shortcut?: string
  keywords?: string
  run: () => void
  disabled?: boolean
}

interface TunerPaletteProps {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}

function score(action: PaletteAction, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const hay = (action.label + ' ' + (action.group || '') + ' ' + (action.keywords || '')).toLowerCase()
  if (hay.startsWith(q)) return 100
  if (hay.includes(q)) return 50
  // fuzzy: every char appears in order
  let i = 0
  for (const ch of hay) if (ch === q[i] && ++i === q.length) return 1
  return 0
}

export function TunerPalette({ open, actions, onClose }: TunerPaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // focus on next tick
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const filtered = useMemo(() => {
    return actions
      .filter((a) => !a.disabled)
      .map((a) => ({ a, s: score(a, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.a)
  }, [actions, query])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(filtered.length - 1, c + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = filtered[cursor]
        if (action) {
          onClose()
          action.run()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, filtered, cursor, onClose])

  // Clamp cursor when filtered shrinks
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1))
  }, [filtered.length, cursor])

  if (!open) return null

  return (
    <div className="tuner-palette-overlay" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={onClose}>
      <div className="tuner-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tuner-palette-search">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="6" cy="6" r="4" />
            <path d="M9 9l2.5 2.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            placeholder="Type a command or search…"
            aria-label="Command search"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="tuner-palette-empty">No matches</div>
        ) : (
          <ul className="tuner-palette-list" role="listbox">
            {filtered.map((action, i) => (
              <li
                key={action.id}
                role="option"
                aria-selected={i === cursor}
                className={`tuner-palette-item${i === cursor ? ' is-active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onClose()
                  action.run()
                }}
              >
                <span className="tuner-palette-item-label">{action.label}</span>
                {action.group ? (
                  <span className="tuner-palette-item-group">{action.group}</span>
                ) : null}
                {action.shortcut ? (
                  <span className="tuner-palette-item-shortcut">{action.shortcut}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
