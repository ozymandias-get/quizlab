import type { PdfFile } from '@shared-core/types'

import type { PdfTab, ReadingProgressUpdate } from '@features/pdf/hooks/types'
import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import type { AiDraftImageItem } from '@app/providers/ai/types'

import type { MenuItem } from '../ui/components/ContextMenu'

type ScreenshotMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'>

export interface PdfViewerDocumentProps {
  pdfFile: PdfFile
  pdfUrl: string
  activePdfTab?: PdfTab | null
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  t: (key: string) => string
  initialPage?: number
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  isInteractionBlocked: boolean
  autoSend: boolean
  onToggleAutoSend: () => void
  startScreenshot: (imageMeta?: ScreenshotMeta) => void
  queueImageForAi: (dataUrl: string, imageMeta?: ScreenshotMeta) => void
  isPanelResizing?: boolean
  /**
   * The live page number capture must read.
   *
   * Not part of what a caller supplies: it is created one level up so that a direct
   * test of this hook can omit it, and the hook falls back to its own live page.
   */
  capturePageRef?: React.RefObject<number>
}

/**
 * No RPV types and no `usePdfPlugins` return types appear here any more.
 *
 * The six fields that used to be typed as `ReturnType<typeof usePdfPlugins>[…]`
 * were the plugin's own `Plugin[]`, `CurrentScale`, `ZoomIn`, `ZoomOut`,
 * `highlight` and `clearHighlights`. The zoom and search fields are now the native
 * controller's, and `plugins` has no successor because there is no plugin array:
 * the renderer owns its own layers.
 */
export interface UsePdfViewerStateReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  textLayerRef: React.RefObject<HTMLDivElement | null>
  annotationLayerRef: React.RefObject<HTMLDivElement | null>
  searchLayerRef: React.RefObject<HTMLDivElement | null>
  /** The single PDF renderer: page, scale, navigation, search and zoom. */
  nativeViewer: NativePdfController
  viewerReloadKey: number
  isPanMode: boolean
  isPanDragging: boolean
  handleFullPageScreenshot: () => Promise<void>
  handleAreaScreenshot: () => void
  contextMenu: { x: number; y: number } | null
  handleCloseContextMenu: () => void
  handleTogglePanMode: () => void
  menuItems: MenuItem[]
  handleAddCurrentPageTextToAi: () => void
  handleReload: () => void
  tt: (key: string) => string
}
