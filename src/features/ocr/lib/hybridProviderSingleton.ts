/**
 * Shared hybrid OCR provider singleton.
 *
 * Extracted from `useOcrActions.ts`: provider lifecycle/caching (engine
 * initialization keyed by language/quality/sensitivity/forceOcr) changes for
 * different reasons than page/area job orchestration, so it owns a separate
 * module. All hook callers share the same instance.
 */
import { createHybridProvider } from '../providers/hybridProvider'
import type { OcrConfig } from '../types'

// Singleton provider instance — shared across all hook callers
let hybridProvider: ReturnType<typeof createHybridProvider> | null = null
let providerInitPromise: Promise<void> | null = null
let providerConfigKey: string | null = null

export function getHybridProvider(
  config: OcrConfig,
  signal?: AbortSignal
): Promise<ReturnType<typeof createHybridProvider>> {
  const key = `${config.language}:${config.quality}:${config.sensitivity}:${config.forceOcr ? '1' : '0'}`
  if (hybridProvider && providerConfigKey === key) return Promise.resolve(hybridProvider)
  if (providerInitPromise && providerConfigKey === key)
    return providerInitPromise.then(() => hybridProvider!)

  if (!hybridProvider) hybridProvider = createHybridProvider()
  providerConfigKey = key
  providerInitPromise = hybridProvider
    .initialize(config, signal)
    .then(() => {
      providerInitPromise = null
    })
    .catch((e) => {
      providerInitPromise = null
      throw e
    })
  return providerInitPromise.then(() => hybridProvider!)
}
