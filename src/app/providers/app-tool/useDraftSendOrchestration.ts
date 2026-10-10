import type { AiSendOptions } from '@features/ai'
import { resolveAutoSend } from '@features/ai'

import { Logger } from '@shared/lib/logger'

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react'

import { planSingleMessageSend } from '../ai/bulkSendPlan'
import { planBulkAiSend } from '../ai/planBulkAiSend'
import type { AiDraftItem, AiSendResult } from '../ai/types'
import { blobUrlToDataUrl } from './appToolUtils'

interface UseDraftSendOrchestrationProps {
  autoSend: boolean
  sendTextToAI: (payload: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (dataUrl: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendBulkToAI?: (imageDataUrls: string[], options?: AiSendOptions) => Promise<AiSendResult>
  pendingAiItemsRef: { current: AiDraftItem[] }
  setPendingAiItems: Dispatch<SetStateAction<AiDraftItem[]>>
}

/**
 * Taslak gönderim orkestrasyonu — tek mesaj ilkesiyle.
 *
 * - Metin + görsel karışık kuyruk tek AI kullanıcı mesajı olarak gönderilir:
 *   tüm görseller tek mesajın ekleri, prompt yalnızca bir kez, tek submit.
 * - Kayıtlı prompt pipeline içinde bir kez eklenir (activePromptText); burada
 *   tekrarlanmaz.
 * - Başarısızlıkta taslak korunur; yalnızca gerçekten işlenen öğeler kuyruktan
 *   düşer. Kısmi hazırlama (blob→dataURL) ile kısmi gönderim ayrıştırılır.
 * - Çift gönderim `sendingRef` ile engellenir; sekme sabitliği alt katmanda
 *   (useAiMessaging) garanti edilir.
 * - `sendBulkToAI` yoksa (eski test/provider) segmented fallback çalışır; bu
 *   durumda da prompt ilk segmente bir kez eklenir (planBulkAiSend davranışı).
 */
interface SegmentRun {
  result: AiSendResult
  sentItemIds: string[]
}

function mergeNoteWithBody(note: string | undefined, body: string): string | undefined {
  const normalizedNote = note?.trim()
  if (!normalizedNote) return body || undefined
  if (!body) return normalizedNote
  return `${normalizedNote}\n\n${body}`
}

export function useDraftSendOrchestration({
  autoSend,
  sendTextToAI,
  sendImageToAI,
  sendBulkToAI,
  pendingAiItemsRef,
  setPendingAiItems
}: UseDraftSendOrchestrationProps) {
  const sendingRef = useRef(false)
  const autoSendRef = useRef(autoSend)
  autoSendRef.current = autoSend

  const executeSingleMessageSend = useCallback(
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<SegmentRun> => {
      if (items.length === 0) {
        return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
      }
      const effectiveAutoSend = resolveAutoSend(autoSendRef.current, options)
      const plan = planSingleMessageSend(items)
      if (!plan) {
        return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
      }

      const combinedPrompt = mergeNoteWithBody(options?.promptText, plan.combinedBody)
      if (!combinedPrompt && plan.images.length === 0) {
        return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
      }

      // Görsel yoksa tek metin gönderimi (tek submit, tek prompt).
      if (plan.images.length === 0) {
        const sendResult = (await sendTextToAI(combinedPrompt ?? '', {
          autoSend: effectiveAutoSend
        })) ?? { success: false, error: 'cancelled' }
        if (!sendResult.success) {
          if ((sendResult as { error?: string }).error !== 'webview_not_ready') {
            Logger.warn('[DraftOrchestration] Single-message text send failed', sendResult)
          }
          return { result: sendResult, sentItemIds: [] }
        }
        return {
          result: { success: true, mode: (sendResult as { mode?: string }).mode },
          sentItemIds: plan.itemIds
        }
      }

      // Görsel(ler) var: tek mesaj + N ek + tek prompt + tek submit.
      if (!sendBulkToAI) {
        // Bulk desteği yoksa segmented fallback (legacy). Sessiz bölme değil:
        // bu yol yalnızca bulk'un hiç sunulamadığı ortamlarda çalışır.
        return executeSegmentedFallback(items, options, effectiveAutoSend)
      }

      // Blob URL'leri data URL'e çevir (hazırlama aşaması; gönderimden ayrı).
      const imageDataUrls: string[] = []
      for (const img of plan.images) {
        let dataUrl = img.dataUrl
        if (!dataUrl && img.blobUrl) {
          try {
            dataUrl = await blobUrlToDataUrl(img.blobUrl)
          } catch (err) {
            Logger.error('[DraftOrchestration] Failed to convert blob URL:', err)
            return { result: { success: false, error: 'invalid_image_format' }, sentItemIds: [] }
          }
        }
        if (!dataUrl) {
          return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
        }
        imageDataUrls.push(dataUrl)
      }

      const sendResult = (await sendBulkToAI(imageDataUrls, {
        autoSend: effectiveAutoSend,
        promptText: combinedPrompt
      })) ?? { success: false, error: 'cancelled' }

      if (!sendResult.success) {
        if ((sendResult as { error?: string }).error !== 'webview_not_ready') {
          Logger.warn('[DraftOrchestration] Single-message bulk send failed', sendResult)
        }
        return { result: sendResult, sentItemIds: [] }
      }
      return {
        result: { success: true, mode: (sendResult as { mode?: string }).mode },
        sentItemIds: plan.itemIds
      }

      async function executeSegmentedFallback(
        fallbackItems: AiDraftItem[],
        fallbackOptions: AiSendOptions | undefined,
        fallbackAutoSend: boolean
      ): Promise<SegmentRun> {
        const segments = planBulkAiSend(fallbackItems, fallbackOptions?.promptText)
        if (segments.length === 0) {
          return { result: { success: false, error: 'invalid_input' }, sentItemIds: [] }
        }
        const sentItemIds: string[] = []
        for (const segment of segments) {
          if (segment.kind === 'text') {
            const sendResult = (await sendTextToAI(segment.payload, {
              autoSend: fallbackAutoSend
            })) ?? { success: false, error: 'cancelled' }
            if (!sendResult.success) return { result: sendResult, sentItemIds }
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
            if (!dataUrl) return { result: { success: false, error: 'invalid_input' }, sentItemIds }
            const sendResult = (await sendImageToAI(dataUrl, {
              autoSend: fallbackAutoSend,
              promptText: segment.promptText
            })) ?? { success: false, error: 'cancelled' }
            if (!sendResult.success) return { result: sendResult, sentItemIds }
          }
          sentItemIds.push(...segment.itemIds)
        }
        return { result: { success: true }, sentItemIds }
      }
    },
    [sendBulkToAI, sendImageToAI, sendTextToAI]
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
        const { result, sentItemIds } = await executeSingleMessageSend(items, options)

        const sentIdSet = new Set(sentItemIds)
        if (sentItemIds.length > 0) {
          setPendingAiItems((current) => {
            const sentDrafts = current.filter((draft) => sentIdSet.has(draft.id))
            for (const draft of sentDrafts) {
              if (draft.type === 'image' && draft.blobUrl) {
                try {
                  URL.revokeObjectURL(draft.blobUrl)
                } catch {
                  // revoke best-effort
                }
              }
            }
            return current.filter((draft) => !sentIdSet.has(draft.id))
          })
        }

        if (!result.success && (result as { error?: string }).error !== 'webview_not_ready') {
          Logger.error('[DraftOrchestration] Failed to send pending items:', result)
        }

        return result
      } finally {
        sendingRef.current = false
      }
    },
    [executeSingleMessageSend, pendingAiItemsRef, setPendingAiItems]
  )

  return {
    sendPendingAiItems
  }
}
