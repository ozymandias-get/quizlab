import { queryClient } from '@app/providers/queryClient'
import { TOAST_DURATION } from '@shared/constants/appConstants'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'
import { Logger } from '@shared/lib/logger'
import { QUERY_KEYS } from '@shared/query/queryKeys'
import { useToastStore } from '@shared/stores/toastStore'

import i18next from 'i18next'

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
  // Appearance (zustand persist under `appearance-storage`)
  'appearance-storage',
  // Prompt templates
  STORAGE_KEYS.CUSTOM_PROMPTS,
  STORAGE_KEYS.SELECTED_PROMPT_ID,
  // Selector / AI lifecycle preferences
  STORAGE_KEYS.LAST_SELECTED_AI,
  STORAGE_KEYS.ENABLED_MODELS,
  STORAGE_KEYS.DEFAULT_AI_MODEL,
  STORAGE_KEYS.AUTO_SEND_ENABLED,
  STORAGE_KEYS.AI_TABS,
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

/**
 * Values whose mirror to the main process has not completed yet.
 *
 * The renderer writes a setting locally and sends it over IPC. The IPC call is
 * asynchronous and can fail or still be in flight when the window closes. The
 * outbox makes that value survive the failure: hydration must not replace it
 * with the older main-process snapshot, and the next start retries the mirror
 * after restoring the value.
 */
export const PENDING_SETTINGS_SYNC_KEY = 'quizlab_settings_pending_sync_v1'

/**
 * The mirror of a deleted setting.
 *
 * `removeItem` has no value to send. The main store is a string map, so an
 * explicit sentinel tells hydration to remove the key instead of restoring the
 * old value. The NUL prefix makes a collision with a real setting value
 * impractical.
 */
export const SETTINGS_REMOVED_VALUE = '\u0000__quizlab_setting_removed__'

let installed = false
let suppressForwarding = false
const settingsSyncFailureNotified = new Set<string>()
/** The newest mirror request per setting, for discarding late answers. */
const latestSyncRequest = new Map<string, number>()
let nextSyncRequest = 1

function readPendingSettings(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(PENDING_SETTINGS_SYNC_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const pending: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && isSyncableSettingKey(key)) pending[key] = value
    }
    return pending
  } catch {
    return {}
  }
}

function writePendingSettings(pending: Record<string, string>): void {
  try {
    if (Object.keys(pending).length === 0) {
      window.localStorage.removeItem(PENDING_SETTINGS_SYNC_KEY)
      return
    }
    window.localStorage.setItem(PENDING_SETTINGS_SYNC_KEY, JSON.stringify(pending))
  } catch (error) {
    Logger.warn('settingsSync: Failed to persist the pending settings outbox:', error)
  }
}

function markPendingSetting(key: string, value: string): void {
  const pending = readPendingSettings()
  pending[key] = value
  writePendingSettings(pending)
}

function clearPendingSetting(key: string, value: string): void {
  const pending = readPendingSettings()
  // An older request finishing after a newer value must not clear the newer
  // pending entry.
  if (pending[key] !== value) return
  delete pending[key]
  writePendingSettings(pending)
}

function notifySettingsSyncFailure(key: string): void {
  if (settingsSyncFailureNotified.has(key)) return
  settingsSyncFailureNotified.add(key)
  try {
    useToastStore
      .getState()
      .showWarning(
        i18next.t('toast_settings_save_failed'),
        i18next.t('toast_system_title'),
        undefined,
        TOAST_DURATION.LONG
      )
  } catch {
    // A toast failure must never break storage sync.
  }
}

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
    // Fast-path: most storage-backed queries use [storageKey] as their key.
    // This uses TanStack's built-in prefix match (cheaper than a predicate scan).
    queryClient.invalidateQueries({ queryKey: [key] } as never)
    // Fallback: invalidate any query where the key appears beyond the first segment
    // (legacy). Check only first element via predicate — cheaper than `includes` over
    // the whole key array for every query in the cache.
    queryClient.invalidateQueries({
      predicate: (query: { queryKey: unknown[] }) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.length > 1 &&
        query.queryKey[0] !== key &&
        (query.queryKey as unknown[]).includes(key)
    } as unknown as never)
  } catch {
    // Never break storage sync due to query errors
  }
}

