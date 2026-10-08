import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useAppearance } from '@shared/stores/appearanceStore'
import { useLanguage } from '@shared/stores/languageStore'
import { hydratePreferenceStores } from '@shared/stores/hydratePreferenceStores'
import {
  hydrateSettingsFromMain,
  installSettingsSync,
  isSyncableSettingKey,
  SETTINGS_SYNC_KEYS,
  syncSettingToMain
} from '@app/lib/settingsSync'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function setElectronApi(value: unknown): void {
  Object.defineProperty(window, 'electronAPI', { value, writable: true, configurable: true })
}

describe('settingsSync', () => {
  const saveAppSetting = vi.fn()
  const getAppSettings = vi.fn()
  let uninstallSync: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    useAppearance.setState({ selectionColor: '#EAB308', isLayoutSwapped: false })
    useLanguage.setState({ language: 'en', isOnboardingDone: false })
    // Drain the adapter's reset write before clearing storage and installing sync.
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    saveAppSetting.mockReset()
    getAppSettings.mockReset()
    saveAppSetting.mockResolvedValue(true)
    getAppSettings.mockResolvedValue({})
    setElectronApi({ saveAppSetting, getAppSettings })
    window.localStorage.clear()
    uninstallSync = null
  })

  afterEach(() => {
    vi.useRealTimers()
    uninstallSync?.()
    uninstallSync = null
    delete (window as unknown as Record<string, unknown>).electronAPI
    window.localStorage.clear()
  })

  it('marks whitelisted keys as syncable', () => {
    expect(SETTINGS_SYNC_KEYS.length).toBeGreaterThan(0)
    expect(isSyncableSettingKey(STORAGE_KEYS.CUSTOM_PROMPTS)).toBe(true)
    expect(isSyncableSettingKey('appearance-storage')).toBe(true)
    expect(isSyncableSettingKey('some-other-key')).toBe(false)
  })

  it('patches Storage.prototype.setItem and mirrors whitelisted writes to main', () => {
    uninstallSync = installSettingsSync()

    window.localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, '["p1"]')
    window.localStorage.setItem('appearance-storage', '{"theme":"dark"}')
    window.localStorage.setItem('transient-key', 'not-synced')

    expect(saveAppSetting).toHaveBeenCalledWith(STORAGE_KEYS.CUSTOM_PROMPTS, '["p1"]')
    expect(saveAppSetting).toHaveBeenCalledWith('appearance-storage', '{"theme":"dark"}')
    expect(saveAppSetting).not.toHaveBeenCalledWith('transient-key', 'not-synced')
  })

  it('uninstall restores the original setItem', () => {
    const original = Storage.prototype.setItem
    uninstallSync = installSettingsSync()
    expect(Storage.prototype.setItem).not.toBe(original)

    uninstallSync()
    expect(Storage.prototype.setItem).toBe(original)
  })

  it('hydrateSettingsFromMain writes persisted settings without forwarding back', async () => {
    getAppSettings.mockResolvedValue({
      'appearance-storage': '{"theme":"dark"}',
      [STORAGE_KEYS.CUSTOM_PROMPTS]: '["p1"]',
      'not-synced-key': 'ignored'
    })
    uninstallSync = installSettingsSync()

    await hydrateSettingsFromMain()

    expect(window.localStorage.getItem('appearance-storage')).toBe('{"theme":"dark"}')
    expect(window.localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS)).toBe('["p1"]')
    expect(window.localStorage.getItem('not-synced-key')).toBeNull()
    expect(saveAppSetting).not.toHaveBeenCalled()
  })

  it('keeps first-run defaults when no saved preferences exist', async () => {
    // Sync is installed so the "no write-back" assertion below is reachable at
    // all: `saveAppSetting` is only ever called through the patched `setItem`,
    // so without the patch the assertion passes whether or not anything echoes.
    uninstallSync = installSettingsSync()
    await hydrateSettingsFromMain()
    await hydratePreferenceStores()
    expect(useAppearance.getState().selectionColor).toBe('#EAB308')
    expect(useAppearance.getState().isLayoutSwapped).toBe(false)
    expect(useLanguage.getState().language).toBe('en')
    expect(useLanguage.getState().isOnboardingDone).toBe(false)
    expect(saveAppSetting).not.toHaveBeenCalled()
  })

  it('restores preinitialized appearance state after renderer storage is lost', async () => {
    vi.useFakeTimers()
    uninstallSync = installSettingsSync()
    getAppSettings.mockResolvedValue({
      'appearance-storage': JSON.stringify({
        state: { selectionColor: '#123456', isLayoutSwapped: true },
        version: 0
      })
    })
    await hydrateSettingsFromMain()
    await hydratePreferenceStores()
    expect(useAppearance.getState().selectionColor).toBe('#123456')
    expect(useAppearance.getState().isLayoutSwapped).toBe(true)
    vi.advanceTimersByTime(350)
    expect(saveAppSetting).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('restores language and completed onboarding into preinitialized state', async () => {
    // Sync installed for the same reason as the first-run case: the assertion
    // that hydration does not echo back to the main process is only observable
    // while the mirroring patch is active.
    uninstallSync = installSettingsSync()
    getAppSettings.mockResolvedValue({
      [STORAGE_KEYS.APP_LANGUAGE]: 'tr',
      [STORAGE_KEYS.APP_LANGUAGE_ONBOARDING_DONE]: 'true'
    })
    await hydrateSettingsFromMain()
    await hydratePreferenceStores()
    expect(useLanguage.getState().language).toBe('tr')
    expect(useLanguage.getState().isOnboardingDone).toBe(true)
    expect(saveAppSetting).not.toHaveBeenCalled()
  })

  it('hydrateSettingsFromMain tolerates missing/broken API', async () => {
    getAppSettings.mockRejectedValue(new Error('ipc down'))
    await expect(hydrateSettingsFromMain()).resolves.toBeUndefined()

    delete (window as unknown as Record<string, unknown>).electronAPI
    await expect(hydrateSettingsFromMain()).resolves.toBeUndefined()
  })

  it('syncSettingToMain ignores non-syncable keys and swallows errors', async () => {
    saveAppSetting.mockRejectedValue(new Error('boom'))

    await syncSettingToMain('transient-key', 'x')
    expect(saveAppSetting).not.toHaveBeenCalled()

    await syncSettingToMain(STORAGE_KEYS.APP_LANGUAGE, 'tr')
    await expect(syncSettingToMain(STORAGE_KEYS.APP_LANGUAGE, 'tr')).resolves.toBeUndefined()
  })
})
