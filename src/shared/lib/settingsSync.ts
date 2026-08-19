import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { getElectronApi, hasElectronApi } from './electronApi'
import { Logger } from './logger'

/**
 * Settings kept in the renderer's localStorage but mirrored to the main
 * process ConfigManager-backed store (`app_settings.json`). The renderer is
 * the source of truth while the app is running (fast, reactive); the main
 * process copy guarantees the preferences survive restarts, cache/profile
 * wipes and keep both processes in sync.
 *
 * See `electron/features/settings/appSettingsHandlers.ts` for the IPC side.
 */

export const SETTINGS_SYNC_KEYS: readonly string[] = [
  // Theme / appearance (zustand persist under `appearance-storage`)
  'appearance-storage',
  // Prompt templates
  STORAGE_KEYS.CUSTOM_PROMPTS,
  STORAGE_KEYS.SELECTED_PROMPT_ID,
  // Selector / AI lifecycle preferences
  STORAGE_KEYS.LAST_SELECTED_AI,
  STORAGE_KEYS.ENABLED_MODELS,
  STORAGE_KEYS.DEFAULT_AI_MODEL,
  STORAGE_KEYS.AUTO_SEND_ENABLED,
  STORAGE_KEYS.PINNED_AI_TABS,
  STORAGE_KEYS.AI_MAX_ALIVE_TABS,
  STORAGE_KEYS.AI_SLEEP_TIMEOUT_MS,
  STORAGE_KEYS.AI_NEVER_SLEEP_SITES,
  // Input behaviour
  STORAGE_KEYS.TEXT_INPUT_MODE,
  STORAGE_KEYS.TYPING_SPEED,
  // UI layout + misc
  STORAGE_KEYS.LEFT_PANEL_WIDTH,
  STORAGE_KEYS.APP_LANGUAGE,
  STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE,
  STORAGE_KEYS.LAST_PDF_READING
]

const SYNC_KEY_SET = new Set<string>(SETTINGS_SYNC_KEYS)

let installed = false
let suppressForwarding = false

export function isSyncableSettingKey(key: string): boolean {
  return SYNC_KEY_SET.has(key)
}

/** Fire-and-forget mirror of a single setting to the main process store. */
export async function syncSettingToMain(key: string, value: string): Promise<void> {
  if (!isSyncableSettingKey(key) || !hasElectronApi()) return
  const api = getElectronApi()
  if (!api?.saveAppSetting) return
  try {
    await api.saveAppSetting(key, value)
  } catch (error) {
    Logger.warn(`settingsSync: Failed to sync "${key}" to main process:`, error)
  }
}

/**
 * Patches `Storage.prototype.setItem` so every localStorage write to a
 * whitelisted key is mirrored to the main process. Patching the prototype
 * (instead of individual stores) covers every writer: `useLocalStorage`,
 * zustand persist, and direct `localStorage.setItem` calls alike.
 *
 * Returns an uninstall function (used by tests).
 */
export function installSettingsSync(): () => void {
  if (installed || typeof window === 'undefined') return () => {}
  installed = true

  const storageProto = Object.getPrototypeOf(window.localStorage) as Storage
  const originalSetItem = storageProto.setItem

  const patchedSetItem = function (this: Storage, key: string, value: string) {
    const isLocalStorage = this === window.localStorage
    originalSetItem.call(this, key, value)
    if (isLocalStorage && !suppressForwarding && isSyncableSettingKey(key)) {
      void syncSettingToMain(key, value)
    }
  }

  Object.defineProperty(storageProto, 'setItem', {
    value: patchedSetItem,
    writable: true,
    configurable: true
  })

  return () => {
    Object.defineProperty(storageProto, 'setItem', {
      value: originalSetItem,
      writable: true,
      configurable: true
    })
    installed = false
  }
}

/**
 * Restores settings from the main process store into localStorage. Must run
 * before React mounts so stores/hooks that read localStorage synchronously
 * pick up the persisted values. Forwarding is suppressed during hydration to
 * avoid echoing the writes straight back to the main process.
 */
export async function hydrateSettingsFromMain(): Promise<void> {
  if (!hasElectronApi()) return
  const api = getElectronApi()
  if (!api?.getAppSettings) return

  let settings: Record<string, string> | null = null
  try {
    settings = await api.getAppSettings()
  } catch (error) {
    Logger.warn('settingsSync: Failed to read settings from main process:', error)
    return
  }
  if (!settings) return

  suppressForwarding = true
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (isSyncableSettingKey(key)) {
        window.localStorage.setItem(key, value)
      }
    }
  } catch (error) {
    Logger.warn('settingsSync: Failed to hydrate localStorage:', error)
  } finally {
    suppressForwarding = false
  }
}
