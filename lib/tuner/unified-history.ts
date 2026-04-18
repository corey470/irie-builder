/**
 * Tuner v2 — Unified undo/redo stack
 *
 * One stack for every edit type the user can perform in /edit:
 *   - 'tuner'        — section dial value change
 *   - 'tuner-preset' — preset application (multi-dial)
 *   - 'text'         — contenteditable textContent change
 *   - 'text-style'   — typography / color / align / font family chip / radius
 *   - 'image'        — src replace OR alt OR fit / radius / object-position
 *   - 'style'        — section-style (px padding, bg color, bg image, overlay)
 *   - 'accent'       — CSS variable accent change
 *
 * Every entry carries an `apply(doc)` and a `revert(doc)`. ⌘Z calls revert;
 * ⇧⌘Z calls apply again. Per-field revert icons push a revert-to-default
 * entry so ⌘Z can undo the revert too.
 *
 * The stack lives in memory (matches pre-Tuner behavior). Refresh restores
 * from the baked final_html, not from history.
 */

export type HistoryKind =
  | 'tuner'
  | 'tuner-preset'
  | 'text'
  | 'text-style'
  | 'image'
  | 'style'
  | 'accent'

export interface HistoryEntry {
  kind: HistoryKind
  /**
   * Short label shown in toasts. Optional.
   */
  label?: string
  /**
   * Re-run the change (used during redo). Should leave the DOM in the
   * `after` state.
   */
  apply: (doc: Document) => void
  /**
   * Walk back to the `before` state. Used during undo.
   */
  revert: (doc: Document) => void
  /**
   * Hook fired after apply/revert to notify the outer component of
   * state-shape changes (so React state mirrors DOM).
   */
  onApplyState?: () => void
  onRevertState?: () => void
}

export interface HistoryControls {
  push: (entry: HistoryEntry) => void
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  /** Read the current depth — useful for UI dimming or tests. */
  depth: () => { undo: number; redo: number }
  /** Wipe both stacks (e.g. when switching generations). */
  clear: () => void
}

export function createUnifiedHistory(
  getDoc: () => Document | null,
  limit = 80,
): HistoryControls {
  const undoStack: HistoryEntry[] = []
  const redoStack: HistoryEntry[] = []

  function push(entry: HistoryEntry): void {
    undoStack.push(entry)
    if (undoStack.length > limit) undoStack.shift()
    // New edit invalidates the redo lineage.
    redoStack.length = 0
  }

  function undo(): boolean {
    const entry = undoStack.pop()
    if (!entry) return false
    const doc = getDoc()
    if (!doc) {
      // Document is gone (iframe unmounted) — drop the entry rather than
      // pollute the redo stack with something we can't reapply either.
      return false
    }
    entry.revert(doc)
    entry.onRevertState?.()
    redoStack.push(entry)
    if (redoStack.length > limit) redoStack.shift()
    return true
  }

  function redo(): boolean {
    const entry = redoStack.pop()
    if (!entry) return false
    const doc = getDoc()
    if (!doc) return false
    entry.apply(doc)
    entry.onApplyState?.()
    undoStack.push(entry)
    if (undoStack.length > limit) undoStack.shift()
    return true
  }

  return {
    push,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    depth: () => ({ undo: undoStack.length, redo: redoStack.length }),
    clear: () => {
      undoStack.length = 0
      redoStack.length = 0
    },
  }
}
