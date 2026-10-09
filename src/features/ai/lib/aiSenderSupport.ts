// `@shared-core/*` rather than a relative path into `shared/`: the renderer
// names the cross-process tree by alias, and this was the one place that
// reached it relatively.
import type * as ErrorClassifier from '@shared-core/lib/errorClassifier'
import {
  normalizeSubmitMode,
  toAutomationConfig as normalizeAutomationConfig
} from '@shared-core/selectorConfig'
import type { AiPlatform, AiSelectorConfig, SelectorHealth } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type {
  AiErrorClassification,
  AiSendOptions,
  SendImageResult,
  SendTextResult
} from '../model/types'

let errorClassifierPromise: Promise<typeof ErrorClassifier> | null = null
function loadErrorClassifier() {
  if (!errorClassifierPromise) {
    errorClassifierPromise = import('@shared-core/lib/errorClassifier')
  }
  return errorClassifierPromise
}

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
  cache: CacheData | null
}

export interface UseAiSenderReturn {
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<SendTextResult>
  sendImageToAI: (imageDataUrl: string, options?: AiSendOptions) => Promise<SendImageResult>
  /**
   * Bu hook'a bağlı content için bekleyen/işleyen tüm gönderimleri iptal
   * eder. Sıradaki `executePipelineStep` çağrısı `cancelled` hatasıyla
   * erken döner. Yeni bir istek tetiklendiğinde **otomatik** olarak da
   * çağrılır ("en yeni istek kazanır" semantiği).
   */
  cancelOngoing: () => void
}

export const POST_PASTE_PROMPT_DELAY = 900
export const IMAGE_UPLOAD_WAIT_DELAY = 1000
export const IMAGE_SUBMIT_READY_SETTLE_DELAY = 1200
export const IMAGE_SUBMIT_READY_TIMEOUT_BUFFER = 6000

const contentQueues = new WeakMap<AiContentController, Promise<unknown>>()

/**
 * Per-content iptal bayrağı. `cancelContentSends` ile set edildiğinde,
 * sıradaki `executePipelineStep` çağrısı `cancelled` hatasıyla erken döner.
 * Bu sayede yeni bir istek geldiğinde eski istek yarı yolda iptal edilir.
 */
const contentCancelFlags = new WeakMap<AiContentController, { cancelled: boolean }>()
const contentVersions = new WeakMap<AiContentController, number>()
const contentRunningVersions = new WeakMap<AiContentController, number>()

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Resolves the effective auto-send flag for a single send request. The global
 * preference applies unless a caller overrides it per send; there is no "force"
 * override, so a disabled auto-send is never bypassed.
 */
export { normalizeSendErrorCode, resolveAutoSend } from './sendUtils'

/**
 * Bir hata kodunu sınıflandırır. Pipeline içindeki son adım hata kodu
 * döndüğünde çağrılır; sonuç `AiSendDiagnostics.classification` alanına
 * yazılır ve UI katmanı tarafından (toast i18n, fallback kararı) tüketilir.
 *
 * Bu fonksiyon `classifyAutomationError` (electron) ile aynı tabloyu
 * paylaşır; burada yalnızca renderer'ın ihtiyaç duyduğu alt kümeyi
 * (toastKey + retry + triggerFallback) taşır.
 */
export async function classifyAiSendError(raw: unknown): Promise<AiErrorClassification> {
  const mod = await loadErrorClassifier()
  const cls = mod.classifyAutomationError(raw)
  return {
    code: cls.code,
    category: cls.category,
    retry: cls.retry,
    toastKey: cls.toastKey,
    triggerFallback: cls.triggerFallback,
    isUserActionable: cls.isUserActionable
  }
}

/**
 * Bir `SendTextResult` veya `SendImageResult` üzerindeki `error` alanını
 * alıp sınıflandırılmış nesneye dönüştürür. Hata yoksa `null` döner.
 *
 * Kullanım:
 *   const cls = classifyResultError(sendResult)
 *   if (cls && cls.retry === 'after-backoff') scheduleRetry()
 *   if (cls && cls.isUserActionable) showRepickDialog()
 */
