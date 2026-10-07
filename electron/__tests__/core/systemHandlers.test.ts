import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../app/constants.js'

const ipcHandle = vi.fn()
const appQuit = vi.fn()
const shellOpenExternal = vi.fn()
const clipboardWriteText = vi.fn()
const defaultSessionClearCache = vi.fn()
const partitionClearCache = vi.fn()
const partitionClearStorageData = vi.fn()
const fromPartition = vi.fn(() => ({
  clearCache: partitionClearCache,
  clearStorageData: partitionClearStorageData
}))
const fromId = vi.fn()
const getMainWindow = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandle,
    on: vi.fn()
  },
  app: {
    quit: appQuit,
    getPath: vi.fn(() => '/mock-user-data')
  },
  shell: {
    openExternal: shellOpenExternal
  },
  webContents: {
    fromId
  },
  session: {
    defaultSession: {
      clearCache: defaultSessionClearCache
    },
    fromPartition
  },
  clipboard: {
    writeText: clipboardWriteText
  }
}))

vi.mock('../../features/ai/aiManager', () => ({
  AI_REGISTRY: {
    chatgpt: { partition: 'persist:ai_chatgpt' }
  },
  INACTIVE_PLATFORMS: {
    legacy: { partition: 'persist:legacy' }
  }
}))

vi.mock('../../app/windowManager', () => ({
  getMainWindow
}))

describe('systemHandlers', () => {
  // trustedSender doubles as both the IPC event.sender (a WebContents-like
  // object) and mainWindow.webContents, so it must answer isDestroyed() for
  // the trusted-sender check.
  let trustedSender: {
    id: string
    isDestroyed?: () => boolean
    getURL?: () => string
  }

  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    appQuit.mockReset()
    shellOpenExternal.mockReset()
    clipboardWriteText.mockReset()
    defaultSessionClearCache.mockReset()
    partitionClearCache.mockReset()
    partitionClearStorageData.mockReset()
    fromPartition.mockClear()
    fromId.mockReset()
    getMainWindow.mockReset()
    trustedSender = {
      id: 'trusted',
      isDestroyed: vi.fn(() => false),
      getURL: vi.fn(() => 'http://localhost:5173')
    }
  })

  it('registers handlers only once per module instance', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers/systemHandlers.js')

    registerSystemHandlers()
    const firstCallCount = ipcHandle.mock.calls.length
    registerSystemHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(firstCallCount)
    // The exact channel set is the gate. Asserting the *absence* of one
    // migration-era channel name could not fail if a different webview-id
    // addressed paste channel were added; asserting the whole list can.
    expect(ipcHandle.mock.calls.map(([channel]) => channel).sort()).toEqual([
      APP_CONFIG.IPC_CHANNELS.APP_QUIT,
      APP_CONFIG.IPC_CHANNELS.CACHE_INFO,
      APP_CONFIG.IPC_CHANNELS.CLEAR_AI_MODEL_DATA,
      APP_CONFIG.IPC_CHANNELS.CLEAR_CACHE,
      APP_CONFIG.IPC_CHANNELS.COPY_TEXT,
      APP_CONFIG.IPC_CHANNELS.DEEP_CLEAN_CACHE,
      APP_CONFIG.IPC_CHANNELS.OPEN_EXTERNAL,
      APP_CONFIG.IPC_CHANNELS.SET_CACHE_AUTO_CLEAN,
      APP_CONFIG.IPC_CHANNELS.SMART_CACHE_ACTION
    ])
  })

  it('blocks quit requests from non-main-window senders', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers/systemHandlers.js')
    getMainWindow.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      webContents: trustedSender
    })

    registerSystemHandlers()
    const quitHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.APP_QUIT
    )?.[1]

    await quitHandler?.({ sender: { id: 'attacker' } })

    expect(appQuit).not.toHaveBeenCalled()
  })

  it('opens external URLs only for trusted senders and valid protocols', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers/systemHandlers.js')
    getMainWindow.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      webContents: trustedSender
    })

    registerSystemHandlers()
    const openExternalHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.OPEN_EXTERNAL
    )?.[1]

    await expect(
      openExternalHandler?.({ sender: trustedSender }, 'https://example.com')
    ).resolves.toEqual({ ok: true, data: true })
    await expect(
      openExternalHandler?.({ sender: trustedSender }, 'file:///secret')
    ).resolves.toEqual({ ok: true, data: false })
    await expect(
      openExternalHandler?.({ sender: { id: 'attacker' } }, 'https://example.com')
    ).resolves.toEqual({ ok: true, data: false })

    expect(shellOpenExternal).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/')
  })

  it('clears storage for a registered AI model partition', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers/systemHandlers.js')
    getMainWindow.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      webContents: trustedSender
    })

    registerSystemHandlers()
    const clearModelDataHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.CLEAR_AI_MODEL_DATA
    )?.[1]

    await expect(
      clearModelDataHandler?.({ sender: trustedSender }, { id: 'chatgpt' })
    ).resolves.toEqual({ ok: true, data: true })

    expect(fromPartition).toHaveBeenCalledWith('persist:ai_chatgpt')
    expect(partitionClearCache).toHaveBeenCalledTimes(1)
    expect(partitionClearStorageData).toHaveBeenCalledWith({
      storages: expect.arrayContaining(['cookies', 'localstorage', 'indexdb'])
    })
  })

  it('rejects AI model data clear requests for unsafe partitions', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers/systemHandlers.js')
    getMainWindow.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      webContents: trustedSender
    })

    registerSystemHandlers()
    const clearModelDataHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.CLEAR_AI_MODEL_DATA
    )?.[1]

    await expect(
      clearModelDataHandler?.(
        { sender: trustedSender },
        { id: 'custom_unsafe', partition: 'persist:../../bad' }
      )
    ).resolves.toEqual({ ok: true, data: false })

    expect(fromPartition).not.toHaveBeenCalled()
  })
})
