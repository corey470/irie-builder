'use client'

import { forwardRef, useState } from 'react'

type Viewport = 'mobile' | 'desktop'

interface TunerPreviewFrameProps {
  html: string
  onLoad: () => void
}

const WIDTHS: Record<Viewport, number> = {
  mobile: 375,
  desktop: 1440,
}

export const TunerPreviewFrame = forwardRef<HTMLIFrameElement, TunerPreviewFrameProps>(
  function TunerPreviewFrame({ html, onLoad }, ref) {
    const [viewport, setViewport] = useState<Viewport>('desktop')
    const width = WIDTHS[viewport]

    return (
      <section className="tuner-main" aria-label="Preview">
        <div className="tuner-viewport-bar">
          <div
            className="tuner-viewport-toggle"
            role="radiogroup"
            aria-label="Preview viewport"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewport === 'mobile'}
              className={viewport === 'mobile' ? 'is-active' : ''}
              onClick={() => setViewport('mobile')}
              data-hover="interactive"
            >
              Mobile
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewport === 'desktop'}
              className={viewport === 'desktop' ? 'is-active' : ''}
              onClick={() => setViewport('desktop')}
              data-hover="interactive"
            >
              Desktop
            </button>
          </div>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(242,237,228,0.45)',
              fontWeight: 500,
            }}
            aria-hidden="true"
          >
            {width}px
          </span>
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
