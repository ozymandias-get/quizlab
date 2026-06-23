import { resolveAutoSend } from '@features/ai/lib/sendUtils'
import type { AiSendOptions } from '@features/ai/model/types'

import { Logger } from '@shared/lib/logger'

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react'

import { planBulkAiSend } from '../ai/planBulkAiSend'
import type { AiDraftItem, AiSendResult } from '../ai/types'
import { blobUrlToDataUrl } from './appToolUtils'

interface UseDraftSendOrchestrationProps {
  autoSend: boolean
  sendTextToAI: (payload: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (dataUrl: string, options?: AiSendOptions) => Promise<AiSendResult>
  pendingAiItemsRef: { current: AiDraftItem[] }
  setPendingAiItems: Dispatch<SetStateAction<AiDraftItem[]>>
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
  const autoSendRef = useRef(autoSend)
  autoSendRef.current = autoSend

  const executeDraftSend = useCallback(
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<AiSendResult> => {
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const effectiveAutoSend = resolveAutoSend(autoSendRef.current, options)
      const segments = planBulkAiSend(items, options?.promptText)

      if (segments.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      let sendResult: AiSendResult = { success: true }

      for (const segment of segments) {
        if (segment.kind === 'text') {
          sendResult = await sendTextToAI(segment.payload, { autoSend: effectiveAutoSend })
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
          sendResult = await sendImageToAI(dataUrl, {
            autoSend: effectiveAutoSend,
            promptText: segment.promptText
          })
        }

        if (!sendResult.success) {
          if (sendResult.error !== 'webview_not_ready') {
            Logger.warn(
              `[DraftOrchestration] Multi-segment send failed at segment: ${segment.kind}`,
              sendResult.error
            )
          }
          return sendResult
        }
      }

      return sendResult
    },
    [sendImageToAI, sendTextToAI]
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
          for (const draft of items) {
            if (draft.type === 'image' && draft.blobUrl) {
              URL.revokeObjectURL(draft.blobUrl)
            }
          }
          setPendingAiItems(() => [])
        } else {
          if (result.error !== 'webview_not_ready') {
            Logger.error('[DraftOrchestration] Failed to send pending items:', result.error)
          }
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
