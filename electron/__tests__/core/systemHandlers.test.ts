import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../app/constants'

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
    handle: ipcHandle
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
  })

  it('registers handlers only once per module instance', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')

    registerSystemHandlers()
    registerSystemHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(6)
  })

  it('blocks quit requests from non-main-window senders', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')
    const trustedSender = { id: 'trusted' }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    registerSystemHandlers()
    const quitHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.APP_QUIT
    )?.[1]

    await quitHandler?.({ sender: { id: 'attacker' } })

    expect(appQuit).not.toHaveBeenCalled()
  })

  it('opens external URLs only for trusted senders and valid protocols', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')
    const trustedSender = { id: 'trusted' }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    registerSystemHandlers()
    const openExternalHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.OPEN_EXTERNAL
    )?.[1]

    await expect(
      openExternalHandler?.({ sender: trustedSender }, 'https://example.com')
    ).resolves.toBe(true)
    await expect(openExternalHandler?.({ sender: trustedSender }, 'file:///secret')).resolves.toBe(
      false
    )
    await expect(
      openExternalHandler?.({ sender: { id: 'attacker' } }, 'https://example.com')
    ).resolves.toBe(false)

    expect(shellOpenExternal).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/')
  })

  it('allows force-paste only for guest contents owned by the main window', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')
    const trustedSender = { id: 'trusted' }
    const paste = vi.fn()
    getMainWindow.mockReturnValue({ webContents: trustedSender })
    fromId.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      hostWebContents: trustedSender,
      paste
    })

    registerSystemHandlers()
    const forcePasteHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.FORCE_PASTE
    )?.[1]

    await expect(forcePasteHandler?.({ sender: trustedSender }, 42)).resolves.toBe(true)

    fromId.mockReturnValue({
      isDestroyed: vi.fn(() => false),
      hostWebContents: { id: 'other' },
      paste
    })

    await expect(forcePasteHandler?.({ sender: trustedSender }, 42)).resolves.toBe(false)
    expect(paste).toHaveBeenCalledTimes(1)
  })

  it('clears storage for a registered AI model partition', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')
    const trustedSender = { id: 'trusted' }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    registerSystemHandlers()
    const clearModelDataHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.CLEAR_AI_MODEL_DATA
    )?.[1]

    await expect(
      clearModelDataHandler?.({ sender: trustedSender }, { id: 'chatgpt' })
    ).resolves.toBe(true)

    expect(fromPartition).toHaveBeenCalledWith('persist:ai_chatgpt')
    expect(partitionClearCache).toHaveBeenCalledTimes(1)
    expect(partitionClearStorageData).toHaveBeenCalledWith({
      storages: expect.arrayContaining(['cookies', 'localstorage', 'indexdb'])
    })
  })

  it('rejects AI model data clear requests for unsafe partitions', async () => {
    const { registerSystemHandlers } = await import('../../core/systemHandlers.js')
    const trustedSender = { id: 'trusted' }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    registerSystemHandlers()
    const clearModelDataHandler = ipcHandle.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.CLEAR_AI_MODEL_DATA
    )?.[1]

    await expect(
      clearModelDataHandler?.(
        { sender: trustedSender },
        { id: 'custom_unsafe', partition: 'persist:../../bad' }
      )
    ).resolves.toBe(false)

    expect(fromPartition).not.toHaveBeenCalled()
  })
})
