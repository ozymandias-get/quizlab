import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import type { SendTextResult } from '../../model/types'
import {
  getCachedAiConfig,
  isWebviewUsable,
  type AiConfig,
  type ConfigCache
} from '../aiSenderSupport'
import type { WebviewController } from '@shared-core/types/webview'

export interface ResolvedSendContext {
  aiConfig: AiConfig
  currentUrl: string
}

interface ResolveSendContextParams {
  webviewRef: RefObject<WebviewController | null>
  webview: WebviewController
  scheduledWebview: WebviewController
  aiRegistry: Record<string, AiConfig> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
}

export function isSendError(result: ResolvedSendContext | SendTextResult): result is SendTextResult {
  return 'success' in result
}

export async function resolveSendContext({
  webviewRef,
  webview,
  scheduledWebview,
  aiRegistry,
  currentAI,
  queryClient,
  configCache
}: ResolveSendContextParams): Promise<ResolvedSendContext | SendTextResult> {
  if (!aiRegistry) {
    return { success: false, error: 'registry_not_loaded' }
  }

  if (!isWebviewUsable(webviewRef, webview, scheduledWebview)) {
    return { success: false, error: 'webview_destroyed' }
  }

  const baseAiConfig = aiRegistry[currentAI]
  if (!baseAiConfig) {
    return { success: false, error: 'config_not_found' }
  }

  if (typeof webview.getURL !== 'function') {
    return { success: false, error: 'webview_api_missing' }
  }

  const { config: aiConfig, regex } = await getCachedAiConfig({
    baseConfig: baseAiConfig,
    configCache,
    currentAI,
    queryClient,
    webview
  })

  const currentUrl = webview.getURL()
  if (!currentUrl) {
    return { success: false, error: 'webview_url_missing' }
  }

  if (regex && !regex.test(currentUrl)) {
    return { success: false, error: 'wrong_url', actualUrl: currentUrl }
  }

  return { aiConfig, currentUrl }
}
