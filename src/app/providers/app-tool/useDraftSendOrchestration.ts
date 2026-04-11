import { useCallback } from 'react'
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
          result = await sendImageToAI(segment.dataUrl, {
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
      const items = pendingAiItemsRef.current
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const result = await executeDraftSend(items, options)

      if (result.success) {
        // Cleanup blob URLs for image items before clearing the queue
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
    },
    [executeDraftSend, pendingAiItemsRef, setPendingAiItems]
  )

  return {
    sendPendingAiItems
  }
}
