import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const initialize = vi.fn()
const getStatus = vi.fn()
const resetProfile = vi.fn()
const setEnabled = vi.fn()
const setEnabledApps = vi.fn()
const dispose = vi.fn()
const exportSession = vi.fn()
const importSession = vi.fn()
const showSaveDialog = vi.fn()
const showOpenDialog = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) =>
      name === 'documents' ? '/home/u/Documents' : '/tmp/quizlab-test'
    )
  },
  ipcMain: {
    handle: ipcHandle
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true)
  },
  dialog: {
    showSaveDialog,
    showOpenDialog
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn()
  }
}))

vi.mock('../../../features/gemini-web-session/sessionManager', () => ({
  geminiWebSessionManager: {
    initialize,
    getStatus,
    resetProfile,
    setEnabled,
    setEnabledApps,
    dispose,
    exportSession,
    importSession
  }
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('gemini web session handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    initialize.mockReset().mockResolvedValue(undefined)
    getStatus.mockReset().mockResolvedValue({ state: 'unknown' })
    resetProfile.mockReset().mockResolvedValue({ success: true })
    setEnabled.mockReset().mockResolvedValue({ success: true })
    setEnabledApps.mockReset().mockResolvedValue({ success: true })
    dispose.mockReset().mockResolvedValue(undefined)
    exportSession.mockReset().mockResolvedValue({ success: true })
    importSession.mockReset().mockResolvedValue({ success: true })
    showSaveDialog.mockReset().mockResolvedValue({
      canceled: false,
      filePath: '/home/u/Documents/gemini-session.enc'
    })
    showOpenDialog.mockReset().mockResolvedValue({
      canceled: false,
      filePaths: ['/home/u/Documents/gemini-session.enc']
    })
  })

  it('registers handlers and validates enabledAppIds payload', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/geminiWebSessionHandlers.js')
    registerGeminiWebSessionHandlers()

    const setEnabledAppsHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SET_ENABLED_APPS)
    // SECURITY: Only known GoogleWebSessionAppId values are accepted;
    // unknown values like 'chatgpt' are filtered out.
    await setEnabledAppsHandler?.(trustedEvent, ['gemini', 'chatgpt'])
    // Non-array payloads are rejected entirely (no call to setEnabledApps).
    await setEnabledAppsHandler?.(trustedEvent, 'invalid-payload')

    expect(setEnabledApps).toHaveBeenCalledTimes(1)
    expect(setEnabledApps).toHaveBeenNthCalledWith(1, ['gemini'])
  })

  it('normalizes setEnabled IPC payload to strict booleans', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/geminiWebSessionHandlers.js')
    registerGeminiWebSessionHandlers()

    const setEnabledHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SET_ENABLED)
    await setEnabledHandler?.(trustedEvent, true)
    await setEnabledHandler?.(trustedEvent, 'false')
    await setEnabledHandler?.(trustedEvent, false)

    expect(setEnabled).toHaveBeenNthCalledWith(1, true)
    expect(setEnabled).toHaveBeenNthCalledWith(2, false)
    expect(setEnabled).toHaveBeenNthCalledWith(3, false)
  })

  it('saves into an absolute default path under the dialog directory', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/geminiWebSessionHandlers.js')
    registerGeminiWebSessionHandlers()

    const exportHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_EXPORT_SESSION)
    await exportHandler?.(trustedEvent)

    const saveOptions = showSaveDialog.mock.calls[0]?.[0]
    // A bare 'gemini-session.enc' would be resolved against Downloads.
    expect(path.isAbsolute(saveOptions.defaultPath)).toBe(true)
    expect(saveOptions.defaultPath).toBe(path.join('/home/u/Documents', 'gemini-session.enc'))
  })

  it('imports from the dialog directory', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/geminiWebSessionHandlers.js')
    registerGeminiWebSessionHandlers()

    const importHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_IMPORT_SESSION)
    await importHandler?.(trustedEvent)

    const openOptions = showOpenDialog.mock.calls[0]?.[0]
    expect(openOptions.defaultPath).toBe('/home/u/Documents')
  })

  it('blocks untrusted sender requests', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/geminiWebSessionHandlers.js')
    registerGeminiWebSessionHandlers()

    const statusHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_STATUS)
    const result = await statusHandler?.({ sender: { id: 404 }, type: 'invoke' })

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
    expect(getStatus).not.toHaveBeenCalled()
  })
})
