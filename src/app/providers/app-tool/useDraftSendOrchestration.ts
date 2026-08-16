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
interface SegmentRun {
  result: AiSendResult
  sentItemIds: string[]
}

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
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<SegmentRun> => {
      if (items.length === 0) {
        return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
      }

      const effectiveAutoSend = resolveAutoSend(autoSendRef.current, options)
      const segments = planBulkAiSend(items, options?.promptText)

      if (segments.length === 0) {
        return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
      }

      const sentItemIds: string[] = []

      for (const segment of segments) {
        if (segment.kind === 'text') {
          const sendResult = (await sendTextToAI(segment.payload, {
            autoSend: effectiveAutoSend
          })) ?? {
            success: false,
            error: 'cancelled'
          }
          if (!sendResult.success) {
            if (sendResult.error !== 'webview_not_ready') {
              Logger.warn(
                `[DraftOrchestration] Multi-segment send failed at segment: ${segment.kind}`,
                sendResult.error
              )
            }
            return { result: sendResult, sentItemIds }
          }
        } else {
          let dataUrl = segment.dataUrl
          if (!dataUrl && segment.blobUrl) {
            try {
              dataUrl = await blobUrlToDataUrl(segment.blobUrl)
            } catch (err) {
              Logger.error('[DraftOrchestration] Failed to convert blob URL:', err)
              return { result: { success: false, error: 'invalid_image_format' }, sentItemIds }
            }
          }
          if (!dataUrl) {
            return { result: { success: false, error: 'invalid_input' }, sentItemIds }
          }
          const sendResult = (await sendImageToAI(dataUrl, {
            autoSend: effectiveAutoSend,
            promptText: segment.promptText
          })) ?? { success: false, error: 'cancelled' }
          if (!sendResult.success) {
            if (sendResult.error !== 'webview_not_ready') {
              Logger.warn(
                `[DraftOrchestration] Multi-segment send failed at segment: ${segment.kind}`,
                sendResult.error
              )
            }
            return { result: sendResult, sentItemIds }
          }
        }
        sentItemIds.push(...segment.itemIds)
      }

      return { result: { success: true }, sentItemIds }
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
        const { result, sentItemIds } = await executeDraftSend(items, options)

        // Remove only the drafts that were actually delivered. Items queued
        // while the send was in flight stay, and on partial failure the
        // undelivered segments remain so a retry does not re-send content.
        const sentIdSet = new Set(sentItemIds)
        if (sentItemIds.length > 0) {
          setPendingAiItems((current) => {
            const sentDrafts = current.filter((draft) => sentIdSet.has(draft.id))
            for (const draft of sentDrafts) {
              if (draft.type === 'image' && draft.blobUrl) {
                URL.revokeObjectURL(draft.blobUrl)
              }
            }
            return current.filter((draft) => !sentIdSet.has(draft.id))
          })
        }

        if (!result.success && result.error !== 'webview_not_ready') {
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
