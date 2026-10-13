import type { AiPlatform } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import type * as AiFeatureModule from '@features/ai'
import type { AiSendOptions } from '@features/ai'
import { prepareImageForUpload, useAiSender } from '@features/ai'
import { resolveAutoSend } from '@features/ai'

import type { AiSendResult, Tab } from '@app/providers/ai/types'
import { NO_SEND_RESULT } from '@app/providers/ai/types'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { waitForContentReadyForSend } from './aiContentSendReadiness'
import { toErrorToastKey } from './errorToastKey'
import {
  cancelScheduledApiChatSends,
  scheduleApiChatSend,
  waitForApiChatTab
} from './lib/apiChatSend'
import {
  type ApiChatStaging,
  type ChatUiStateReader,
  createApiChatStaging,
  hasStagedMutations,
  rollbackApiChatStaging,
  stageApiChatAttachments,
  stageApiChatInput
} from './lib/apiChatStaging'

let chatUiStoreModule: typeof AiFeatureModule | null = null

async function getChatUiStore() {
  if (!chatUiStoreModule) {
    chatUiStoreModule = await import('@features/ai')
  }
  return chatUiStoreModule.useChatUiStore
}

/**
 * Telafiyi çalıştırır ve **sonucunu** gönderim sonucuna işler.
 *
 * Telafi `void` sayılırsa üst katman "hedef temizlendi" varsayar ve kısmen
 * geri alınmış bir gönderimi yeniden ekler. Oysa:
 *
 * - Tam telafi → hedef eski halinde, `not_started`; otomatik tekrar güvenli.
 * - Kısmi telafi / kullanıcı değişikliği → hedefte bizim içerikten bir şey
 *   duruyor. Otomatik tekrar mükerrer mesaj üretir; sonuç `partial` olarak
 *   işaretlenir ve üst katman kullanıcıyı bilgilendirir.
 */
function withRollback(
  read: ChatUiStateReader | null,
  tabId: string,
  staging: ApiChatStaging,
  result: AiSendResult
): AiSendResult {
  if (!read || !hasStagedMutations(staging)) return result
  const rollback = rollbackApiChatStaging(read, tabId, staging)
  if (rollback === 'fully_reverted') {
    // Geri alma tamam: hedefe bizim bıraktığımız bir şey yok.
    return { ...result, stage: 'not_started' }
  }
  return { ...result, stage: 'partial' }
}

interface UseAiMessagingParams {
  getContentController: (tabId?: string) => AiContentController | null
  /** Reads the active tab, or undefined when there is none. */
  getActiveTab: () => Tab | undefined
  currentAI: string
  activeTabId: string
  autoSend: boolean
  aiRegistry: Record<string, AiPlatform>
  showWarning: (message: string, title?: string) => void
  openAiWorkspace: (modelId: string) => void
}

/**
 * Başarılı gönderim **sessizdir**.
 *
 * İçerik hedefe ulaştığında kullanıcı zaten sonucu kendi gözüyle görür: site
 * kutusunda mesaj belirir, taslak kuyruğu boşalır, panel kapanır. Ek bir
 * "Gönderildi!" balonu aynı olayı ikinci kez anlatır ve gönderim sırasında
 * ekranın köşesini kapatarak bir sonraki adımı gizler. Bu yüzden bu katman
 * yalnızca **hatayı** konuşur; başarı sessizdir.
 */
