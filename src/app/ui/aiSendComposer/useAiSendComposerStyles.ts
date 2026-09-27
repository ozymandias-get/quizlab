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

  /* Surface and colours are owned by the className (`bg-card` / `bg-card/95`)
     so the `transition-[background-color]` on the panel actually animates —
     an inline `background` silently beat it.
     No `backdrop-filter`: it promotes the panel to its own composited layer,
     and a composited layer antialiases its `border-radius` edges separately
     from the element, which is what made the pill's corners look jagged.
     The opaque surface plus `--shadow-ambient-xl` still reads as floating. */
  const panelStyle: CSSProperties = useMemo(
    () =>
      ({
        boxShadow: 'var(--shadow-ambient-xl)'
      }) as CSSProperties,
    []
  )

  return { portalStyle, panelStyle }
}
