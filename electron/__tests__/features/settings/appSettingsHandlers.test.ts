import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1 }
const trustedEvent = { sender: trustedSender, type: 'invoke' }

const managerState: {
  data: Record<string, string>
} = {
  data: {}
}

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/quizlab-test')
  },
  ipcMain: {
    handle: ipcHandle
  }
}))

vi.mock('../../../core/coreHelpers', () => ({
  getAppSettingsPath: vi.fn(() => '/tmp/quizlab-test/app_settings.json')
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

vi.mock('../../../core/ConfigManager', () => ({
  ConfigManager: class<T extends Record<string, string>> {
    constructor(_filePath: string) {}

    async read(): Promise<T> {
      return managerState.data as T
    }

    async update(updater: (current: T) => T | Promise<T>): Promise<boolean> {
      const current = { ...managerState.data } as T
      const updated = await updater(current)
      managerState.data = updated as Record<string, string>
      return true
    }

    async setItem(key: string, value: string): Promise<boolean> {
      managerState.data = { ...managerState.data, [key]: value }
      return true
    }
  }
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('appSettingsHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    managerState.data = {}
  })

  it('GET returns the persisted settings map', async () => {
    managerState.data = { appearance: '{"theme":"dark"}', customPrompts: '[]' }

    const { registerAppSettingsHandlers } =
      await import('../../../features/settings/appSettingsHandlers.js')
    registerAppSettingsHandlers()

    const getSettingsHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_APP_SETTINGS)
    const result = await getSettingsHandler?.(trustedEvent)

    expect(result).toEqual({
      ok: true,
      data: { appearance: '{"theme":"dark"}', customPrompts: '[]' }
    })
  })

  it('SAVE persists a single setting by key', async () => {
    const { registerAppSettingsHandlers } =
      await import('../../../features/settings/appSettingsHandlers.js')
    registerAppSettingsHandlers()

    const saveSettingsHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SAVE_APP_SETTINGS)
    const saved = await saveSettingsHandler?.(trustedEvent, 'appearance-storage', '{"a":1}')
    const savedAgain = await saveSettingsHandler?.(trustedEvent, 'customPrompts', '[]')

    expect(saved).toEqual({ ok: true, data: true })
    expect(savedAgain).toEqual({ ok: true, data: true })
    expect(managerState.data).toEqual({
      'appearance-storage': '{"a":1}',
      customPrompts: '[]'
    })
  })

  it('SAVE rejects invalid keys/values without persisting', async () => {
    const { registerAppSettingsHandlers } =
      await import('../../../features/settings/appSettingsHandlers.js')
    registerAppSettingsHandlers()

    const saveSettingsHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SAVE_APP_SETTINGS)

    expect(await saveSettingsHandler?.(trustedEvent, '', 'x')).toEqual({ ok: true, data: false })
    expect(await saveSettingsHandler?.(trustedEvent, 'k', 42)).toEqual({
      ok: true,
      data: false
    })
    expect(managerState.data).toEqual({})
  })

  it('blocks untrusted senders via ipc security', async () => {
    const { registerAppSettingsHandlers } =
      await import('../../../features/settings/appSettingsHandlers.js')
    registerAppSettingsHandlers()

    const getSettingsHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_APP_SETTINGS)
    const result = await getSettingsHandler?.({ sender: { id: 999 }, type: 'invoke' })

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
  })
})
