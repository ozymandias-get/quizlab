import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../app/constants.js'

const ipcHandle = vi.fn()
const appGetVersion = vi.fn(() => '1.0.0')
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  app: { getVersion: appGetVersion },
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
    requireTrustedIpcSender.mockReset()
  })

  it('shares an in-flight check instead of returning a premature negative result', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    let release!: (response: unknown) => void
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const { initUpdater } = await import('../../core/updater.js')
      initUpdater()
      const checkHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CHECK_FOR_UPDATES)

      const first = checkHandler?.({ sender: {} })
      await Promise.resolve()

      let secondSettled = false
      const second = checkHandler?.({ sender: {} }).then((result: unknown) => {
        secondSettled = true
        return result
      })
      await Promise.resolve()
      expect(secondSettled).toBe(false)

      release({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ tag_name: 'v1.1.0', body: 'Release notes' })
      })

      const expected = {
        ok: true,
        data: { available: true, version: 'v1.1.0', releaseNotes: 'Release notes' }
      }
      await expect(first).resolves.toEqual(expected)
      await expect(second).resolves.toEqual(expected)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns unauthorized for untrusted check/update channels', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { initUpdater } = await import('../../core/updater.js')
    initUpdater()

    const checkHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CHECK_FOR_UPDATES)
    const versionHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_APP_VERSION)

    expect(await checkHandler?.({ sender: {} })).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Unauthorized' }
    })
    expect(await versionHandler?.({ sender: {} })).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
  })
})
