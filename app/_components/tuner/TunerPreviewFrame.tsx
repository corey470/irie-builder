'use client'

import { forwardRef } from 'react'

export type Viewport = 'mobile' | 'tablet' | 'desktop'

interface TunerPreviewFrameProps {
  html: string
  onLoad: () => void
  viewport: Viewport
}

const WIDTHS: Record<Viewport, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
}

export const TunerPreviewFrame = forwardRef<HTMLIFrameElement, TunerPreviewFrameProps>(
  function TunerPreviewFrame({ html, onLoad, viewport }, ref) {
    const width = WIDTHS[viewport]

    return (
      <section className="tuner-main" aria-label="Preview">
        <div className="tuner-ruler" aria-hidden="true">
          <span>0</span>
          <div className="tuner-ruler-marks" />
          <span>{width}px</span>
        </div>
        <div className="tuner-frame-wrap">
          <div
            className="tuner-frame-shell"
            style={{ width: `min(100%, ${width}px)` }}
          >
            <iframe
              ref={ref}
              title="Tuner preview"
              className="tuner-frame"
              sandbox="allow-same-origin"
              srcDoc={html}
              onLoad={onLoad}
            />
          </div>
        </div>
      </section>
    )
  },
)
