import { useAppearance } from '@app/providers'
import { hexToRgba } from '@shared/lib/uiUtils'

import { type CSSProperties, memo, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

function getLuminance(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const TRANSITION_DURATION_MS = 300

const AMBIENT_VARS = [
  '--ambient-1',
  '--ambient-2',
  '--ambient-3',
  '--ambient-4',
  '--ambient-beam-1',
  '--ambient-beam-2'
] as const

/** Ambient alpha katmanları — her biri farklı derinlikte bir renk sızması sağlar */
const AMBIENT_ALPHAS: Record<(typeof AMBIENT_VARS)[number], number> = {
  '--ambient-1': 0.22,
  '--ambient-2': 0.16,
  '--ambient-3': 0.32,
  '--ambient-4': 0.24,
  '--ambient-beam-1': 0.22,
  '--ambient-beam-2': 0.18
}

function AppBackground() {
  const { bgSolidColor, bgMode } = useAppearance(
    useShallow((s) => ({
      bgSolidColor: s.bgSolidColor,
      bgMode: s.bgMode
    }))
  )
  const bgColorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = bgColorRef.current
    if (!el) return

    if (bgMode === 'ambient') {
      const c1 = bgSolidColor || '#000000'
      for (const v of AMBIENT_VARS) {
        el.style.setProperty(v, hexToRgba(c1, AMBIENT_ALPHAS[v]))
      }
    } else {
      const timer = setTimeout(() => {
        for (const v of AMBIENT_VARS) {
          el.style.removeProperty(v)
        }
      }, TRANSITION_DURATION_MS)
      return () => clearTimeout(timer)
    }
  }, [bgSolidColor, bgMode])

  const noiseOpacity = useMemo(() => {
    if (bgMode !== 'ambient' || !bgSolidColor) return undefined
    const lum = getLuminance(bgSolidColor)
    // Light backgrounds (lum > 0.5): reduce noise opacity to avoid dirty look
    // Dark backgrounds: keep default
    if (lum > 0.5) {
      const factor = Math.max(0, 1 - (lum - 0.5) * 2)
      return 0.022 * factor
    }
    return undefined
  }, [bgMode, bgSolidColor])

  const bgStyle = useMemo<CSSProperties | undefined>(
    () => (bgMode === 'solid' ? { background: bgSolidColor || '#000000' } : undefined),
    [bgMode, bgSolidColor]
  )

  const noiseStyle = useMemo<CSSProperties | undefined>(
    () => (noiseOpacity !== undefined ? { opacity: noiseOpacity } : undefined),
    [noiseOpacity]
  )

  return (
    <div ref={bgColorRef} data-bg-mode={bgMode} className="app-ambient-background" style={bgStyle}>
      <div className="bg-noise" style={noiseStyle} />
    </div>
  )
}

export default memo(AppBackground)
