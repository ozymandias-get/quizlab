import type { PdfFile } from '@shared-core/types'

import type { PdfTab, ReadingProgressUpdate } from '@features/pdf/hooks/types'
import type { NativePdfController } from '@features/pdf/native/useNativePdfController'

import type { PdfSourceMeta } from '@app/providers/ai/pdfSource'
import type { AiDraftImageItem } from '@app/providers/ai/types'

import type { MenuItem } from '../ui/components/ContextMenu'

export type ScreenshotMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'> & {
  source?: PdfSourceMeta | null
}

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
 * Zoom and search arrive as one field, `nativeViewer`: the renderer owns its own
 * layers, so there is no plugin array and no per-plugin zoom or highlight surface
 * to hand back separately.
 */
export interface SelectionMenuState {
  menu: {
    text: string
    position: { top: number; left: number }
    source: PdfSourceMeta | null
    requestId: number
  } | null
  feedback: 'idle' | 'working' | 'added' | 'sent' | 'error'
  addedCount: number
  handleAddToDraft: () => void
  handleSendDirect: () => void
  closeMenu: () => void
}

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
  selectionMenu: SelectionMenuState
}
