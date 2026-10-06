import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useEffect } from 'react'

type ScreenshotMeta = { page?: number; captureKind?: 'full-page' | 'selection' }

interface ElectronScreenshotInput {
  startScreenshot: (meta?: ScreenshotMeta) => void
  currentPageRef: React.MutableRefObject<number>
  handleFullPageScreenshotRef: React.MutableRefObject<() => Promise<void>>
}

/**
 * Electron main-process screenshot requests → the capture pipeline.
 *
 * This is a `webContents.capturePage` in the main process, so nothing here reads
 * the viewer's DOM and the same hook serves every surface. The page it stamps
 * comes from `currentPageRef`, which the viewer writes from its own live page — so
 * a crop is attributed to the page the reader is actually looking at.
 */
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
