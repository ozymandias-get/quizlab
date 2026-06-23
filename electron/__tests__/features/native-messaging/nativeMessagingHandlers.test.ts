import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants'

const ipcHandle = vi.fn()
const requireTrustedIpcSender = vi.fn()
const getExtensionInfo = vi.fn()
const installExtension = vi.fn()
const removeExtension = vi.fn()
const mockPort = 51999
const mockSecret = 'abc123'

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
    installExtension,
    removeExtension,
    get port() {
      return mockPort
    },
    get sharedSecret() {
      return mockSecret
    }
  }
}))

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
    installExtension.mockReset()
    removeExtension.mockReset()
  })

  it('registers all 4 IPC handlers', async () => {
    const { registerNativeMessagingHandlers } =
      await import('../../../features/native-messaging/nativeMessagingHandlers.js')
    registerNativeMessagingHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(4)
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_STATUS,
      expect.any(Function)
    )
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION,
      expect.any(Function)
    )
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION,
      expect.any(Function)
    )
    expect(ipcHandle).toHaveBeenCalledWith(
      APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG,
      expect.any(Function)
    )
  })

  it('registers handlers only once', async () => {
    const { registerNativeMessagingHandlers } =
      await import('../../../features/native-messaging/nativeMessagingHandlers.js')
    registerNativeMessagingHandlers()
    registerNativeMessagingHandlers()
    registerNativeMessagingHandlers()

    expect(ipcHandle).toHaveBeenCalledTimes(4)
  })

  describe('NATIVE_MESSAGING_STATUS handler', () => {
    it('returns extension info when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      getExtensionInfo.mockReturnValue({
        status: 'disconnected',
        installed: false
      })

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_STATUS)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { status: 'disconnected', installed: false } })
      expect(getExtensionInfo).toHaveBeenCalledTimes(1)
    })

    it('returns null when sender is untrusted', async () => {
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

  describe('NATIVE_MESSAGING_INSTALL_EXTENSION handler', () => {
    it('installs extension when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      installExtension.mockResolvedValue({ success: true, installedPath: '/ext' })

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { success: true, installedPath: '/ext' } })
      expect(installExtension).toHaveBeenCalledTimes(1)
    })

    it('returns error when sender is untrusted', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_INSTALL_EXTENSION)
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { success: false, error: 'Unauthorized' } })
      expect(installExtension).not.toHaveBeenCalled()
    })
  })

  describe('NATIVE_MESSAGING_REMOVE_EXTENSION handler', () => {
    it('removes extension when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      removeExtension.mockResolvedValue({ success: true })

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { success: true } })
      expect(removeExtension).toHaveBeenCalledTimes(1)
    })

    it('returns error when sender is untrusted', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_REMOVE_EXTENSION)
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({ ok: true, data: { success: false, error: 'Unauthorized' } })
      expect(removeExtension).not.toHaveBeenCalled()
    })
  })

  describe('NATIVE_MESSAGING_BRIDGE_CONFIG handler', () => {
    it('returns bridge config when sender is trusted', async () => {
      requireTrustedIpcSender.mockReturnValue(true)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG)
      const result = await handler({ sender: { id: 1 }, type: 'invoke' })

      expect(result).toEqual({
        ok: true,
        data: {
          port: 51999,
          host: '127.0.0.1',
          secret: 'abc123',
          endpoints: {
            cookies: '/api/cookies',
            health: '/api/health'
          }
        }
      })
    })

    it('returns null when sender is untrusted', async () => {
      requireTrustedIpcSender.mockReturnValue(false)

      const { registerNativeMessagingHandlers } =
        await import('../../../features/native-messaging/nativeMessagingHandlers.js')
      registerNativeMessagingHandlers()

      const handler = getHandler(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_BRIDGE_CONFIG)
      const result = await handler({ sender: { id: 404 }, type: 'invoke' })

      expect(result).toEqual({
        ok: false,
        error: { code: 'unauthorized', message: 'Not authorized' }
      })
    })
  })
})
