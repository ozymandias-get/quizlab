import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1 }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const initialize = vi.fn()
const getStatus = vi.fn()
const resetProfile = vi.fn()
const setEnabled = vi.fn()
const setEnabledApps = vi.fn()
const dispose = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/quizlab-test')
  },
  ipcMain: {
    handle: ipcHandle
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
    dispose
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
  })

  it('registers handlers and validates enabledAppIds payload', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/handlers.js')
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
      await import('../../../features/gemini-web-session/handlers.js')
    registerGeminiWebSessionHandlers()

    const setEnabledHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GEMINI_WEB_SET_ENABLED)
    await setEnabledHandler?.(trustedEvent, true)
    await setEnabledHandler?.(trustedEvent, 'false')
    await setEnabledHandler?.(trustedEvent, false)

    expect(setEnabled).toHaveBeenNthCalledWith(1, true)
    expect(setEnabled).toHaveBeenNthCalledWith(2, false)
    expect(setEnabled).toHaveBeenNthCalledWith(3, false)
  })

  it('blocks untrusted sender requests', async () => {
    const { registerGeminiWebSessionHandlers } =
      await import('../../../features/gemini-web-session/handlers.js')
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
