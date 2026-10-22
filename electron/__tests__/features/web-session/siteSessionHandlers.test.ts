import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1, getURL: vi.fn(() => 'http://localhost:5173') }
const trustedEvent = { sender: trustedSender, type: 'invoke' }
const send = vi.fn()
const list = vi.fn()
const setEnabled = vi.fn()
const clear = vi.fn()
const setActiveAccount = vi.fn()
const renameAccount = vi.fn()
const deleteAccount = vi.fn()
const resolvePendingSession = vi.fn()

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
  siteSessionService: {
    list,
    setEnabled,
    clear,
    setActiveAccount,
    renameAccount,
    deleteAccount,
    resolvePendingSession
  }
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

const LIST_RESULT = {
  accountViews: [],
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
    setActiveAccount.mockReset().mockResolvedValue({ success: true })
    renameAccount.mockReset().mockResolvedValue({ success: true })
    deleteAccount.mockReset().mockResolvedValue({ success: true })
    resolvePendingSession.mockReset().mockResolvedValue({ success: true })
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

  it('refuses a site id that is not a string', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setAccountEnabledHandler = getHandler(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED
    )
    const result = await setAccountEnabledHandler?.(trustedEvent, 42, 'account-2', true)

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(setEnabled).not.toHaveBeenCalled()
  })

  it('sends the fresh list after a switch was turned', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setAccountEnabledHandler = getHandler(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED
    )
    await setAccountEnabledHandler?.(trustedEvent, 'chatgpt', 'account-2', true)

    expect(send).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, LIST_RESULT)
  })

  it('sends the fresh list after a session was cleared', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const clearAccountHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CLEAR_ACCOUNT)
    await clearAccountHandler?.(trustedEvent, 'chatgpt', 'account-2')

    expect(clear).toHaveBeenCalledWith('chatgpt', 'account-2')
    expect(send).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, LIST_RESULT)
  })

  it('refuses to clear a site id that is not a string', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const clearAccountHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CLEAR_ACCOUNT)
    const result = await clearAccountHandler?.(trustedEvent, null, 'account-2')

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(clear).not.toHaveBeenCalled()
  })

  it('turns the switch of one account', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setAccountEnabledHandler = getHandler(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED
    )
    await setAccountEnabledHandler?.(trustedEvent, 'chatgpt', 'account-2', false)

    expect(setEnabled).toHaveBeenCalledWith('chatgpt', 'account-2', false)
  })

  it('refuses an account switch that is not a boolean', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setAccountEnabledHandler = getHandler(
      APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACCOUNT_ENABLED
    )
    const result = await setAccountEnabledHandler?.(trustedEvent, 'chatgpt', 'account-2', 'false')

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(setEnabled).not.toHaveBeenCalled()
  })

  it('clears one account', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const clearAccountHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CLEAR_ACCOUNT)
    await clearAccountHandler?.(trustedEvent, 'chatgpt', 'account-2')

    expect(clear).toHaveBeenCalledWith('chatgpt', 'account-2')
  })

  it('rejects a set-active call without a site and an account', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setActiveHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACTIVE_ACCOUNT)
    const emptySite = await setActiveHandler?.(trustedEvent, '', 'account-2')
    const nonStringSite = await setActiveHandler?.(trustedEvent, 42, 'account-2')
    const emptyAccount = await setActiveHandler?.(trustedEvent, 'chatgpt', '')

    const refusal = { ok: true, data: { success: false, error: 'invalid_arguments' } }
    expect(emptySite).toEqual(refusal)
    expect(nonStringSite).toEqual(refusal)
    expect(emptyAccount).toEqual(refusal)
    expect(setActiveAccount).not.toHaveBeenCalled()
  })

  it('rejects a rename with an empty account id', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const renameHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_RENAME_ACCOUNT)
    const result = await renameHandler?.(trustedEvent, 'chatgpt', '', 'Work')

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(renameAccount).not.toHaveBeenCalled()
  })

  it('caps an account name at 64 characters', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const renameHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_RENAME_ACCOUNT)
    const rejected = await renameHandler?.(trustedEvent, 'chatgpt', 'account-2', 'a'.repeat(65))
    const accepted = await renameHandler?.(trustedEvent, 'chatgpt', 'account-2', 'a'.repeat(64))

    expect(rejected).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(renameAccount).toHaveBeenCalledTimes(1)
    expect(renameAccount).toHaveBeenCalledWith('chatgpt', 'account-2', 'a'.repeat(64))
    expect(accepted).toEqual({ ok: true, data: { success: true } })
  })

  it('deletes one account', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const deleteHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_DELETE_ACCOUNT)
    await deleteHandler?.(trustedEvent, 'chatgpt', 'account-2')

    expect(deleteAccount).toHaveBeenCalledWith('chatgpt', 'account-2')
  })

  it('answers a resolve-pending call for a site without a pending session', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    resolvePendingSession.mockResolvedValue({ success: false, error: 'unknown_target' })
    registerSiteSessionHandlers()

    const resolveHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_RESOLVE_PENDING)
    const response = await resolveHandler?.(trustedEvent, 'chatgpt', null)
    const result = response?.ok === true ? response.data : null

    expect(result?.error).toBe('unknown_target')
    expect(resolvePendingSession).toHaveBeenCalledWith('chatgpt', null)
  })

  it('rejects a resolve-pending call with an empty account id', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const resolveHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_RESOLVE_PENDING)
    const result = await resolveHandler?.(trustedEvent, 'chatgpt', '')

    expect(result).toEqual({ ok: true, data: { success: false, error: 'invalid_arguments' } })
    expect(resolvePendingSession).not.toHaveBeenCalled()
  })

  it('sends the fresh list after an account was made active', async () => {
    const { registerSiteSessionHandlers } =
      await import('../../../features/web-session/siteSessionHandlers.js')
    registerSiteSessionHandlers()

    const setActiveHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_SET_ACTIVE_ACCOUNT)
    await setActiveHandler?.(trustedEvent, 'chatgpt', 'account-2')

    expect(send).toHaveBeenCalledWith(APP_CONFIG.IPC_CHANNELS.SITE_SESSION_CHANGED, LIST_RESULT)
  })
})
