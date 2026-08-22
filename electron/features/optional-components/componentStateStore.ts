import { ConfigManager } from '../../core/ConfigManager.js'
import { getComponentsStatePath } from '../../core/coreHelpers.js'
import type { OptionalComponentPersistedState, OptionalComponentsFile } from './types.js'

/**
 * Persistence for optional component state, following the repo's flat-file
 * convention (ConfigManager JSON files under userData, e.g.
 * pdf-allowlist.json / app_settings.json). Actual component artifacts will
 * live in userData/components/<component-id>/ in later phases; this store only
 * tracks lifecycle metadata. The file is registered as protected in
 * electron/core/cacheRegistry.ts so cache cleanup never wipes it.
 */

const DEFAULT_STATE: OptionalComponentPersistedState = {
  status: 'not_installed',
  version: null,
  error: null,
  updatedAt: 0
}

let stateManager: ConfigManager<OptionalComponentsFile> | null = null

function getManager(): ConfigManager<OptionalComponentsFile> {
  if (!stateManager) {
    stateManager = new ConfigManager<OptionalComponentsFile>(getComponentsStatePath())
  }
  return stateManager
}

export async function getComponentPersistedState(
  componentId: string
): Promise<OptionalComponentPersistedState> {
  const data = await getManager().read()
  const record = data[componentId]
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.status !== 'string' ||
    record.updatedAt === undefined
  ) {
    return { ...DEFAULT_STATE }
  }
  return record
}

export async function setComponentPersistedState(
  componentId: string,
  patch: Partial<Omit<OptionalComponentPersistedState, 'updatedAt'>>
): Promise<void> {
  await getManager().update((current) => ({
    ...current,
    [componentId]: {
      ...DEFAULT_STATE,
      ...current[componentId],
      ...patch,
      updatedAt: Date.now()
    }
  }))
}

/** Test-only: drop the cached manager instance. */
export function resetComponentStateStoreForTests(): void {
  stateManager = null
}
