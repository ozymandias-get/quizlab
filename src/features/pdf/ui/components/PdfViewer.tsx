import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'

import { GOOGLE_DRIVE_WEB_APP } from '@shared-core/constants/google-ai-web-apps'
import type { PdfFile } from '@shared-core/types'

import type {
  LastReadingInfo,
  PdfTab,
  ReadingProgressUpdate,
  ResumePdfResult
} from '@features/pdf/hooks/types'

import {
  useAiRegistryMeta,
  useAiSessionActions,
  useAiSessionUiPrefsState
} from '@app/providers/AiContext'
import { useAppToolActions } from '@app/providers/AppToolContext'

import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { releaseCanvasGpuMemory, useCanvasGpuCleanup } from '../../capture/useCanvasGpuCleanup'
import GoogleDrivePanel from './GoogleDrivePanel'
import PdfPlaceholder from './PdfPlaceholder'
import PdfViewerDocument from './PdfViewerDocument'

interface PdfViewerProps {
  pdfFile: PdfFile | null
  activePdfTab?: PdfTab | null
  onSelectPdf: () => void
  onTextSelection?: (text: string, position: { top: number; left: number } | null) => void
  t?: (key: string) => string
  initialPage?: number
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  onReadingProgressChange?: (update: ReadingProgressUpdate) => void
  lastReadingInfo?: LastReadingInfo[] | null
  isInteractionBlocked?: boolean
  isPanelResizing?: boolean
}

