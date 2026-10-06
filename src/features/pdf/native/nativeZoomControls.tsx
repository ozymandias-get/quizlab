/**
 * Render-prop zoom controls for the shared toolbar, backed by native scale state.
 *
 * ## Why an adapter instead of a toolbar rewrite
 *
 * `PdfToolbar` takes its zoom controls as render-prop components
 * (`ZoomComponent` / `CurrentScaleComponent`) so `@react-pdf-viewer`'s `zoomPlugin`
 * can supply them. Native state has no plugin, but the *shape* is just
 * "call my onClick" and "tell me my scale", so the native path supplies the same
 * shape and the toolbar — plus its three buttons, the percentage readout and
 * their tooltips — is reused untouched.
 *
 * The alternative, giving `PdfToolbar` a second native-specific branch for zoom,
 * would have put the native path inside the toolbar and duplicated the control
 * markup. The contract is small and already abstracted; this satisfies it.
 *
 * ## Why the components are rebuilt when the scale changes
 *
 * `PdfToolbar` and `PdfZoomControls` are both memoised, and their props would
 * otherwise be referentially unchanged across a zoom — so the percentage readout
 * would keep showing the pre-zoom value while the canvas was already at the new
 * scale. Rebuilding the three components on a scale change is what makes the
 * zoom level reach the toolbar. The zoom *handlers* stay stable, so a scale
 * change does not re-create anything inside the buttons.
 */
import type {
  CurrentScaleComponent,
  ZoomComponent
} from '@features/pdf/ui/components/PdfZoomControls'

import { useMemo } from 'react'

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

export function createNativeZoomControls({
  scale,
  zoomIn,
  zoomOut
}: NativeZoomControlsSource): NativeZoomControls {
  const ZoomIn: ZoomComponent = ({ children }) => children({ onClick: zoomIn, scale })
  const ZoomOut: ZoomComponent = ({ children }) => children({ onClick: zoomOut, scale })
  const CurrentScale: CurrentScaleComponent = ({ children }) => children({ scale })

  return { ZoomIn, ZoomOut, CurrentScale }
}

export function useNativeZoomControls(source: NativeZoomControlsSource): NativeZoomControls {
  const { scale, zoomIn, zoomOut } = source
  return useMemo(
    () => createNativeZoomControls({ scale, zoomIn, zoomOut }),
    // `scale` is a dependency on purpose: see the note above about the memoised
    // toolbar. `zoomIn`/`zoomOut` are stable, so a scale change is the only
    // thing that rebuilds these.
    [scale, zoomIn, zoomOut]
  )
}
