import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../app/constants'

const ipcHandle = vi.fn()
const appGetVersion = vi.fn(() => '1.0.0')
const shellOpenExternal = vi.fn(async () => {})
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  app: { getVersion: appGetVersion },
  shell: { openExternal: shellOpenExternal },
  net: { request: vi.fn() }
}))

vi.mock('../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('updater handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    appGetVersion.mockReturnValue('1.0.0')
    shellOpenExternal.mockClear()
    requireTrustedIpcSender.mockReset()
  })

  it('returns unauthorized for untrusted check/update channels', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { initUpdater } = await import('../../core/updater.js')
    initUpdater()

    const checkHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CHECK_FOR_UPDATES)
    const versionHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_APP_VERSION)
    const releaseHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPEN_RELEASES)

    expect(await checkHandler?.({ sender: {} })).toEqual({
      available: false,
      error: 'Unauthorized'
    })
    expect(versionHandler?.({ sender: {} })).toBeNull()
    expect(await releaseHandler?.({ sender: {} })).toBe(false)
  })

  it('opens releases page when sender is trusted', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const { initUpdater } = await import('../../core/updater.js')
    initUpdater()

    const releaseHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPEN_RELEASES)
    const result = await releaseHandler?.({ sender: {} })

    expect(result).toBe(true)
    expect(shellOpenExternal).toHaveBeenCalledTimes(1)
  })
})
