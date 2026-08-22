import { queryClient } from '@app/providers/queryClient'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { QUERY_KEYS } from '@shared/query/queryKeys'

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

// Single source of truth: any external storage mutation must refresh the
// corresponding React Query cache, otherwise a stale in-memory copy (e.g. an
// open composer holding the old prompt list) will overwrite the fresh value
// when it next writes to disk.
const SESSIONS_STORAGE_KEY = 'quizlab_api_chat_sessions_v2'

function invalidateQueriesForStorageKey(key: string): void {
  try {
    if (key === SESSIONS_STORAGE_KEY) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI.SESSIONS })
      return
    }
    // Generic: any query whose key contains this storage key
    queryClient.invalidateQueries({
      predicate: (query: { queryKey: unknown[] }) =>
        Array.isArray(query.queryKey) && query.queryKey.includes(key)
    } as unknown as never)
    // Exact fallback for tests that use the raw storage key as queryKey
    queryClient.invalidateQueries({ queryKey: [key] } as never)
  } catch {
    // Never break storage sync due to query errors
  }
}

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
 * Also installs storage-event listeners that keep React Query in sync:
 * whenever another tab — or another hook instance in the same tab via the
 * custom `local-storage` event — mutates a key, the corresponding query is
 * invalidated so the stale in-memory copy is refetched instead of overwriting.
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

  // React Query single source of truth: external mutations (other tab or
  // another hook instance) must invalidate the query cache. Without this,
  // a stale `customPrompts` list held by an open composer would overwrite
  // a freshly added prompt when the composer next writes.
  const handleExternalStorage = (e: StorageEvent) => {
    if (e.key && (isSyncableSettingKey(e.key) || e.key === SESSIONS_STORAGE_KEY)) {
      invalidateQueriesForStorageKey(e.key)
    } else if (e.key === null) {
      // `clear()` — invalidate all known sync keys
      for (const k of SETTINGS_SYNC_KEYS) invalidateQueriesForStorageKey(k)
      invalidateQueriesForStorageKey(SESSIONS_STORAGE_KEY)
    }
  }

  const handleLocalSyncEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ key: string; value: string }>).detail
    if (detail?.key && (isSyncableSettingKey(detail.key) || detail.key === SESSIONS_STORAGE_KEY)) {
      invalidateQueriesForStorageKey(detail.key)
    }
  }

  window.addEventListener('storage', handleExternalStorage)
  window.addEventListener('local-storage', handleLocalSyncEvent as EventListener)

  return () => {
    Object.defineProperty(storageProto, 'setItem', {
      value: originalSetItem,
      writable: true,
      configurable: true
    })
    window.removeEventListener('storage', handleExternalStorage)
    window.removeEventListener('local-storage', handleLocalSyncEvent as EventListener)
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
