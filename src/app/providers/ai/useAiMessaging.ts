import type { AiPlatform } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import type * as AiFeatureModule from '@features/ai'
import type { AiSendOptions } from '@features/ai'
import { prepareImageForUpload, useAiSender } from '@features/ai'
import { isDeliveredSendResult, isStagedSendResult, resolveAutoSend } from '@features/ai'

import type { Tab } from '@app/providers/ai/types'
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

let chatUiStoreModule: typeof AiFeatureModule | null = null

async function getChatUiStore() {
  if (!chatUiStoreModule) {
    chatUiStoreModule = await import('@features/ai')
  }
  return chatUiStoreModule.useChatUiStore
}

interface UseAiMessagingParams {
  getContentController: (tabId?: string) => AiContentController | null
  /** Reads the active tab, or undefined when there is none. */
  getActiveTab: () => Tab | undefined
  currentAI: string
  activeTabId: string
  autoSend: boolean
  aiRegistry: Record<string, AiPlatform>
  showSuccess: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  openAiWorkspace: (modelId: string) => void
}

export function useAiMessaging({
  getContentController,
  getActiveTab,
  currentAI,
  activeTabId,
  autoSend,
  aiRegistry,
  showSuccess,
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

  const sendTextToAI = useCallback(
    async (text: string, options?: AiSendOptions) => {
      if (currentAI === 'api-chat') {
        // api-chat uses a store-based tab, not a content. If no tab exists,
        // auto-open one for api-chat and wait for it to become active.
        const currentTabId = await ensureApiChatTab()
        if (!currentTabId) {
          return { success: false, error: 'webview_not_ready' }
        }
        try {
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          const val = uiState.inputValueByTab[currentTabId] || ''
          const newVal = val ? val + '\n' + text : text
          uiState.updateInput(currentTabId, newVal)
          const effectiveAutoSend = resolveAutoSend(autoSend, options)
          if (effectiveAutoSend) {
            const result = await scheduleApiChatSend(currentTabId, apiChatSendTimeoutRef)
            handleApiChatSendResult(result)
            return result
          }
          return { success: true }
        } catch (err) {
          return { success: false, error: ensureErrorMessage(err, 'send_failed') }
        }
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

      const result = (await rawSendText(text, options)) ?? { success: false, error: 'cancelled' }
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
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendText,
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
        try {
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
          const UiStore = await getChatUiStore()
          const uiState = UiStore.getState()
          // Page captures arrive at 4x scale and routinely exceed the request
          // body budget once base64-inflated; scale them down before storing.
          const prepared = await prepareImageForUpload(imageData)
          uiState.addAttachment(currentTabId, prepared)
          if (options?.promptText) {
            const val = uiState.inputValueByTab[currentTabId] || ''
            uiState.updateInput(
              currentTabId,
              val ? val + '\n' + options.promptText : options.promptText
            )
          } else if (!uiState.inputValueByTab[currentTabId]?.trim()) {
            // No note was written, so the turn would carry an image with empty
            // text. Not every provider accepts an image-only content array, so
            // seed a minimal instruction to keep the attachment meaningful.
            uiState.updateInput(currentTabId, t('ai_send_image_only_prompt'))
          }
          const effectiveAutoSend = resolveAutoSend(autoSend, options)
          if (effectiveAutoSend) {
            const result = await scheduleApiChatSend(currentTabId, apiChatSendTimeoutRef)
            handleApiChatSendResult(result)
            if (result.success) showSuccess('sent_successfully')
            return result
          }
          // Auto-send is off: the attachment is staged in the api-chat composer
          // and waits for the user to press send. Reporting success here would
          // claim a delivery that has not happened yet.
          showSuccess(t('ai_send_staged'))
          return { success: true, mode: 'staged' }
        } catch (err) {
          return { success: false, error: ensureErrorMessage(err, 'send_failed') }
        }
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

      const result = (await rawSendImage(imageData, options)) ?? {
        success: false,
        error: 'cancelled'
      }
      if (isDeliveredSendResult(result)) {
        showSuccess('sent_successfully')
      } else if (isStagedSendResult(result)) {
        // Auto-send off: the image is now in the site's composer and the user
        // submits there. Say so instead of claiming a delivery.
        showSuccess(t('ai_send_staged'))
      } else if (result.error !== 'cancelled') {
        showWarning(toErrorToastKey(result.error))
      }
      return result
    },
    [
      currentAI,
      autoSend,
      ensureApiChatTab,
      getContentController,
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendImage,
      showSuccess,
      showWarning,
      t,
      waitForContentReady
    ]
  )

  return {
    sendTextToAI,
    sendImageToAI,
    cancelOngoing
  }
}
