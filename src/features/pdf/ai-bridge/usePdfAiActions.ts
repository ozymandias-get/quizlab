/**
 * React hook for PDF → AI actions.
 * Provides unified methods for sending text and images from PDF to AI composer.
 * Delegates capture operations to the Capture Engine and text operations to the Text Engine.
 */
import { useCallback } from 'react'
import { extractPageTextFromDom } from '../text/extractPageTextFromDom'
import { usePdfCaptureActions } from '../capture/usePdfCaptureActions'
import type { AiDraftImageItem } from '@app/providers/ai/types'

interface UsePdfAiActionsOptions {
  currentPage: number
  fileName?: string
  queueTextForAi: (text: string) => void
  queueImageForAi: (
    dataUrl: string,
    imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>
  ) => void
  startScreenshot: (imageMeta?: Pick<AiDraftImageItem, 'page' | 'captureKind'>) => void
  onNoTextFound?: () => void
}

export function usePdfAiActions({
  currentPage,
  fileName,
  queueTextForAi,
  queueImageForAi,
  startScreenshot,
  onNoTextFound
}: UsePdfAiActionsOptions) {
  const { handleFullPageScreenshot } = usePdfCaptureActions({
    currentPage,
    queueImageForAi,
    startScreenshot
  })

  const sendCurrentPageText = useCallback(() => {
    const text = extractPageTextFromDom(currentPage)
    if (!text) {
      onNoTextFound?.()
      return
    }
    queueTextForAi(text)
  }, [currentPage, queueTextForAi, onNoTextFound])

  const sendPageAsImage = useCallback(async () => {
    await handleFullPageScreenshot()
  }, [handleFullPageScreenshot])

  const startAreaScreenshot = useCallback(() => {
    startScreenshot({
      page: currentPage,
      captureKind: 'selection'
    })
  }, [currentPage, startScreenshot])

  return {
    sendCurrentPageText,
    sendPageAsImage,
    startAreaScreenshot,
    fileName
  }
}