function PdfViewer({
  pdfFile,
  activePdfTab,
  onSelectPdf,
  onTextSelection,
  t: propT,
  initialPage,
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
  onReadingProgressChange,
  lastReadingInfo,
  isInteractionBlocked = false,
  isPanelResizing = false
}: PdfViewerProps) {
  const { chromeUserAgent } = useAiRegistryMeta()
  const { autoSend } = useAiSessionUiPrefsState()
  const { toggleAutoSend } = useAiSessionActions()
  const { startScreenshot, queueImageForAi } = useAppToolActions()
  const { t: contextT } = useTranslation()
  const t = propT || contextT || ((k: string) => k)

  const [persistentFile, setPersistentFile] = useState<PdfFile | null>(null)
  const [persistentUrl, setPersistentUrl] = useState<string | null | undefined>(null)
  const [persistentInitialPage, setPersistentInitialPage] = useState<number | undefined>(undefined)
  const [hasEverLoaded, setHasEverLoaded] = useState(false)
  const lastAppliedFileKeyRef = useRef<string | null>(null)
  const gpuContainerRef = useRef<HTMLDivElement>(null)
  const gpuAbortRef = useRef<AbortController | null>(null)

  // High-DPI GPU cleanup: rapid Ctrl+Wheel zoom creates high-res canvases that
  // must be synchronously released when the old page layer is detached, otherwise
  // the GPU backing store leaks and the renderer OOMs. The AbortSignal lets
  // useCanvasGpuCleanup cancel an in-flight rasterization before the next one
  // starts.
  useCanvasGpuCleanup(gpuContainerRef, gpuAbortRef.current?.signal ?? undefined)

  useEffect(() => {
    // Each new document (or reload) gets a fresh abort token; the previous
    // token is aborted synchronously so its canvases are zeroed before the
    // next document's canvases are allocated.
    gpuAbortRef.current?.abort()
    gpuAbortRef.current = new AbortController()
    const container = gpuContainerRef.current
    return () => {
      gpuAbortRef.current?.abort()
      // Synchronous fallback: if MutationObserver hasn't fired yet, zero
      // any remaining canvases immediately to free WebGL/2D buffers.
      // Copy ref to variable to avoid exhaustive-deps warning.
      if (container) {
        for (const canvas of container.querySelectorAll('canvas')) {
          releaseCanvasGpuMemory(canvas)
          // Extra synchronous guard — width/height zeroing must not be async
          canvas.width = 0
          canvas.height = 0
        }
      }
    }
  }, [pdfFile])

  useEffect(() => {
    if (pdfFile) {
      const fileKey = pdfFileKey(pdfFile)
      // initialPage reflects the live reading progress and therefore changes
      // on every page turn. Only a new (or re-opened) document may consume
      // it — otherwise the resume jump key changes mid-viewing and the
      // viewer re-applies the resume zoom/jump on every saved page turn.
      if (lastAppliedFileKeyRef.current !== fileKey) {
        lastAppliedFileKeyRef.current = fileKey
        setPersistentInitialPage(initialPage)
      }

      setPersistentFile(pdfFile)
      setPersistentUrl(pdfFile.streamUrl)
      setHasEverLoaded(true)
    } else {
      // Tab closed — clear persistent state so the viewer unloads immediately.
      // No closing animation: it caused a "stuck UI" feeling and momentary
      // zoom glitch. The placeholder fades in via its own CSS animation.
      lastAppliedFileKeyRef.current = null
      setPersistentFile(null)
      setPersistentUrl(null)
      setPersistentInitialPage(undefined)
    }
  }, [pdfFile, initialPage])

  const isViewerVisible = !!pdfFile && activePdfTab?.kind !== 'drive'

  return (
    <div ref={gpuContainerRef} className="relative h-full w-full">
      {hasEverLoaded && persistentFile && persistentUrl && (
        <div
          className="absolute inset-0 h-full w-full"
          style={{ display: isViewerVisible ? 'block' : 'none' }}
        >
          <PdfViewerDocument
            pdfFile={persistentFile}
            pdfUrl={persistentUrl}
            activePdfTab={activePdfTab}
            onTextSelection={onTextSelection}
            t={t}
            initialPage={persistentInitialPage}
            onReadingProgressChange={onReadingProgressChange}
            isInteractionBlocked={isInteractionBlocked || !pdfFile}
            autoSend={autoSend}
            onToggleAutoSend={toggleAutoSend}
            startScreenshot={startScreenshot}
            queueImageForAi={queueImageForAi}
            isPanelResizing={isPanelResizing}
          />
        </div>
      )}

      {activePdfTab?.kind === 'drive' && (
        <GoogleDrivePanel
          tabId={activePdfTab.id}
          webviewUrl={activePdfTab.webviewUrl || GOOGLE_DRIVE_WEB_APP.url}
          chromeUserAgent={chromeUserAgent}
          title={GOOGLE_DRIVE_WEB_APP.name}
          description={t('gdrive_pdf_desc')}
          reloadLabel={t('ctx_reload')}
          isInteractionBlocked={isInteractionBlocked}
        />
      )}

      {!isViewerVisible && activePdfTab?.kind !== 'drive' && (
        <div className="bg-background animate-in fade-in motion-normal absolute inset-0 h-full w-full">
          <PdfPlaceholder
            onSelectPdf={onSelectPdf}
            onResumePdf={onResumePdf}
            onClearResumePdf={onClearResumePdf}
            onRestoreResumePdf={onRestoreResumePdf}
            onRelinkPdf={onRelinkPdf}
            lastReadingInfo={lastReadingInfo}
          />
        </div>
      )}
    </div>
  )
}

function pdfFileKey(a: PdfFile | null): string | null {
  return a ? `${a.path}::${a.streamUrl}::${a.name}::${a.size}` : null
}

export default memo(PdfViewer, (prev, next) => {
  if (pdfFileKey(prev.pdfFile) !== pdfFileKey(next.pdfFile)) return false
  if (prev.initialPage !== next.initialPage) return false
  if (prev.activePdfTab?.kind !== next.activePdfTab?.kind) return false
  if (prev.isInteractionBlocked !== next.isInteractionBlocked) return false
  if (prev.isPanelResizing !== next.isPanelResizing) return false
  if (prev.lastReadingInfo !== next.lastReadingInfo) return false
  return true
})
