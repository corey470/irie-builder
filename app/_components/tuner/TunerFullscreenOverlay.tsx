'use client'

export interface TunerFullscreenOverlayProps {
  html: string
  onClose: () => void
}

/**
 * Sandboxed full-viewport preview. Replaces the pre-Tuner `window.open()`
 * pattern — we keep the same `sandbox="allow-same-origin"` scope the main
 * preview uses. Escape closes; top-bar exit button closes.
 */
export function TunerFullscreenOverlay({ html, onClose }: TunerFullscreenOverlayProps) {
  return (
    <div
      className="tuner-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen preview"
    >
      <div className="tuner-fullscreen-bar">
        <span className="tuner-fullscreen-title">Fullscreen preview · Esc to close</span>
        <button type="button" className="tuner-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <iframe
        title="Fullscreen preview"
        className="tuner-fullscreen-frame"
        sandbox="allow-same-origin"
        srcDoc={html}
      />
    </div>
  )
}
