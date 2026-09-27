import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import type * as AiFeatureModule from '@features/ai'
import type { AiSendOptions } from '@features/ai'
import { prepareImageForUpload, useAiSender } from '@features/ai'
import { isDeliveredSendResult, isStagedSendResult, resolveAutoSend } from '@features/ai'

import type { Tab } from '@app/providers/ai/types'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { toErrorToastKey } from './errorToastKey'
import {
  cancelScheduledApiChatSends,
  scheduleApiChatSend,
  waitForApiChatTab
} from './lib/apiChatSend'
import { waitForWebviewReadyForSend } from './webviewSendReadiness'

let chatUiStoreModule: typeof AiFeatureModule | null = null

async function getChatUiStore() {
  if (!chatUiStoreModule) {
    chatUiStoreModule = await import('@features/ai')
  }
  return chatUiStoreModule.useChatUiStore
}

interface UseAiMessagingParams {
  getWebviewInstance: (tabId?: string) => WebviewController | null
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
  getWebviewInstance,
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

  const webviewRefProxy = useMemo(
    () => ({
      get current() {
        return getWebviewInstance()
      }
    }),
    [getWebviewInstance]
  )
  const {
    sendTextToAI: rawSendText,
    sendImageToAI: rawSendImage,
    cancelOngoing
  } = useAiSender(webviewRefProxy, currentAI, autoSend, aiRegistry, activeTabId)

  const waitForWebviewReady = useCallback(
    (timeoutMs = 10_000) => waitForWebviewReadyForSend(getWebviewInstance, timeoutMs),
    [getWebviewInstance]
  )

  const ensureApiChatTab = useCallback(async () => {
    // The active tab is not necessarily an api-chat tab. Attaching to a PDF or
    // webview tab id writes the image into per-tab state that no composer
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
        // api-chat uses a store-based tab, not a webview. If no tab exists,
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

      // For webview-based models, ensure a webview instance is available.
      // In normal split view, the user may not have an AI tab open yet.
      const webview = getWebviewInstance()
      if (!webview) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForWebviewReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForWebview', {
          cause: new Error('Webview did not become ready in time')
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
      getWebviewInstance,
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendText,
      showWarning,
      waitForWebviewReady
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
          // request later. Mirrors the guard in the webview image pipeline.
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

      // For webview-based models, ensure a webview instance is available
      const webview = getWebviewInstance()
      if (!webview) {
        openAiWorkspace(currentAI)
      }
      const isReady = await waitForWebviewReady()
      if (!isReady) {
        reportSuppressedError('useAiMessaging.waitForWebview', {
          cause: new Error('Webview did not become ready in time for image send')
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
      getWebviewInstance,
      handleApiChatSendResult,
      openAiWorkspace,
      rawSendImage,
      showSuccess,
      showWarning,
      t,
      waitForWebviewReady
    ]
  )

  return {
    sendTextToAI,
    sendImageToAI,
    cancelOngoing
  }
}
