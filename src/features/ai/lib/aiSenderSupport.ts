import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type {
  AiPlatform,
  AiSelectorConfig,
  AutomationConfig,
  SelectorHealth
} from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'

import type * as ErrorClassifier from '../../../../shared/lib/errorClassifier'
import type {
  AiErrorClassification,
  AiSendOptions,
  SendImageResult,
  SendTextResult
} from '../model/types'

let errorClassifierPromise: Promise<typeof ErrorClassifier> | null = null
function loadErrorClassifier() {
  if (!errorClassifierPromise) {
    errorClassifierPromise = import('../../../../shared/lib/errorClassifier')
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
   * Bu hook'a bağlı webview için bekleyen/işleyen tüm gönderimleri iptal
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

const webviewQueues = new WeakMap<WebviewController, Promise<unknown>>()

/**
 * Per-webview iptal bayrağı. `cancelWebviewSends` ile set edildiğinde,
 * sıradaki `executePipelineStep` çağrısı `cancelled` hatasıyla erken döner.
 * Bu sayede yeni bir istek geldiğinde eski istek yarı yolda iptal edilir.
 */
const webviewCancelFlags = new WeakMap<WebviewController, { cancelled: boolean }>()

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Resolves the effective auto-send flag for a single send request.
 * `forceAutoSend` always wins (e.g. user-clicked "Send" with auto-send disabled),
 * otherwise the per-call `autoSend` option is preferred, falling back to the
 * global `autoSend` preference.
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
 *   const cls = classifyResultError(result)
 *   if (cls && cls.retry === 'after-backoff') scheduleRetry()
 *   if (cls && cls.isUserActionable) showRepickDialog()
 */
export async function classifyResultError(
  result: SendTextResult | SendImageResult | null | undefined
): Promise<AiErrorClassification | null> {
  if (!result || !result.error) return null
  return classifyAiSendError(result.error)
}

/**
 * Per-webview iptal bayrağı kaynağı. `getOrCreateCancelFlag` ile aynı
 * webview için paylaşılan bir `{cancelled: boolean}` nesnesi döner; bu
 * nesne `cancelWebviewSends` ile set edilince sıradaki `executePipelineStep`
 * çağrısı "cancelled" hatasıyla erken döner.
 *
 * Bu sayede kullanıcı yeni bir istek tetiklediğinde, daha önce başlamış
 * ama henüz tamamlanmamış scriptler erken sonlandırılır — sayfa artık
 * yeni içerikle uğraşırken eski içerik için boşuna `executeJavaScript`
 * çağrısı yapılmaz.
 */
export function getOrCreateCancelFlag(webview: WebviewController): { cancelled: boolean } {
  let flag = webviewCancelFlags.get(webview)
  if (!flag) {
    flag = { cancelled: false }
    webviewCancelFlags.set(webview, flag)
  }
  return flag
}

/**
 * Belirli bir webview'e bağlı tüm bekleyen/işlem gören istekleri iptal eder.
 * Sonraki `executePipelineStep` çağrısı `cancelled` hatasıyla erken döner.
 *
 * Bayrak yoksa `getOrCreateCancelFlag` ile oluşturur (cancelled=false) ve
 * hemen true yapar. Bu sayede hiç `queueForWebview` çağrısı yapılmamış
 * webview'ler için de çağrı işe yarar.
 */
export function cancelWebviewSends(webview: WebviewController): void {
  const flag = getOrCreateCancelFlag(webview)
  flag.cancelled = true
}

/**
 * İptal bayrağını kontrol eder. Pipeline adımları `executeJavaScript`
 * çağrısı öncesinde bunu kontrol eder.
 */
export function isWebviewCancelled(webview: WebviewController): boolean {
  return webviewCancelFlags.get(webview)?.cancelled === true
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
 * Belirli bir webview için kuyruğa bir görev ekler. Yeni görev başlamadan
 * önce `webviewCancelFlags` üzerinden iptal kontrolü yapılır; eğer önceki
 * istek iptal edildiyse yenisi sıraya girmeden erken döner.
 *
 * Bu fonksiyonun bir başka sorumluluğu: yeni bir istek geldiğinde
 * `cancelWebviewSends` mantığını çağırarak **eski** kuyruktaki görevin
 * iptal bayrağını set eder. Yani "en yeni istek kazanır" semantiği.
 */
export function queueForWebview<T>(webview: WebviewController, task: () => Promise<T>): Promise<T> {
  // Önceki bekleyen/işleyen görevi iptal et.
  cancelWebviewSends(webview)
  // Yeni iptal bayrağı ayarla — sıradaki task yeni bir ömür başlatır.
  const flag = getOrCreateCancelFlag(webview)
  flag.cancelled = false

  const previous = webviewQueues.get(webview) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (flag.cancelled) {
        // Önceki task bunu tetiklemiş; bu task çalışmadan çıkar.
        return undefined as unknown as T
      }
      return task()
    })
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
  baseConfig: AiPlatform | AiConfig
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

    const data = {
      config: finalConfig,
      regex: finalConfig.domainRegex ? new RegExp(finalConfig.domainRegex) : null
    }

    configCache.key = cacheKey
    configCache.cache = data
    return data
  } catch (err) {
    reportSuppressedError('getCachedAiConfig', { cause: err })
    return { config: baseConfig, regex: null }
  }
}
