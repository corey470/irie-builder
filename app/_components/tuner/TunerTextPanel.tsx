'use client'

import { useCallback } from 'react'
import { SliderField } from '@/app/_components/builder-platform'
import type { TextObject } from '@/lib/tuner/object-model'

/**
 * Shape of styling we persist per text element. Mirrors the pre-Tuner
 * EditableTextStyle — strings so they can be written straight into
 * element.style. Missing keys fall back to the generator's original value.
 */
export interface TextStyle {
  fontFamilyKind?: '' | 'display' | 'body' | 'mono'
  fontWeight?: '' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  fontSize?: string
  lineHeight?: string
  letterSpacing?: string
  color?: string
  textAlign?: '' | 'left' | 'center' | 'right' | 'justify'
  // CTA-only fields
  backgroundColor?: string
  borderColor?: string
  borderRadius?: string
  paddingInline?: string
  paddingBlock?: string
}

/**
 * Map the constrained font chip choice → an actual CSS font-family stack.
 * Decision 3B: no free-range font select. These map to the DESIGN.md tokens
 * (Playfair for display, Syne for body) but are applied INSIDE the iframe
 * only. The chip labels in chrome remain system UI.
 */
export const FONT_FAMILY_STACKS: Record<
  NonNullable<TextStyle['fontFamilyKind']>,
  string
> = {
  '': '',
  display: "'Playfair Display', serif",
  body: "'Syne', sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
}

const ALIGN_CHIPS: Array<{ value: NonNullable<TextStyle['textAlign']>; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
]

const WEIGHT_CHIPS: Array<{ value: NonNullable<TextStyle['fontWeight']>; label: string }> = [
  { value: '300', label: '300' },
  { value: '400', label: '400' },
  { value: '500', label: '500' },
  { value: '600', label: '600' },
  { value: '700', label: '700' },
  { value: '800', label: '800' },
  { value: '900', label: '900' },
]

const FAMILY_CHIPS: Array<{
  value: NonNullable<TextStyle['fontFamilyKind']>
  label: string
}> = [
  { value: 'display', label: 'Display' },
  { value: 'body', label: 'Body' },
  { value: 'mono', label: 'Mono' },
]

export interface TunerTextPanelProps {
  target: TextObject
  style: TextStyle
  /** Live value — updated every keystroke of contenteditable. */
  currentText: string
  onStyleChange: <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => void
  onStyleCommit: <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => void
  onStyleReset: (key: keyof TextStyle) => void
  /** Panel-level revert: clear all style overrides for this element. */
  onRevertObject: () => void
}

