import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import {
  hydrateSettingsFromMain,
  installSettingsSync,
  isSyncableSettingKey,
  SETTINGS_SYNC_KEYS,
  syncSettingToMain
} from '@shared/lib/settingsSync'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function setElectronApi(value: unknown): void {
  Object.defineProperty(window, 'electronAPI', { value, writable: true, configurable: true })
}

describe('settingsSync', () => {
  const saveAppSetting = vi.fn()
  const getAppSettings = vi.fn()
  let uninstallSync: (() => void) | null = null

  beforeEach(() => {
    saveAppSetting.mockReset()
    getAppSettings.mockReset()
    saveAppSetting.mockResolvedValue(true)
    getAppSettings.mockResolvedValue({})
    setElectronApi({ saveAppSetting, getAppSettings })
    window.localStorage.clear()
    uninstallSync = null
  })

  afterEach(() => {
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
