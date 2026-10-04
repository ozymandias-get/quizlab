import type { AiPlatform } from '@shared-core/types'

import { ConfigManager } from '../../core/ConfigManager.js'
import { getCustomPlatformsPath } from '../../core/coreHelpers.js'

export type CustomPlatformsMap = Record<string, AiPlatform>

let store: ConfigManager<CustomPlatformsMap> | null = null

/**
 * Single accessor for the user-added platform store.
 *
 * `getCustomPlatformsPath()` resolves `userData`, so the store is built on first
 * use (after `app` is ready) rather than at import time. Sharing one instance
 * keeps the write-through cache coherent between the registry IPC handler and
 * the remote-site view manager.
 */
export function getCustomPlatformStore(): ConfigManager<CustomPlatformsMap> {
  store ??= new ConfigManager<CustomPlatformsMap>(getCustomPlatformsPath())
  return store
}

export async function readCustomPlatforms(force = false): Promise<CustomPlatformsMap> {
  return getCustomPlatformStore().read(force)
}