export async function classifyResultError(
  sendResult: SendTextResult | SendImageResult | null | undefined
): Promise<AiErrorClassification | null> {
  if (!sendResult || !sendResult.error) return null
  return classifyAiSendError(sendResult.error)
}

/**
 * Per-content iptal bayrağı kaynağı. `getOrCreateCancelFlag` ile aynı
 * content için paylaşılan bir `{cancelled: boolean}` nesnesi döner; bu
 * nesne `cancelContentSends` ile set edilince sıradaki `executePipelineStep`
 * çağrısı "cancelled" hatasıyla erken döner.
 *
 * Bu sayede kullanıcı yeni bir istek tetiklediğinde, daha önce başlamış
 * ama henüz tamamlanmamış scriptler erken sonlandırılır — sayfa artık
 * yeni içerikle uğraşırken eski içerik için boşuna `executeJavaScript`
 * çağrısı yapılmaz.
 */
export function getOrCreateCancelFlag(content: AiContentController): { cancelled: boolean } {
  let flag = contentCancelFlags.get(content)
  if (!flag) {
    flag = { cancelled: false }
    contentCancelFlags.set(content, flag)
  }
  return flag
}

/**
 * Belirli bir content'e bağlı tüm bekleyen/işlem gören istekleri iptal eder.
 * Sonraki `executePipelineStep` çağrısı `cancelled` hatasıyla erken döner.
 *
 * Bayrak yoksa `getOrCreateCancelFlag` ile oluşturur (cancelled=false) ve
 * hemen true yapar. Bu sayede hiç `queueForContent` çağrısı yapılmamış
 * content'ler için de çağrı işe yarar.
 */
export function cancelContentSends(content: AiContentController): void {
  const flag = getOrCreateCancelFlag(content)
  flag.cancelled = true
  const v = (contentVersions.get(content) ?? 0) + 1
  contentVersions.set(content, v)
}

/**
 * İptal bayrağını kontrol eder. Pipeline adımları `executeJavaScript`
 * çağrısı öncesinde bunu kontrol eder.
 */
export function isContentCancelled(content: AiContentController): boolean {
  const running = contentRunningVersions.get(content)
  if (running !== undefined) {
    const current = contentVersions.get(content)
    if (current !== undefined && current !== running) return true
  }
  return contentCancelFlags.get(content)?.cancelled === true
}

/**
 * Merges two AiConfigs, prioritizing the second one (override) if properties are defined.
 */
export function mergeAiConfigs(base: AiConfig, override: AiConfig | null | undefined): AiConfig {
  if (!override || typeof override !== 'object') return base

  const merged: AiConfig = { ...base }
  const keys = Object.keys(override) as (keyof AiConfig)[]

  for (const key of keys) {
    const val = override[key]
    if (val !== undefined) {
      if (key === 'appendPromptAfterPaste') {
        merged[key] = val !== false
      } else {
        ;(merged as any)[key] = val
      }
    }
  }

  // Handle submitMode normalization specifically if it changed
  merged.submitMode =
    normalizeSubmitMode(override.submitMode) || normalizeSubmitMode(base.submitMode) || 'mixed'

  return merged
}

/**
 * Belirli bir content için kuyruğa bir görev ekler. Yeni görev başlamadan
 * önce `contentCancelFlags` üzerinden iptal kontrolü yapılır; eğer önceki
 * istek iptal edildiyse yenisi sıraya girmeden erken döner.
 *
 * Bu fonksiyonun bir başka sorumluluğu: yeni bir istek geldiğinde
 * `cancelContentSends` mantığını çağırarak **eski** kuyruktaki görevin
 * iptal bayrağını set eder. Yani "en yeni istek kazanır" semantiği.
 */
