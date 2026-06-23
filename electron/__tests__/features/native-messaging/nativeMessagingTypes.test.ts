import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('nativeMessagingTypes', () => {
  describe('BRIDGE_PORT', () => {
    const ORIGINAL_ENV = process.env.QUIZLAB_EXTENSION_BRIDGE_PORT

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) {
        delete process.env.QUIZLAB_EXTENSION_BRIDGE_PORT
      } else {
        process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = ORIGINAL_ENV
      }
      vi.resetModules()
    })

    it('defaults to 51999 when env var is not set', async () => {
      delete process.env.QUIZLAB_EXTENSION_BRIDGE_PORT
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(51999)
    })

    it('uses env var when set to a valid port', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = '52000'
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(52000)
    })

    it('uses env var when set to max valid port (65534)', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = '65534'
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(65534)
    })

    it('falls back to default when env var is below minimum (1024)', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = '1024'
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(51999)
    })

    it('falls back to default when env var is above maximum (65535)', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = '65535'
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(51999)
    })

    it('falls back to default when env var is not a number', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = 'invalid'
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(51999)
    })

    it('falls back to default when env var is empty string', async () => {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = ''
      vi.resetModules()
      const { BRIDGE_PORT } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_PORT).toBe(51999)
    })
  })

  describe('constants', () => {
    it('CRITICAL_COOKIE_NAMES contains expected cookies', async () => {
      const { CRITICAL_COOKIE_NAMES } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(CRITICAL_COOKIE_NAMES.has('SID')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-1PSID')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-3PSID')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-1PSIDTS')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-3PSIDTS')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-1PSIDCC')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.has('__Secure-3PSIDCC')).toBe(true)
      expect(CRITICAL_COOKIE_NAMES.size).toBe(7)
    })

    it('HMAC_HEADER is x-hmac-signature', async () => {
      const { HMAC_HEADER } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(HMAC_HEADER).toBe('x-hmac-signature')
    })

    it('BRIDGE_SECRET_HEADER is x-bridge-secret', async () => {
      const { BRIDGE_SECRET_HEADER } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(BRIDGE_SECRET_HEADER).toBe('x-bridge-secret')
    })

    it('MAX_COOKIE_BODY_SIZE is 512KB', async () => {
      const { MAX_COOKIE_BODY_SIZE } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(MAX_COOKIE_BODY_SIZE).toBe(1024 * 512)
    })

    it('EXTENSION_SOURCE_DIR is extensions/quizlab-session-extension', async () => {
      const { EXTENSION_SOURCE_DIR } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(EXTENSION_SOURCE_DIR).toBe('extensions/quizlab-session-extension')
    })
  })

  describe('isAllowedOrigin', () => {
    it('allows chrome-extension:// origins', async () => {
      const { isAllowedOrigin } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(isAllowedOrigin('chrome-extension://abc123def456')).toBe(true)
      expect(isAllowedOrigin('chrome-extension://')).toBe(true)
    })

    it('rejects https:// origins', async () => {
      const { isAllowedOrigin } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(isAllowedOrigin('https://example.com')).toBe(false)
      expect(isAllowedOrigin('https://localhost:3000')).toBe(false)
    })

    it('rejects http:// origins', async () => {
      const { isAllowedOrigin } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(isAllowedOrigin('http://localhost')).toBe(false)
    })

    it('rejects undefined', async () => {
      const { isAllowedOrigin } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(isAllowedOrigin(undefined)).toBe(false)
    })

    it('rejects empty string', async () => {
      const { isAllowedOrigin } =
        await import('../../../features/native-messaging/nativeMessagingTypes.js')
      expect(isAllowedOrigin('')).toBe(false)
    })
  })
})
