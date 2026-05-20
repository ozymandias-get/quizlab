import { useCallback, useRef } from 'react'
import { Logger } from '@shared/lib/logger'
import type { AiSendOptions } from '@features/ai'
import { planBulkAiSend } from '../ai/planBulkAiSend'
import type { AiDraftItem, AiSendResult } from '../ai/types'

interface UseDraftSendOrchestrationProps {
  autoSend: boolean
  sendTextToAI: (payload: string, options?: { autoSend?: boolean }) => Promise<AiSendResult>
  sendImageToAI: (
    dataUrl: string,
    options?: { autoSend?: boolean; promptText?: string }
  ) => Promise<AiSendResult>
  pendingAiItemsRef: { current: AiDraftItem[] }
  setPendingAiItems: (items: AiDraftItem[]) => void
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Hook to orchestrate the sending of drafted AI items (text and images).
 * Handles planning bulk sends and sequential execution.
 */
export function useDraftSendOrchestration({
  autoSend,
  sendTextToAI,
  sendImageToAI,
  pendingAiItemsRef,
  setPendingAiItems
}: UseDraftSendOrchestrationProps) {
  const sendingRef = useRef(false)

  const executeDraftSend = useCallback(
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<AiSendResult> => {
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const effectiveAutoSend =
        options?.forceAutoSend === true ? true : (options?.autoSend ?? autoSend)
      const segments = planBulkAiSend(items, options?.promptText)

      if (segments.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      let result: AiSendResult = { success: true }

      for (const segment of segments) {
        if (segment.kind === 'text') {
          result = await sendTextToAI(segment.payload, { autoSend: effectiveAutoSend })
        } else {
          let dataUrl = segment.dataUrl
          if (!dataUrl && segment.blobUrl) {
            try {
              dataUrl = await blobUrlToDataUrl(segment.blobUrl)
            } catch (err) {
              Logger.error('[DraftOrchestration] Failed to convert blob URL:', err)
              return { success: false, error: 'invalid_image_format' }
            }
          }
          if (!dataUrl) {
            return { success: false, error: 'invalid_input' }
          }
          result = await sendImageToAI(dataUrl, {
            autoSend: effectiveAutoSend,
            promptText: segment.promptText
          })
        }

        if (!result.success) {
          Logger.warn(
            `[DraftOrchestration] Multi-segment send failed at segment: ${segment.kind}`,
            result.error
          )
          return result
        }
      }

      return result
    },
    [autoSend, sendImageToAI, sendTextToAI]
  )

  const sendPendingAiItems = useCallback(
    async (options?: AiSendOptions): Promise<AiSendResult> => {
      if (sendingRef.current) {
        return { success: false, error: 'send_in_progress' }
      }

      const items = pendingAiItemsRef.current
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      sendingRef.current = true
      try {
        const result = await executeDraftSend(items, options)

        if (result.success) {
          for (const item of items) {
            if (item.type === 'image' && item.blobUrl) {
              URL.revokeObjectURL(item.blobUrl)
            }
          }
          setPendingAiItems([])
        } else {
          Logger.error('[DraftOrchestration] Failed to send pending items:', result.error)
        }

        return result
      } finally {
        sendingRef.current = false
      }
    },
    [executeDraftSend, pendingAiItemsRef, setPendingAiItems]
  )

  return {
    sendPendingAiItems
  }
}
