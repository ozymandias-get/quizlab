/**
 * Self-healing persistence.
 *
 * The webview never touches the config file. The flow is always:
 *
 *   injected script → serializable evidence → send pipeline →
 *   `saveAiConfig` IPC → `sanitizeConfig` → disk
 *
 * which reuses the existing config domain instead of introducing a second
 * persistence path.
 */
import type { AiSelectorConfig } from '@shared-core/types'

import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'

import { getElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'

import type { QueryClient } from '@tanstack/react-query'

import type { ConfigCache } from '../aiSenderSupport'
import { resetConfigCache } from '../aiSenderSupport'

export const SELECTOR_REPAIR_LOG_PREFIX = '[SelectorRepair]'

export interface ApplySelectorRepairParams {
  hostname: string
  patch: AiSelectorConfig
  queryClient: QueryClient
  configCache: ConfigCache
}

/**
 * Persists a repair patch, invalidates the React Query cache and drops the
 * memoized runtime config.
 *
 * The runtime cache reset is the part that is easy to forget and expensive to
 * miss: without it the next send would keep injecting the pre-repair selectors
 * even though disk is already correct, so the app would look like nothing
 * happened until it was restarted.
 *
 * @returns true when the patch reached the config store.
 */
export async function applySelectorRepair(params: ApplySelectorRepairParams): Promise<boolean> {
  const { hostname, patch, queryClient, configCache } = params

  try {
    const api = getElectronApi()
    if (!api) {
      Logger.warn(`${SELECTOR_REPAIR_LOG_PREFIX} electron API unavailable, repair not persisted`)
      return false
    }

    const saved = await api.saveAiConfig(hostname, patch)
    if (!saved) {
      Logger.warn(`${SELECTOR_REPAIR_LOG_PREFIX} saveAiConfig rejected the repair patch`)
      return false
    }

    queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
    queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
    resetConfigCache(configCache)
    return true
  } catch (err) {
    Logger.error(`${SELECTOR_REPAIR_LOG_PREFIX} failed to persist repair`, err)
    return false
  }
}
