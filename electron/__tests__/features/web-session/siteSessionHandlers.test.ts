import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const send = vi.fn()
const list = vi.fn()
const setEnabled = vi.fn()
const clear = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  },
  ipcMain: {
    handle: ipcHandle
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, send }
      }
    ])
  }
}))

vi.mock('../../../features/web-session/siteSessionService.js', () => ({
  siteSessionService: { list, setEnabled, clear }
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

const LIST_RESULT = {
  views: [],
  extensionConnected: true,
  extensionVersionOk: true
}

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('site session handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    send.mockReset()
    list.mockReset().mockResolvedValue(LIST_RESULT)
    setEnabled.mockReset().mockResolvedValue({ success: true })
    clear.mockReset().mockResolvedValue({ success: true })
  })

  it('lists the sites for the trusted window', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const listHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_LIST)
    const result = await listHandler?.(trustedEvent)

    expect(result).toEqual({ ok: true, data: LIST_RESULT })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('blocks a request from an untrusted sender', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const listHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_LIST)
    const result = await listHandler?.({ sender: { id: 404 }, type: 'invoke' })

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
    expect(list).not.toHaveBeenCalled()
  })

  it('turns a site on with a strict boolean', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setEnabledHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ENABLED)
    await setEnabledHandler?.(trustedEvent, 'chatgpt', true)
    await setEnabledHandler?.(trustedEvent, 'chatgpt', 'true')

    expect(setEnabled).toHaveBeenNthCalledWith(1, 'chatgpt', true)
    // Only a real boolean turns a site on: a truthy string is not one.
    expect(setEnabled).toHaveBeenNthCalledWith(2, 'chatgpt', false)
  })

  it('refuses a site id that is not a string', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setEnabledHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ENABLED)
    const result = await setEnabledHandler?.(trustedEvent, 42, true)

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_site_id' } })
    expect(setEnabled).not.toHaveBeenCalled()
  })

  it('sends the fresh list after a switch was turned', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setEnabledHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ENABLED)
    await setEnabledHandler?.(trustedEvent, 'chatgpt', true)

    expect(send).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, LIST_RESULT)
  })

  it('sends the fresh list after a session was cleared', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const clearHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CLEAR)
    await clearHandler?.(trustedEvent, 'chatgpt')

    expect(clear).toHaveBeenCalledWith('chatgpt')
    expect(send).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, LIST_RESULT)
  })

  it('refuses to clear a site id that is not a string', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const clearHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CLEAR)
    const result = await clearHandler?.(trustedEvent, null)

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_site_id' } })
    expect(clear).not.toHaveBeenCalled()
  })
})
