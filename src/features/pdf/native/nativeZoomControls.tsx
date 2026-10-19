/**
 * Render-prop zoom controls for the shared toolbar, backed by native scale state.
 *
 * ## Why an adapter instead of a toolbar rewrite
 *
 * `PdfToolbar` takes its zoom controls as render-prop components
 * (`ZoomComponent` / `CurrentScaleComponent`). The *shape* is just
 * "call my onClick" and "tell me my scale", so this supplies that shape and the
 * toolbar — plus its three buttons, the percentage readout and
 * their tooltips — is reused untouched.
 *
 * The alternative, giving `PdfToolbar` a second native-specific branch for zoom,
 * would have put the native path inside the toolbar and duplicated the control
 * markup. The contract is small and already abstracted; this satisfies it.
 *
 * ## Why the scale readout is rebuilt when the scale changes
 *
 * `PdfToolbar` and `PdfZoomControls` are both memoised, and their props would
 * otherwise be referentially unchanged across a zoom — so the percentage readout
 * would keep showing the pre-zoom value while the canvas was already at the new
 * scale. Rebuilding `CurrentScale` on a scale change is what makes the zoom
 * level reach the toolbar. `ZoomIn`/`ZoomOut` stay referentially stable and
 * read the current scale from a ref at call time, so a scale change does not
 * re-create anything inside the buttons.
 */
import type {
  CurrentScaleComponent,
  ZoomComponent
} from '@features/pdf/ui/components/PdfZoomControls'

import { isMacPlatform } from '@shared/lib/shortcutUtils'

import { useMemo, useRef } from 'react'

interface NativeZoomControlsSource {
  scale: number
  zoomIn: () => void
  zoomOut: () => void
}

export interface NativeZoomControls {
  ZoomIn: ZoomComponent
  ZoomOut: ZoomComponent
  CurrentScale: CurrentScaleComponent
}

export function useNativeZoomControls(source: NativeZoomControlsSource): NativeZoomControls {
  const { scale, zoomIn, zoomOut } = source
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const { ZoomIn, ZoomOut } = useMemo(() => {
    const isMac = isMacPlatform()
    const modifier = isMac ? 'Meta' : 'Control'
    const ZoomInControl: ZoomComponent = ({ children }) =>
      children({ onClick: zoomIn, scale: scaleRef.current, ariaKeyShortcuts: `${modifier}+=` })
    const ZoomOutControl: ZoomComponent = ({ children }) =>
      children({ onClick: zoomOut, scale: scaleRef.current, ariaKeyShortcuts: `${modifier}+-` })
    return { ZoomIn: ZoomInControl, ZoomOut: ZoomOutControl }
  }, [zoomIn, zoomOut])

  const CurrentScale = useMemo<CurrentScaleComponent>(
    () =>
      // `scale` is a dependency on purpose: see the note above about the memoised
      // toolbar. `zoomIn`/`zoomOut` are stable, so a scale change rebuilds
      // `CurrentScale` while keeping `ZoomIn`/`ZoomOut` mounted in the DOM.
      ({ children }) =>
        children({ scale }),
    [scale]
  )

  return useMemo(() => ({ ZoomIn, ZoomOut, CurrentScale }), [ZoomIn, ZoomOut, CurrentScale])
}
