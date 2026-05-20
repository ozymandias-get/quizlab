/**
 * UI-internal convenience barrel for PdfViewerDocument.
 * Re-exports engine hooks so UI components import from a single location.
 * Not part of the public API; external consumers use @features/pdf.
 */

export { usePdfPlugins } from './usePdfPlugins'
export { usePdfNavigation } from './usePdfNavigation'
export { usePdfContextMenu } from '../../interaction/usePdfContextMenu'
export { usePdfPanTool } from '../../interaction/usePdfPanTool'
export { usePdfResizeRefit } from '../../viewport/usePdfResizeRefit'
export { usePdfCtrlWheelZoom } from '../../viewport/usePdfCtrlWheelZoom'
export { usePdfViewerZoomIpc } from '../../viewport/usePdfViewerZoomIpc'
export { usePdfTextActions } from '../../text/usePdfTextActions'
export { usePdfCaptureActions } from '../../capture/usePdfCaptureActions'
export {
  getScrollableAncestor,
  isScrollableElement,
  getInnerContainerFallback
} from './pdfPanToolHelpers'