export function TunerTextPanel({
  target,
  style,
  currentText,
  onStyleChange,
  onStyleCommit,
  onStyleReset,
  onRevertObject,
}: TunerTextPanelProps) {
  const handleAlign = useCallback(
    (value: NonNullable<TextStyle['textAlign']>) => {
      onStyleChange('textAlign', value)
      onStyleCommit('textAlign', value)
    },
    [onStyleChange, onStyleCommit],
  )
  const handleFamily = useCallback(
    (value: NonNullable<TextStyle['fontFamilyKind']>) => {
      onStyleChange('fontFamilyKind', value)
      onStyleCommit('fontFamilyKind', value)
    },
    [onStyleChange, onStyleCommit],
  )
  const handleWeight = useCallback(
    (value: NonNullable<TextStyle['fontWeight']>) => {
      onStyleChange('fontWeight', value)
      onStyleCommit('fontWeight', value)
    },
    [onStyleChange, onStyleCommit],
  )

  const fontSize = style.fontSize ?? ''
  const lineHeight = style.lineHeight ?? ''
  const letterSpacing = style.letterSpacing ?? ''
  const color = style.color ?? ''
  const activeAlign = style.textAlign ?? ''
  const activeFamily = style.fontFamilyKind ?? ''
  const activeWeight = style.fontWeight ?? ''

  return (
    <div className="tuner-object-panel">
      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Text</h3>
        <div className="tuner-object-readback" aria-live="polite">
          <span className="tuner-object-readback-label">{target.label}</span>
          <span
            className="tuner-object-readback-value"
            title={currentText}
          >
            {currentText.length > 64
              ? `${currentText.slice(0, 64)}…`
              : currentText || <em>(empty — type in preview)</em>}
          </span>
        </div>
        <p className="tuner-object-hint">
          Click the text in the preview to edit inline. Escape to deselect.
        </p>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Typography</h3>
        <SliderField
          label="Size"
          value={fontSize}
          unit="px"
          min={8}
          max={120}
          step={1}
          fallback={16}
          onChange={(next) => {
            onStyleChange('fontSize', next)
            onStyleCommit('fontSize', next)
          }}
        />
        <SliderField
          label="Line height"
          value={lineHeight}
          unit=""
          min={0.8}
          max={2.5}
          step={0.05}
          fallback={1.4}
          onChange={(next) => {
            onStyleChange('lineHeight', next)
            onStyleCommit('lineHeight', next)
          }}
        />
        <SliderField
          label="Letter spacing"
          value={letterSpacing}
          unit="em"
          min={-0.05}
          max={0.3}
          step={0.01}
          fallback={0}
          onChange={(next) => {
            onStyleChange('letterSpacing', next)
            onStyleCommit('letterSpacing', next)
          }}
        />
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Font</h3>
        <div className="tuner-chips" role="radiogroup" aria-label="Font family">
          {FAMILY_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === activeFamily}
              className={`tuner-chip${opt.value === activeFamily ? ' is-active' : ''}`}
              onClick={() => handleFamily(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {activeFamily ? (
            <button
              type="button"
              className="tuner-chip is-clear"
              onClick={() => {
                onStyleReset('fontFamilyKind')
              }}
              title="Keep original"
            >
              Keep
            </button>
          ) : null}
        </div>
        <div
          className="tuner-chips"
          role="radiogroup"
          aria-label="Font weight"
          style={{ marginTop: 6 }}
        >
          {WEIGHT_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === activeWeight}
              className={`tuner-chip${opt.value === activeWeight ? ' is-active' : ''}`}
              onClick={() => handleWeight(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          {activeWeight ? (
            <button
              type="button"
              className="tuner-chip is-clear"
              onClick={() => onStyleReset('fontWeight')}
              title="Keep original"
            >
              Keep
            </button>
          ) : null}
        </div>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Color</h3>
        <div className="tuner-color-row">
          <input
            type="color"
            className="tuner-color-swatch"
            value={color || '#ffffff'}
            onChange={(e) => {
              onStyleChange('color', e.target.value)
              onStyleCommit('color', e.target.value)
            }}
            aria-label="Text color"
          />
          <input
            type="text"
            className="tuner-color-hex"
            value={color}
            placeholder="#ffffff"
            onChange={(e) => onStyleChange('color', e.target.value)}
            onBlur={(e) => {
              const value = e.target.value.trim()
              if (/^#[0-9a-fA-F]{3,6}$/.test(value)) {
                onStyleCommit('color', value)
              }
            }}
          />
          {color ? (
            <button
              type="button"
              className="tuner-chip is-clear"
              onClick={() => onStyleReset('color')}
              title="Keep original"
            >
              Keep
            </button>
          ) : null}
        </div>
      </section>

      <section className="tuner-object-section">
        <h3 className="tuner-group-label">Align</h3>
        <div className="tuner-chips" role="radiogroup" aria-label="Text align">
          {ALIGN_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={opt.value === activeAlign}
              className={`tuner-chip${opt.value === activeAlign ? ' is-active' : ''}`}
              onClick={() => handleAlign(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {target.isAction ? (
        <section className="tuner-object-section">
          <h3 className="tuner-group-label">Button</h3>
          <SliderField
            label="Corner radius"
            value={style.borderRadius ?? ''}
            unit="px"
            min={0}
            max={40}
            step={1}
            fallback={0}
            onChange={(next) => {
              onStyleChange('borderRadius', next)
              onStyleCommit('borderRadius', next)
            }}
          />
          <SliderField
            label="Horizontal padding"
            value={style.paddingInline ?? ''}
            unit="px"
            min={0}
            max={64}
            step={1}
            fallback={16}
            onChange={(next) => {
              onStyleChange('paddingInline', next)
              onStyleCommit('paddingInline', next)
            }}
          />
          <SliderField
            label="Vertical padding"
            value={style.paddingBlock ?? ''}
            unit="px"
            min={0}
            max={40}
            step={1}
            fallback={10}
            onChange={(next) => {
              onStyleChange('paddingBlock', next)
              onStyleCommit('paddingBlock', next)
            }}
          />
          <div className="tuner-color-row">
            <span className="tuner-color-label">Background</span>
            <input
              type="color"
              className="tuner-color-swatch"
              value={style.backgroundColor || '#000000'}
              onChange={(e) => {
                onStyleChange('backgroundColor', e.target.value)
                onStyleCommit('backgroundColor', e.target.value)
              }}
              aria-label="Button background"
            />
            <input
              type="text"
              className="tuner-color-hex"
              value={style.backgroundColor ?? ''}
              placeholder="#000000"
              onChange={(e) => onStyleChange('backgroundColor', e.target.value)}
              onBlur={(e) => {
                const value = e.target.value.trim()
                if (/^#[0-9a-fA-F]{3,6}$/.test(value)) {
                  onStyleCommit('backgroundColor', value)
                }
              }}
            />
          </div>
          <div className="tuner-color-row">
            <span className="tuner-color-label">Border</span>
            <input
              type="color"
              className="tuner-color-swatch"
              value={style.borderColor || '#c9a84c'}
              onChange={(e) => {
                onStyleChange('borderColor', e.target.value)
                onStyleCommit('borderColor', e.target.value)
              }}
              aria-label="Button border"
            />
            <input
              type="text"
              className="tuner-color-hex"
              value={style.borderColor ?? ''}
              placeholder="#c9a84c"
              onChange={(e) => onStyleChange('borderColor', e.target.value)}
              onBlur={(e) => {
                const value = e.target.value.trim()
                if (/^#[0-9a-fA-F]{3,6}$/.test(value)) {
                  onStyleCommit('borderColor', value)
                }
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="tuner-object-section">
        <button
          type="button"
          className="tuner-object-revert"
          onClick={onRevertObject}
        >
          Revert this element
        </button>
      </section>
    </div>
  )
}
