import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { type DocumentLoadEvent, SpecialZoomLevel } from '@react-pdf-viewer/core'
import { useCallback, useEffect } from 'react'

interface DocumentLoadHandlerInput {
  handleDocumentLoad: (e: DocumentLoadEvent) => void
  isMountedRef: React.MutableRefObject<boolean>
  setPageDimensions: (dims: { width: number; height: number } | null) => void
}

export function useDocumentLoadHandler(input: DocumentLoadHandlerInput) {
  const { handleDocumentLoad, isMountedRef, setPageDimensions } = input

  return useCallback(
    async (e: DocumentLoadEvent) => {
      handleDocumentLoad(e)
      try {
        const page = await e.doc.getPage(1)
        if (!isMountedRef.current) return
        const viewport = page.getViewport({ scale: 1 })
        setPageDimensions({ width: viewport.width, height: viewport.height })
      } catch {
        // Dimensions unavailable
      }
    },
    [handleDocumentLoad]
  )
}

type ScreenshotMeta = { page?: number; captureKind?: 'full-page' | 'selection' }

interface ElectronScreenshotInput {
  startScreenshot: (meta?: ScreenshotMeta) => void
  currentPageRef: React.MutableRefObject<number>
  handleFullPageScreenshotRef: React.MutableRefObject<() => Promise<void>>
}

export function usePdfViewerElectronScreenshot(input: ElectronScreenshotInput) {
  const { startScreenshot, currentPageRef, handleFullPageScreenshotRef } = input

  useEffect(() => {
    if (!hasElectronApi()) return
    const api = getElectronApi()
    if (!api) return
    const removeListener = api.onTriggerScreenshot((type: string) => {
      if (type === APP_CONSTANTS.SCREENSHOT_TYPES.CROP) {
        startScreenshot({ page: currentPageRef.current, captureKind: 'selection' })
      } else if (type === APP_CONSTANTS.SCREENSHOT_TYPES.FULL) {
        void handleFullPageScreenshotRef.current()
      }
    })
    return () => {
      if (typeof removeListener === 'function') removeListener()
    }
  }, [startScreenshot, currentPageRef])
}

interface InitialPageResumeInput {
  isDocumentReady: boolean
  pdfUrl: string
  initialPage?: number
  viewerReloadKey: number
  fitScale: number | null
  jumpToPageFromNav: (page: number) => void
  zoomToRef: React.MutableRefObject<(scale: number | SpecialZoomLevel) => void>
  appliedResumeSyncKeyRef: React.MutableRefObject<string | null>
}

export function usePdfViewerInitialPageResume(input: InitialPageResumeInput) {
  const {
    isDocumentReady,
    pdfUrl,
    initialPage,
    viewerReloadKey,
    fitScale,
    jumpToPageFromNav,
    zoomToRef,
    appliedResumeSyncKeyRef
  } = input

  useEffect(() => {
    if (!isDocumentReady || !pdfUrl || !initialPage || initialPage < 2) return
    const syncKey = `${pdfUrl}:${viewerReloadKey}:${initialPage}`
    if (appliedResumeSyncKeyRef.current === syncKey) return
    appliedResumeSyncKeyRef.current = syncKey
    zoomToRef.current(fitScale ?? SpecialZoomLevel.PageWidth)
    jumpToPageFromNav(initialPage)
  }, [isDocumentReady, fitScale, initialPage, jumpToPageFromNav, pdfUrl, viewerReloadKey])
}