export function queueForContent<T>(
  content: AiContentController,
  task: () => Promise<T>
): Promise<T> {
  // Version-based cancellation: each queue entry gets a monotonic version.
  // If a newer entry arrives while this one is queued or running, the older
  // one is discarded via version mismatch (covers both queue wait and
  // mid-pipeline isContentCancelled checks via contentRunningVersions).
  const myVersion = (contentVersions.get(content) ?? 0) + 1
  contentVersions.set(content, myVersion)
  // Keep flag compatibility for external cancelContentSends callers
  const flag: { cancelled: boolean } = { cancelled: false }
  contentCancelFlags.set(content, flag)
  // Mark any previous running task as cancelled via version bump
  // (the previous flag object remains reachable by its task's closure via
  // version mismatch, not via shared mutation).

  const previous = contentQueues.get(content) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if ((contentVersions.get(content) ?? 0) !== myVersion) {
        return { success: false, error: 'cancelled' } as unknown as T
      }
      contentRunningVersions.set(content, myVersion)
      try {
        return await task()
      } finally {
        if (contentRunningVersions.get(content) === myVersion) {
          contentRunningVersions.delete(content)
        }
      }
    })
  contentQueues.set(
    content,
    next.catch(() => undefined)
  )
  return next
}

export const toAutomationConfig = normalizeAutomationConfig

/**
 * Drops the memoized per-content AI config.
 *
 * The cache key embeds the URL, the current AI and the *base* registry config
 * — none of which change when a selector repair is promoted on disk. Without
 * this reset the runtime would keep feeding the pre-repair selectors into the
 * next send even though the persisted config is already correct.
 */
export function resetConfigCache(configCache: ConfigCache): void {
  configCache.key = null
  configCache.cache = null
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

export function isContentUsable(
  contentRef: RefObject<AiContentController | null>,
  content: AiContentController,
  expected?: AiContentController | null
) {
  if (expected && content !== expected) {
    return false
  }
  if (contentRef.current !== content) {
    return false
  }
  return content.isDestroyed?.() !== true
}

export async function getCachedAiConfig(options: {
  baseConfig: AiPlatform | AiConfig
  configCache: ConfigCache
  currentAI: string
  queryClient: QueryClient
  content: AiContentController
}): Promise<CacheData> {
  const { baseConfig, configCache, currentAI, queryClient, content } = options

  if (typeof content.getURL !== 'function') {
    return { config: baseConfig, regex: null }
  }

  const currentUrl = content.getURL()
  if (!currentUrl) {
    return { config: baseConfig, regex: null }
  }

  const configSignature = JSON.stringify(baseConfig || {})
  const cacheKey = `${currentUrl}::${currentAI}::${configSignature}`

  if (configCache.key === cacheKey && configCache.cache) {
    return configCache.cache
  }

  try {
    const hostname = new URL(currentUrl).hostname
    const customConfig = (await queryClient.fetchQuery({
      queryKey: AI_CONFIG_KEY(hostname),
      queryFn: () => {
        const api = getElectronApi()
        if (!api) return null
        return api.getAiConfig(hostname)
      },
      staleTime: 1000 * 60 * 5
    })) as AiConfig | null

    const selectorConfig = customConfig && typeof customConfig === 'object' ? customConfig : null

    const finalConfig = mergeAiConfigs(baseConfig, selectorConfig)

    let regex: RegExp | null = null
    if (finalConfig.domainRegex) {
      if (finalConfig.domainRegex.length <= 200) {
        try {
          regex = new RegExp(finalConfig.domainRegex)
        } catch {
          // invalid pattern — regex stays null
        }
      }
    }

    const data = {
      config: finalConfig,
      regex
    }

    configCache.key = cacheKey
    configCache.cache = data
    return data
  } catch (err) {
    reportSuppressedError('getCachedAiConfig', { cause: err })
    return { config: baseConfig, regex: null }
  }
}
