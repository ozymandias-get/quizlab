import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import type { DocumentLoadEvent, SpecialZoomLevel } from '@react-pdf-viewer/core'
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
    [handleDocumentLoad, isMountedRef, setPageDimensions]
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
  }, [startScreenshot, currentPageRef, handleFullPageScreenshotRef])
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

const RESUME_JUMP_FALLBACK_MS = 1000

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
    // The viewer computes jump targets from the measurements of the current
    // zoom level. Fit scale arrives asynchronously (after page dimensions are
    // known), so jumping before it is applied uses stale measurements and can
    // overshoot to the last page. Wait for it, then jump after the fit-zoom
    // re-render has committed (two frames).
    if (fitScale === null) {
      // Fit scale can stay unknown if page dimensions fail to load. By then
      // the viewer is on its default scale with stable measurements, so a
      // delayed jump is still safe.
      const fallbackId = window.setTimeout(() => {
        appliedResumeSyncKeyRef.current = syncKey
        jumpToPageFromNav(initialPage)
      }, RESUME_JUMP_FALLBACK_MS)
      return () => window.clearTimeout(fallbackId)
    }
    appliedResumeSyncKeyRef.current = syncKey
    zoomToRef.current(fitScale)
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jumpToPageFromNav(initialPage)
      })
    })
    return () => cancelAnimationFrame(rafId)
  }, [
    isDocumentReady,
    fitScale,
    initialPage,
    jumpToPageFromNav,
    pdfUrl,
    viewerReloadKey,
    appliedResumeSyncKeyRef,
    zoomToRef
  ])
}