export function isSyncableSettingKey(key: string): boolean {
  return SYNC_KEY_SET.has(key)
}

/**
 * Mirrors a single setting to the main process store.
 *
 * The localStorage write already happened and is the user-visible state. A
 * failed IPC mirror is therefore an outbox entry, not a silent success: the
 * next start must not replace the newer local value with the older main copy,
 * and the user is told that the setting may revert.
 */
export async function syncSettingToMain(key: string, value: string): Promise<void> {
  if (!isSyncableSettingKey(key) || !hasElectronApi()) return
  const api = getElectronApi()
  if (!api?.saveAppSetting) return

  const requestId = nextSyncRequest++
  latestSyncRequest.set(key, requestId)

  // Mark the value before sending it: a window that closes while the IPC call
  // is in flight must still leave the newer value for the next start.
  markPendingSetting(key, value)

  try {
    const saved = await api.saveAppSetting(key, value)
    const isLatest = latestSyncRequest.get(key) === requestId
    if (saved === false) {
      Logger.warn(`settingsSync: The main process refused to save "${key}".`)
      if (isLatest) {
        latestSyncRequest.delete(key)
        notifySettingsSyncFailure(key)
      }
      return
    }
    if (!isLatest) return
    latestSyncRequest.delete(key)
    settingsSyncFailureNotified.delete(key)
    clearPendingSetting(key, value)
  } catch (error) {
    Logger.warn(`settingsSync: Failed to sync "${key}" to main process:`, error)
    if (latestSyncRequest.get(key) === requestId) {
      latestSyncRequest.delete(key)
      notifySettingsSyncFailure(key)
    }
  }
}

/** Retries values left in the outbox by a failed or interrupted mirror. */
async function retryPendingSettingsSync(): Promise<void> {
  const pending = readPendingSettings()
  for (const [key, value] of Object.entries(pending)) {
    await syncSettingToMain(key, value)
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
  const originalRemoveItem = storageProto.removeItem

  const patchedSetItem = function (this: Storage, key: string, value: string) {
    const isLocalStorage = this === window.localStorage
    originalSetItem.call(this, key, value)
    if (isLocalStorage && !suppressForwarding && isSyncableSettingKey(key)) {
      void syncSettingToMain(key, value)
    }
  }

  const patchedRemoveItem = function (this: Storage, key: string) {
    const isLocalStorage = this === window.localStorage
    originalRemoveItem.call(this, key)
    // A deletion is a user-visible state change too. Without this mirror the
    // main store keeps the old value and hydration restores it on restart.
    if (isLocalStorage && !suppressForwarding && isSyncableSettingKey(key)) {
      void syncSettingToMain(key, SETTINGS_REMOVED_VALUE)
    }
  }

  Object.defineProperty(storageProto, 'setItem', {
    value: patchedSetItem,
    writable: true,
    configurable: true
  })
  Object.defineProperty(storageProto, 'removeItem', {
    value: patchedRemoveItem,
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
    Object.defineProperty(storageProto, 'removeItem', {
      value: originalRemoveItem,
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

  const pending = readPendingSettings()
  const stored = settings ?? {}

  suppressForwarding = true
  try {
    for (const [key, value] of Object.entries(stored)) {
      if (!isSyncableSettingKey(key)) continue
      // A pending value is newer than the main snapshot: the previous mirror
      // failed or was interrupted. Keep it and let the retry below persist it.
      const resolved = pending[key] ?? value
      if (resolved === SETTINGS_REMOVED_VALUE) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, resolved)
    }
    // The main store may not contain a key whose local value is pending (for
    // example the first write of a brand-new setting); restore those too.
    for (const [key, value] of Object.entries(pending)) {
      if (key in stored) continue
      if (value === SETTINGS_REMOVED_VALUE) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    }
  } catch (error) {
    Logger.warn('settingsSync: Failed to hydrate localStorage:', error)
  } finally {
    suppressForwarding = false
  }

  await retryPendingSettingsSync()
}
