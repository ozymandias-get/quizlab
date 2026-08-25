import { type CSSProperties, useMemo } from 'react'

import { COMPACT_HEIGHT } from './layoutUtils'
import type { DockLayout } from './types'

export function useAiSendComposerStyles(
  isExpanded: boolean,
  layout: DockLayout
): { portalStyle: CSSProperties; panelStyle: CSSProperties } {
  const portalStyle = useMemo(
    () =>
      isExpanded
        ? {
            left: layout.x,
            top: layout.y,
            width: layout.width,
            height: layout.height
          }
        : {
            left: layout.x,
            top: layout.y,
            width: 'max-content',
            height: COMPACT_HEIGHT
          },
    [layout.x, layout.y, layout.width, layout.height, isExpanded]
  )

  const panelStyle: CSSProperties = useMemo(
    () =>
      isExpanded
        ? {
            boxShadow: 'var(--shadow-ambient-xl)',
            background: 'oklch(var(--card) / 0.95)',
            backdropFilter: 'blur(16px)'
          }
        : {
            boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'oklch(var(--card) / 0.95)',
            backdropFilter: 'blur(16px)'
          },
    [isExpanded]
  )

  return { portalStyle, panelStyle }
}
