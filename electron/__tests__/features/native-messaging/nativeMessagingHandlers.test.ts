import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'
import { ExtensionInstallError } from '../../../features/native-messaging/extensionInstaller.js'

const ipcHandle = vi.fn()
const requireTrustedIpcSender = vi.fn()
const getExtensionInfo = vi.fn()
const getPairingCode = vi.fn()
const installExtension = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  app: { getPath: vi.fn(() => '/tmp') }
}))

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

vi.mock('../../../features/native-messaging/nativeMessagingManager', () => ({
  nativeMessagingManager: {
    getExtensionInfo,
    getPairingCode
  }
}))

vi.mock('../../../features/native-messaging/extensionInstaller', () => {
  class MockExtensionInstallError extends Error {
    readonly failure: string

    constructor(failure: string, message: string) {
      super(message)
      this.name = 'ExtensionInstallError'
      this.failure = failure
    }
  }
  return {
    getBundledExtensionInstaller: () => ({ install: installExtension }),
    ExtensionInstallError: MockExtensionInstallError
  }
})

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find((call: any[]) => call[0] === channel)?.[1]
}

describe('registerNativeMessagingHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ipcHandle.mockReset()
    requireTrustedIpcSender.mockReset()
    getExtensionInfo.mockReset()
    getPairingCode.mockReset()
    installExtension.mockReset()
  })

  it('registers the status, pairing and install handlers', async () => {
    const { registerNativeMessagingHandlers } =
      await import('../../../features/native-messaging/nativeMessagingHandlers.js')
    registerNativeMessagingHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(3)
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_STATUS,
      expect.any(Function)
    )
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_PAIRING_CODE,
      expect.any(Function)
    )
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_INSTALL,
      expect.any(Function)
    )
  })

  it('registers handlers only once', async () => {
    const { registerNativeMessagingHandlers } =
      await import('../../../features/native-messaging/nativeMessagingHandlers.js')
    registerNativeMessagingHandlers()
    registerNativeMessagingHandlers()
    registerNativeMessagingHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(3)
  })

  describe('NATIVE_MESSAGING_STATUS handler', () => {
    it('returns extension info when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      getExtensionInfo.mockReturnValue({
        status: 'disconnected',
        paired: false,
        waitingSince: null,
        userHint: null
      })

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_STATUS)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({
        ok: true,
        data: {
          status: 'disconnected',
          paired: false,
          waitingSince: null,
          userHint: null
        }
      })
      expect(getExtensionInfo).toHaveBeenCalledTimes(1)
    })

    it('returns an error when sender is untrusted', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_STATUS)
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({
        ok: false,
        error: { code: 'unauthorized', message: 'Not authorized' }
      })
      expect(getExtensionInfo).not.toHaveBeenCalled()
    })
  })

  describe('NATIVE_MESSAGING_EXTENSION_INSTALL handler', () => {
    const installed = {
      path: '/data/extension/quizlab-session-extension',
      version: '1.4.0',
      refreshed: true
    }

    async function registerAndGet() {
      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()
      return getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_INSTALL)
    }

    it('prepares the bundled extension when the sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      installExtension.mockResolvedValue(installed)

      const handler = await registerAndGet()
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: installed })
      expect(installExtension).toHaveBeenCalledTimes(1)
    })

    it('refuses an untrusted sender without touching the disk', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const handler = await registerAndGet()
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({
        ok: false,
        error: { code: 'unauthorized', message: 'Not authorized' }
      })
      expect(installExtension).not.toHaveBeenCalled()
    })

    it('reports a missing bundle as not found', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      installExtension.mockRejectedValue(
        new ExtensionInstallError('not_found', 'The bundled extension is missing')
      )

      const handler = await registerAndGet()
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({
        ok: false,
        error: { code: 'not_found', message: 'The bundled extension is missing' }
      })
    })

    it('reports a broken bundle as an internal error', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      installExtension.mockRejectedValue(
        new ExtensionInstallError('invalid_manifest', 'The extension has no pinned key')
      )

      const handler = await registerAndGet()
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toMatchObject({ ok: false, error: { code: 'internal_error' } })
    })
  })

  describe('NATIVE_MESSAGING_PAIRING_CODE handler', () => {
    it('returns the pairing code when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      getPairingCode.mockReturnValue('a'.repeat(64))

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_PAIRING_CODE)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { code: 'a'.repeat(64) } })
      expect(getPairingCode).toHaveBeenCalledTimes(1)
    })

    it('refuses and does not call the manager when the sender is untrusted', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_PAIRING_CODE)
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({
        ok: false,
        error: { code: 'unauthorized', message: 'Not authorized' }
      })
      expect(getPairingCode).not.toHaveBeenCalled()
    })
  })
})
