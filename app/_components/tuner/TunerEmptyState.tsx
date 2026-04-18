export function TunerEmptyState() {
  return (
    <div className="tuner-empty" role="status">
      <p>Tap a section or press 1-9 to start tuning.</p>
      <div className="tuner-empty-shortcuts" aria-label="Keyboard shortcuts">
        <div><kbd>1</kbd>–<kbd>9</kbd><span>Jump to section</span></div>
        <div><kbd>K</kbd><span>Command palette (with Cmd/Ctrl)</span></div>
        <div><kbd>Z</kbd><span>Undo (with Cmd/Ctrl)</span></div>
        <div><kbd>S</kbd><span>Save now (with Cmd/Ctrl)</span></div>
        <div><kbd>?</kbd><span>All shortcuts</span></div>
      </div>
    </div>
  )
}
