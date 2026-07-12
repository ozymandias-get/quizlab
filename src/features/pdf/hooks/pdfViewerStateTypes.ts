import type { PdfFile } from '@shared-core/types'

import type { PdfTab, ReadingProgressUpdate } from '@features/pdf/hooks/types'

import type { AiDraftImageItem } from '@app/providers/ai/types'

import type { DocumentLoadEvent, SpecialZoomLevel } from '@react-pdf-viewer/core'

import type { MenuItem } from '../ui/components/ContextMenu'
import type { usePdfPlugins } from '../ui/hooks'

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
}

export interface UsePdfViewerStateReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  scaleFactor: number
  viewerReloadKey: number
  isPanMode: boolean
  isPanDragging: boolean
  pageDimensions: { width: number; height: number } | null
  currentPage: number
  totalPages: number
  containerSize: { w: number; h: number }
  fitScale: number | null
  plugins: ReturnType<typeof usePdfPlugins>['plugins']
  zoomTo: (scale: number | SpecialZoomLevel) => void
  CurrentScale: ReturnType<typeof usePdfPlugins>['CurrentScale']
  PluginZoomIn: ReturnType<typeof usePdfPlugins>['ZoomIn']
  PluginZoomOut: ReturnType<typeof usePdfPlugins>['ZoomOut']
  goToNextPage: () => void
  goToPreviousPage: () => void
  jumpToPageFromNav: (page: number) => void
  handleFullPageScreenshot: () => Promise<void>
  handleAreaScreenshot: () => void
  extractCurrentPageText: () => string | null
  contextMenu: { x: number; y: number } | null
  handleDocumentLoadWithDimensions: (e: DocumentLoadEvent) => Promise<void>
  handleZoom: (e: { scale: number }) => void
  handleJumpToPage: (page: number) => void
  handleCloseContextMenu: () => void
  handleTogglePanMode: () => void
  menuItems: MenuItem[]
  handleAddCurrentPageTextToAi: () => void
  handleSendPageAsImageToAi: () => void
  handlePageChange: (e: { currentPage: number }) => void
  highlight: ReturnType<typeof usePdfPlugins>['highlight']
  clearHighlights: ReturnType<typeof usePdfPlugins>['clearHighlights']
  tt: (key: string) => string
}
