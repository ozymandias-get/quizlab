import type { AiSendOptions } from '@features/ai'
import { resolveAutoSend } from '@features/ai'

import { Logger } from '@shared/lib/logger'

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react'

import { planSingleMessageSend, supportsSingleMessageBulk } from '../ai/bulkSendPlan'
import type { AiDraftItem, AiSendResult } from '../ai/types'
import { blobUrlToDataUrl } from './appToolUtils'

interface UseDraftSendOrchestrationProps {
  autoSend: boolean
  /** Etkin sağlayıcı (model kimliği) — toplu görsel yetkisi burada sorulur. */
  providerId?: string
  sendTextToAI: (payload: string, options?: AiSendOptions) => Promise<AiSendResult>
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
 * - Sağlayıcı çoklu görseli tek mesajda taşıyamıyorsa sessizce parçalanmaz:
 *   gönderim `bulk_not_supported` ile reddedilir, taslak korunur ve kullanıcıya
 *   açık bilgi verilir (caller toast'ı).
 * - Başarısızlıkta taslak korunur; yalnızca gerçekten işlenen öğeler kuyruktan
 *   düşer. Kısmi hazırlama (blob→dataURL) ile kısmi gönderim ayrıştırılır.
 * - Çift gönderim `sendingRef` ile engellenir; sekme sabitliği alt katmanda
 *   (useAiMessaging) garanti edilir.
 *
 * ## Snapshot sınırı
 *
 * `pendingAiItemsRef` **gönderim başındaki anlık kuyruk dizisidir**. İşlem
 * sürerken eklenen öğeler bu snapshot'a girmez, gönderilmez ve kuyrukta kalır;
 * kaldırılan öğeler `sentIdSet` filtresiyle zaten yok sayılır. Sonuç olarak
 * "başında kaç öğe vardı" ile "ekranda kaç öğe var" soruları birbirine karışmaz.
 *
 * Kuyruktan düşen öğelerin blob önizlemeleri `setPendingAiItems` üzerinden
 * **kuyruğun kendi temizlik yolundan** geçer; burada ikinci bir iptal kaynağı
 * tutulmaz (aynı URL'i iki katman sahiplenirse biri diğerinin önizlemesini
 * öldürürdü).
 */
interface SendRun {
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
  providerId,
  sendTextToAI,
  sendBulkToAI,
  pendingAiItemsRef,
  setPendingAiItems
}: UseDraftSendOrchestrationProps) {
  const sendingRef = useRef(false)
  const autoSendRef = useRef(autoSend)
  autoSendRef.current = autoSend

  const executeSingleMessageSend = useCallback(
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<SendRun> => {
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
      // Sağlayıcı yetkisi gerçek uyumluluk modelinden sorulur; bilinmeyen
      // sağlayıcı asla destekleniyor sayılmaz.
      if (!supportsSingleMessageBulk(providerId ?? '', plan.images.length) || !sendBulkToAI) {
        // Sessiz bölme YAPILMAZ: taslak korunur, kullanıcıya açık bilgi verilir.
        // Onaylı alternatif, kullanıcı öğeleri tek tek çıkarmaya karar verdiğinde
        // tek görsel yoluyla (yukarıdaki metin yolu gibi) sunulur.
        Logger.warn(
          `[DraftOrchestration] Bulk unsupported for provider "${providerId ?? ''}" with ${plan.images.length} images; draft kept`
        )
        return { result: { success: false, error: 'bulk_not_supported' }, sentItemIds: [] }
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
    },
    [providerId, sendBulkToAI, sendTextToAI]
  )

  const sendPendingAiItems = useCallback(
    async (options?: AiSendOptions): Promise<AiSendResult> => {
      if (sendingRef.current) {
        return { success: false, error: 'send_in_progress' }
      }

      // Gönderim **anındaki** kuyruk snapshot'ıdır: işlem sürerken eklenen
      // öğeler bu diziye girmez, bu yüzden onlar gönderilmez ve kuyrukta kalır.
      const items = pendingAiItemsRef.current
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      sendingRef.current = true
      try {
        const { result, sentItemIds } = await executeSingleMessageSend(items, options)

        if (sentItemIds.length > 0) {
          // Kuyruğun kendi yazma yolu: kaynak (blob) temizliği de onun kuralına
          // uyar, burada ikinci bir iptal kaynağı tutulmaz.
          const sentIdSet = new Set(sentItemIds)
          setPendingAiItems((current) => current.filter((draft) => !sentIdSet.has(draft.id)))
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
