import type { RefObject } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'
import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'
import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig, AutomationConfig, SelectorHealth } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'
import type { AiSendOptions, SendImageResult, SendTextResult } from '../model/types'

export interface AiConfig extends AiSelectorConfig {
  domainRegex?: string
  imageWaitTime?: number
  /** Görsel yapıştırdıktan sonra ek notu sona ekle; false = tüm alanı yeniden yaz */
  appendPromptAfterPaste?: boolean
  health?: SelectorHealth
}

interface CacheData {
  config: AiConfig
  regex: RegExp | null
}

export interface ConfigCache {
  key: string | null
  data: CacheData | null
}

export interface UseAiSenderReturn {
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<SendTextResult>
  sendImageToAI: (imageDataUrl: string, options?: AiSendOptions) => Promise<SendImageResult>
}

export const CLIPBOARD_WAIT_DELAY = 800
export const POST_PASTE_PROMPT_DELAY = 900
export const IMAGE_UPLOAD_WAIT_DELAY = 1000
export const IMAGE_SUBMIT_READY_SETTLE_DELAY = 1200
export const IMAGE_SUBMIT_READY_TIMEOUT_BUFFER = 6000

const webviewQueues = new WeakMap<WebviewController, Promise<unknown>>()

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Maps browser/runtime messages to stable error codes.
 */
export function normalizeSendErrorCode(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'Illegal invocation') return fallback
    return trimmed
  }
  if (typeof raw === 'number') return String(raw)
  return fallback
}

/**
 * Merges two AiConfigs, prioritizing the second one (override) if properties are defined.
 */
export function mergeAiConfigs(base: AiConfig, override: AiConfig | null | undefined): AiConfig {
  if (!override || typeof override !== 'object') return base

  const merged: AiConfig = { ...base }
  const keys = Object.keys(override) as (keyof AiConfig)[]

  for (const key of keys) {
    const value = override[key]
    if (value !== undefined) {
      if (key === 'appendPromptAfterPaste') {
        merged[key] = value !== false
      } else {
        ;(merged as any)[key] = value
      }
    }
  }

  // Handle submitMode normalization specifically if it changed
  merged.submitMode =
    normalizeSubmitMode(override.submitMode) || normalizeSubmitMode(base.submitMode) || 'mixed'

  return merged
}

export function queueForWebview<T>(webview: WebviewController, task: () => Promise<T>): Promise<T> {
  const previous = webviewQueues.get(webview) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(task)
  webviewQueues.set(
    webview,
    next.catch(() => undefined)
  )
  return next
}

export function toAutomationConfig(config: AiConfig): AutomationConfig {
  return {
    input: typeof config.input === 'string' || config.input === null ? config.input : null,
    button: typeof config.button === 'string' || config.button === null ? config.button : null,
    waitFor: typeof config.waitFor === 'string' || config.waitFor === null ? config.waitFor : null,
    submitMode: normalizeSubmitMode(config.submitMode) || undefined,
    inputCandidates: Array.isArray(config.inputCandidates) ? config.inputCandidates : null,
    buttonCandidates: Array.isArray(config.buttonCandidates) ? config.buttonCandidates : null,
    inputFingerprint: config.inputFingerprint || null,
    buttonFingerprint: config.buttonFingerprint || null,
    sourceUrl: typeof config.sourceUrl === 'string' ? config.sourceUrl : null,
    sourceHostname: typeof config.sourceHostname === 'string' ? config.sourceHostname : null,
    canonicalHostname:
      typeof config.canonicalHostname === 'string' ? config.canonicalHostname : null,
    health: config.health || undefined,
    version: config.version === 2 ? 2 : undefined
  }
}

export function buildPromptText(text: string, prompt?: string | null) {
  if (!prompt) {
    return text
  }

  return `${prompt}\n\n${text}`
}

export function mergePromptText(basePrompt?: string | null, extraPrompt?: string | null) {
  const normalizedBase = basePrompt?.trim()
  const normalizedExtra = extraPrompt?.trim()

  if (normalizedBase && normalizedExtra) {
    return `${normalizedBase}\n\n${normalizedExtra}`
  }

  return normalizedExtra || normalizedBase || ''
}

export function isWebviewUsable(
  webviewRef: RefObject<WebviewController | null>,
  webview: WebviewController,
  expected?: WebviewController | null
) {
  if (expected && webview !== expected) {
    return false
  }
  if (webviewRef.current !== webview) {
    return false
  }
  return webview.isDestroyed?.() !== true
}

export async function getCachedAiConfig(options: {
  baseConfig: AiConfig
  configCache: ConfigCache
  currentAI: string
  queryClient: QueryClient
  webview: WebviewController
}): Promise<CacheData> {
  const { baseConfig, configCache, currentAI, queryClient, webview } = options

  if (typeof webview.getURL !== 'function') {
    return { config: baseConfig, regex: null }
  }

  const currentUrl = webview.getURL()
  if (!currentUrl) {
    return { config: baseConfig, regex: null }
  }

  const configSignature = JSON.stringify(baseConfig || {})
  const cacheKey = `${currentUrl}::${currentAI}::${configSignature}`

  if (configCache.key === cacheKey && configCache.data) {
    return configCache.data
  }

  try {
    const hostname = new URL(currentUrl).hostname
    const customConfig = (await queryClient.fetchQuery({
      queryKey: AI_CONFIG_KEY(hostname),
      queryFn: () => getElectronApi().getAiConfig(hostname),
      staleTime: 1000 * 60 * 5
    })) as AiConfig | null

    const selectorConfig = customConfig && typeof customConfig === 'object' ? customConfig : null

    const finalConfig = mergeAiConfigs(baseConfig, selectorConfig)

    const data = {
      config: finalConfig,
      regex: finalConfig.domainRegex ? new RegExp(finalConfig.domainRegex) : null
    }

    configCache.key = cacheKey
    configCache.data = data
    return data
  } catch (err) {
    reportSuppressedError('getCachedAiConfig', { cause: err })
    return { config: baseConfig, regex: null }
  }
}
