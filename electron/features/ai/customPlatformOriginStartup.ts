/**
 * Registers the origins of persisted custom platforms at startup.
 *
 * Restored tabs of custom platforms may be attached before the renderer reads
 * the AI registry. Registering the origins at startup ensures the permission
 * policy allows their partitions immediately.
 */
import { registerCustomPlatformOrigin } from '../../app/window/permissionPolicy.js'
import { readCustomPlatforms } from './customPlatformStore.js'

export async function registerCustomPlatformOriginsAtStartup(
  setupSession?: (partition: string) => void
): Promise<void> {
  try {
    const platforms = await readCustomPlatforms()
    for (const platform of Object.values(platforms)) {
      if (!platform.partition?.startsWith('persist:ai_custom_') || !platform.url) continue
      try {
        registerCustomPlatformOrigin(platform.partition, platform.url)
        setupSession?.(platform.partition)
      } catch {
        // Ignore single platform registration failure
      }
    }
  } catch {
    // Survive a store that cannot be read
  }
}
