import { AI_CONFIG_KEY } from '@platform/electron/api/useAiApi'

import { queryClient } from '@app/providers/queryClient'
import { invalidateConfigCaches } from '@shared/lib/configCacheEpoch'
import { getElectronApi } from '@shared/lib/electronApi'

import { useEffect } from 'react'

/**
 * Picks up a selector the Chrome extension saved.
 *
 * The bridge writes through the main-process config store, so the renderer
 * never saw a mutation and neither the React Query cache nor the runtime
 * config memo would know. Without this the automation would keep injecting the
 * pre-pick selectors until the app restarted; with it the next send reads the
 * new locators immediately.
 *
 * The app's singleton query client is used directly (not `useQueryClient`) so
 * the subscription is one shell-level effect and does not depend on where the
 * component sits in the provider tree.
 */
export function useChromeSelectorSync(): void {
  useEffect(() => {
    const api = getElectronApi()
    if (!api || typeof api.onAiConfigChanged !== 'function') return

    return api.onAiConfigChanged((hostname) => {
      invalidateConfigCaches()
      if (hostname) queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY(hostname) })
      queryClient.invalidateQueries({ queryKey: AI_CONFIG_KEY() })
    })
  }, [])
}
