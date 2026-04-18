'use client'

import { useCallback, useRef } from 'react'
import { SliderField } from '@/app/_components/builder-platform'
import type { ImageObject } from '@/lib/tuner/object-model'

export interface ImageStyle {
  src?: string
  alt?: string
  objectFit?: '' | 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  borderRadius?: string
}

const FIT_CHIPS: Array<{
  value: NonNullable<ImageStyle['objectFit']>
  label: string
}> = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Fill' },
  { value: 'none', label: 'None' },
  { value: 'scale-down', label: 'Scale-down' },
]

// 3x3 object-position grid mapped to CSS keyword pairs.
const POSITION_CELLS: Array<{ value: string; label: string }> = [
  { value: 'left top', label: 'top-left' },
  { value: 'center top', label: 'top-center' },
  { value: 'right top', label: 'top-right' },
  { value: 'left center', label: 'center-left' },
  { value: 'center center', label: 'center' },
  { value: 'right center', label: 'center-right' },
  { value: 'left bottom', label: 'bottom-left' },
  { value: 'center bottom', label: 'bottom-center' },
  { value: 'right bottom', label: 'bottom-right' },
]

export interface TunerImagePanelProps {
  target: ImageObject
  style: ImageStyle
  onChange: (patch: Partial<ImageStyle>) => void
  onCommit: (patch: Partial<ImageStyle>) => void
  onRevertObject: () => void
}

export function TunerImagePanel({
  target,
  style,
  onChange,
  onCommit,
  onRevertObject,
}: TunerImagePanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleReplaceClick = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        if (!result) return
        onCommit({ src: result })
      }
      reader.readAsDataURL(file)
    },
    [onCommit],
  )

  const handleUrlChange = useCallback(
    (value: string) => {
      onChange({ src: value })
    },
    [onChange],
  )
  const handleUrlCommit = useCallback(
    (value: string) => {
      if (!value) return
      onCommit({ src: value })
    },
    [onCommit],
  )

  const fit = style.objectFit ?? ''
  const position = style.objectPosition ?? 'center center'
  const radius = style.borderRadius ?? ''
  const alt = style.alt ?? target.alt
  const src = style.src ?? target.src

  return (
    <div className="tuner-object-panel">
      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Image</h3>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tuner-image-thumb" src={src} alt={alt || ''} />
        ) : null}
        <div className="tuner-image-actions">
          <button
            type="button"
            className="tuner-image-action is-primary"
            onClick={handleReplaceClick}
          >
            Replace image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </div>
        <input
          type="text"
          className="tuner-color-hex"
          style={{ marginTop: 6 }}
          value={src}
          placeholder="https:// or paste URL"
          onChange={(e) => handleUrlChange(e.target.value)}
          onBlur={(e) => handleUrlCommit(e.target.value.trim())}
          aria-label="Image URL"
        />
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Alt text</h3>
        <input
          type="text"
          className="tuner-color-hex"
          value={alt}
          placeholder="Describe this image"
          onChange={(e) => onChange({ alt: e.target.value })}
          onBlur={(e) => onCommit({ alt: e.target.value })}
          aria-label="Alt text"
        />
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Fit</h3>
        <div className="tuner-chips" role="radiogroup" aria-label="Object fit">
          {FIT_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === fit}
              className={`tuner-chip${opt.value === fit ? ' is-active' : ''}`}
              onClick={() => {
                onChange({ objectFit: opt.value })
                onCommit({ objectFit: opt.value })
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Crop focus</h3>
        <div
          className="tuner-position-grid"
          role="radiogroup"
          aria-label="Object position"
        >
          {POSITION_CELLS.map((cell) => (
            <button
              key={cell.value}
              type="button"
              role="radio"
              aria-checked={cell.value === position}
              className={`tuner-position-dot${
                cell.value === position ? ' is-active' : ''
              }`}
              onClick={() => {
                onChange({ objectPosition: cell.value })
                onCommit({ objectPosition: cell.value })
              }}
              title={cell.label}
              aria-label={cell.label}
            />
          ))}
        </div>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Corner radius</h3>
        <SliderField
          label="Radius"
          value={radius}
          unit="px"
          min={0}
          max={40}
          step={1}
          fallback={0}
          onChange={(next) => {
            onChange({ borderRadius: next })
            onCommit({ borderRadius: next })
          }}
        />
      </section>

      <section className="tuner-object-section">
        <button
          type="button"
          className="tuner-object-revert"
          onClick={onRevertObject}
        >
          Revert this image
        </button>
      </section>
    </div>
  )
}
