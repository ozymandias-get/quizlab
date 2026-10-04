import type { AiPlatform } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type { SendTextResult } from '../../model/types'
import {
  type AiConfig,
  type ConfigCache,
  getCachedAiConfig,
  isContentUsable
} from '../aiSenderSupport'

export interface ResolvedSendContext {
  aiConfig: AiConfig
  currentUrl: string
}

interface ResolveSendContextParams {
  contentRef: RefObject<AiContentController | null>
  content: AiContentController
  scheduledContent: AiContentController
  aiRegistry: Record<string, AiPlatform> | null
  currentAI: string
  queryClient: QueryClient
  configCache: ConfigCache
}

export function isSendError(
  sendContextOrError: ResolvedSendContext | SendTextResult
): sendContextOrError is SendTextResult {
  return 'success' in sendContextOrError
}

export async function resolveSendContext({
  contentRef,
  content,
  scheduledContent,
  aiRegistry,
  currentAI,
  queryClient,
  configCache
}: ResolveSendContextParams): Promise<ResolvedSendContext | SendTextResult> {
  if (!aiRegistry) {
    return { success: false, error: 'registry_not_loaded' }
  }

  if (!isContentUsable(contentRef, content, scheduledContent)) {
    return { success: false, error: 'webview_destroyed' }
  }

  const baseAiConfig = aiRegistry[currentAI]
  if (!baseAiConfig) {
    return { success: false, error: 'config_not_found' }
  }

  if (typeof content.getURL !== 'function') {
    return { success: false, error: 'webview_api_missing' }
  }

  const { config: aiConfig, regex } = await getCachedAiConfig({
    baseConfig: baseAiConfig,
    configCache,
    currentAI,
    queryClient,
    content
  })

  const currentUrl = content.getURL()
  if (!currentUrl) {
    return { success: false, error: 'webview_url_missing' }
  }

  if (regex && !regex.test(currentUrl)) {
    return { success: false, error: 'wrong_url', actualUrl: currentUrl }
  }

  return { aiConfig, currentUrl }
}