export function useAiMessaging({
  getContentController,
  getActiveTab,
  currentAI,
  activeTabId,
  autoSend,
  aiRegistry,
  showWarning,
  openAiWorkspace
}: UseAiMessagingParams) {
  const { t } = useTranslation()
  const apiChatSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  useEffect(() => {
    const timeoutRef = apiChatSendTimeoutRef
    return () => {
      // Settle any awaiting senders instead of leaving their promises pending.
      cancelScheduledApiChatSends(timeoutRef)
    }
  }, [])

  const contentRefProxy = useMemo(
    () => ({
      get current() {
        return getContentController()
      }
    }),
    [getContentController]
  )
  const {
    sendTextToAI: rawSendText,
    sendImageToAI: rawSendImage,
    sendBulkToAI: rawSendBulk,
    cancelOngoing
  } = useAiSender(contentRefProxy, currentAI, autoSend, aiRegistry, activeTabId)

  const waitForContentReady = useCallback(
    (timeoutMs = 10_000) => waitForContentReadyForSend(getContentController, timeoutMs),
    [getContentController]
  )

  const ensureApiChatTab = useCallback(async () => {
    // The active tab is not necessarily an api-chat tab. Attaching to a PDF or
    // content tab id writes the image into per-tab state that no composer
    // reads, so the send then reports success while nothing is ever delivered.
    if (getActiveTab()?.modelId === 'api-chat') return activeTabIdRef.current
    openAiWorkspace('api-chat')
    return waitForApiChatTab(() =>
      getActiveTab()?.modelId === 'api-chat' ? activeTabIdRef.current : ''
    )
  }, [getActiveTab, openAiWorkspace])

  const handleApiChatSendResult = useCallback(
    (result: { success: boolean; error?: string }) => {
      if (!result.success && result.error && result.error !== 'empty_message') {
        reportSuppressedError('useAiMessaging.apiChatSend', {
          cause: new Error(result.error)
        })
        showWarning(toErrorToastKey(result.error))
      }
    },
    [showWarning]
  )

  /**
   * api-chat için hazırlama + teslim + **telafi**.
   *
   * api-chat deposu üzerinden çalıştığı için içerik önce kutuya/ek
   * listesine **yazılır**, sonra istek atılır. Yazma ile istek arasında bir hata
   * olursa (görsel hazırlanamadı, ağ hatası) yazılan içerik yerinde kalır ve
   * "Tekrar gönder" aynı görselleri ikinci kez ekler — tek mesaj isteği sessizce
   * iki mesaja dönüşür. Bu fonksiyon, hazırlanan parçaların **kendi kaydını**
   * tutar ve yalnızca kesin başarısızlıkta onları geri alır.
   *
   * Görseller önce hazırlanıp sonra topluca eklenir: 3 görselin 2.'si
   * hazırlanamazsa hiçbiri eklenmemiş olur, yarım ek bırakılmaz.
   *
   * ## Telafi ne zaman yapılır
   *
   * Karar bir "hazırlandı" bayrağıyla değil, **işlem günlüğünde kayıt
   * olup olmamasıyla** verilir: `stageApiChat*` her mutasyonu uygulamadan
   * önce kaydeder, bu yüzden hazırlama ortasında oluşan bir hata telafiyi
   * atlamaz.
   *
   * İptal iki farklı gerçektir ve tek bir kodla temsil edilemez:
   * debounce kuyruğunda iptal (`cancelled_before_send`) hiçbir istek atmadı —
   * telafi hem güvenli hem gereklidir; istek atıldıktan sonra iptal
   * (`cancelled`) teslimi belirsiz bırakır — telafi yapılmaz ve otomatik
   * tekrar engellenir.
   *
   * Telafi sonucu **boş döndürülmez**: tam/kısmi/kullanıcı değişikliği
   * nedeniyle geri alınamama bilgisi üst katmana taşınır, böylece kısmen
   * geri alınmış bir gönderim yeniden eklenmez.
   */
  const runApiChatSend = useCallback(
    async (
      tabId: string,
      prepare: (
        read: ChatUiStateReader,
        staging: ApiChatStaging
      ) => Promise<{ error: string } | null>,
      effectiveAutoSend: boolean
    ): Promise<AiSendResult> => {
      let read: ChatUiStateReader | null = null
      const staging = createApiChatStaging()
      try {
        const UiStore = await getChatUiStore()
        read = () => UiStore.getState()
        const rejected = await prepare(read, staging)
        if (rejected) {
          // Hazırlama reddedildi ama kısmi mutasyon bırakmış olabilir.
          return withRollback(read, tabId, staging, { success: false, error: rejected.error })
        }

        if (!effectiveAutoSend) {
          // Auto-send kapalı: içerik hazırlandı, kullanıcı gönderir. "staged"
          // bir teslim iddiası değildir; bu yüzden temizlik de yapılmaz.
          return { success: true, mode: 'staged', stage: 'applied' }
        }

        const result = await scheduleApiChatSend(tabId, apiChatSendTimeoutRef)
        // `cancelled`: istek atıldıktan sonra durdu. İçerik zaten transcript'e
        // yazılmış olabilir; geri almak ikinci bir kopya üretirdi. Otomatik
        // tekrar da engellenir (`stage: 'uncertain'`).
        if (!result.success && result.error !== 'cancelled') {
          // Kesin başarısızlık: telafi çalıştırılır ve **sonucu** gönderim
          // sonucuna işlenir. `handleApiChatSendResult` bilinçli olarak
          // *önce* çağrılır: bu dönüş onu atlasa, API hatası hiçbir yerde
          // konuşmaz (yalnızca `cancelled` ve başarı bu satıra ulaşırdı).
          handleApiChatSendResult(result)
          return withRollback(read, tabId, staging, result)
        }
        handleApiChatSendResult(result)
        return result
      } catch (err) {
        return withRollback(read, tabId, staging, {
          success: false,
          error: ensureErrorMessage(err, 'send_failed')
        })
      }
    },
    [handleApiChatSendResult]
  )

  /** Eklerin tek başına anlamsız kalmaması için kullanılan tohum talimat. */
  const imageOnlySeed = useCallback(
    (count: number) => t('ai_send_image_only_prompt', { count: Math.max(1, count) }),
    [t]
  )

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // api-chat uses a store-based tab, not a content. If no tab exists,
        // auto-open one for api-chat and wait for it to become active.
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        const effectiveAutoSend = resolveAutoSend(autoSend, options)
        return runApiChatSend(
          currentTabId,
          async (read, staging) => {
            // Metin kutuya **sona eklenir**; kullanıcının önceden yazdığı
            // hiçbir şey ezilmez.
            stageApiChatInput(staging, read, currentTabId, text)
            return null
          },
          effectiveAutoSend
        )
      }

      // For content-based models, ensure a content instance is available.
      // In normal split view, the user may not have an AI tab open yet.
      const content = getContentController()
      if (!content) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForContentReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForContent', {
          cause: new Error('Content did not become ready in time')
        })
        showWarning('error_webview_not_ready')
        return { success: false, error: 'webview_not_ready' }
      }

      const result = (await rawSendText(text, options)) ?? NO_SEND_RESULT
      if (!result.success && result.error !== 'cancelled') {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getContentController,
      openAiWorkspace,
      rawSendText,
      runApiChatSend,
      showWarning,
      waitForContentReady
    ]
  )

  const sendImageToAI = useCallback(
    async (imageData: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // Auto-open an api-chat tab if none exists and wait for it.
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        // The api-chat branch stores the string verbatim as an
        // `image_url.url`. A blob: or http(s): source cannot be resolved by
        // the provider, so reject it here instead of failing the whole
        // request later. Mirrors the guard in the content image pipeline.
        if (!imageData.startsWith('data:image/')) {
          reportSuppressedError('useAiMessaging.apiChatImage', {
            cause: new Error('unsupported image source')
          })
          showWarning(toErrorToastKey('invalid_image_format'))
          return { success: false, error: 'invalid_image_format' }
        }
        const effectiveAutoSend = resolveAutoSend(autoSend, options)
        return runApiChatSend(
          currentTabId,
          async (read, staging) => {
            // Sayfa yakalamaları 4x ölçekte gelir ve base64 ile şişer; api-chat
            // gövde bütçesine sığması için önce küçültülür. Hazırlama başarısız
            // olursa hiçbir şey yazılmamış olur.
            const prepared = await prepareImageForUpload(imageData)
            stageApiChatAttachments(staging, read, currentTabId, [prepared])
            // Not yoksa, eklerin tek başına anlamsız kalmaması için kısa bir
            // tohum talimatı yazılır — yalnızca kutu boşsa.
            stageApiChatInput(staging, read, currentTabId, options?.promptText, imageOnlySeed(1))
            return null
          },
          effectiveAutoSend
        )
      }

      // For content-based models, ensure a content instance is available
      const content = getContentController()
      if (!content) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForContentReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForContent', {
          cause: new Error('Content did not become ready in time for image send')
        })
        showWarning('error_webview_not_ready')
        return { success: false, error: 'webview_not_ready' }
      }

      const result = (await rawSendImage(imageData, options)) ?? NO_SEND_RESULT
      if (!result.success && result.error !== 'cancelled') {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getContentController,
      openAiWorkspace,
      rawSendImage,
      runApiChatSend,
      showWarning,
      waitForContentReady,
      imageOnlySeed
    ]
  )

  /**
   * Tek mesajlık toplu gönderim: metin gövdesi + N görsel eki, tek prompt,
   * tek submit. Hedef sekme `ensureApiChatTab` ile gönderim başında sabitlenir
   * ve flush da aynı sekmeye yapılır — gönderim sırasında aktif sekme değişse
   * bile içerik yanlış sekmeye gitmez.
   *
   * Bu, tek mesaj ilkesinin **yegane** uygulama noktasıdır: N ek, tek gövde,
   * tek submit. Sağlayıcı tek mesajda çoklu eki taşıyamıyorsa çağıran bunu
   * `bulk_not_supported` ile önceden reddeder (bkz. `bulkSendPlan`); burada
   * sessizce birden fazla mesaja bölme yapılmaz.
   */
  const sendBulkToAI = useCallback(
    async (imageDataUrls: string[], options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        for (const url of imageDataUrls) {
          if (!url.startsWith('data:image/')) {
            return { success: false, error: 'invalid_image_format' }
          }
        }
        const effectiveAutoSend = resolveAutoSend(autoSend, options)
        return runApiChatSend(
          currentTabId,
          async (read, staging) => {
            // **Önce** hepsini hazırla: 3. görsel hazırlanamazsa 1. ve 2.
            // eklenmiş olmaz. Kısmi ek bırakmak, yeniden denemede mükerrer
            // ek üretirdi.
            const prepared: string[] = []
            for (const url of imageDataUrls) {
              prepared.push(await prepareImageForUpload(url))
            }
            stageApiChatAttachments(staging, read, currentTabId, prepared)
            stageApiChatInput(
              staging,
              read,
              currentTabId,
              options?.promptText,
              imageOnlySeed(prepared.length)
            )
            return null
          },
          effectiveAutoSend
        )
      }

      const content = getContentController()
      if (!content) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForContentReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForContentBulk', {
          cause: new Error('Content did not become ready in time for bulk send')
        })
        showWarning('error_webview_not_ready')
        return { success: false, error: 'webview_not_ready' }
      }
      if (!rawSendBulk) {
        return { success: false, error: 'bulk_not_supported' }
      }
      const result = (await rawSendBulk(imageDataUrls, options)) ?? NO_SEND_RESULT
      if (!result.success && (result as { error?: string }).error !== 'cancelled') {
        showWarning(toErrorToastKey((result as { error?: string }).error))
      }
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getContentController,
      openAiWorkspace,
      rawSendBulk,
      runApiChatSend,
      showWarning,
      waitForContentReady,
      imageOnlySeed
    ]
  )

  return {
    sendTextToAI,
    sendImageToAI,
    sendBulkToAI,
    cancelOngoing
  }
}
