import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * This module is mostly literal constants. Asserting that
 * `HMAC_HEADER === 'x-hmac-signature'` only restates the source line and can
 * never fail for any useful reason, so those pinning tests were removed.
 *
 * `BRIDGE_PORT` is the one piece of real logic here (an IIFE with three
 * branches), so it keeps its tests.
 */
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

  async function readBridgePort(envValue: string | undefined): Promise<number> {
    if (envValue === undefined) {
      delete process.env.QUIZLAB_EXTENSION_BRIDGE_PORT
    } else {
      process.env.QUIZLAB_EXTENSION_BRIDGE_PORT = envValue
    }
    vi.resetModules()
    const { BRIDGE_PORT } =
      await import('../../../features/native-messaging/nativeMessagingTypes.js')
    return BRIDGE_PORT
  }

  const DEFAULT_PORT = 51999

  it('uses a valid in-range env port', async () => {
    await expect(readBridgePort('52000')).resolves.toBe(52000)
  })

  it.each([
    ['unset', undefined],
    ['below the minimum', '1024'],
    ['above the maximum', '65535']
  ])('falls back to the default when the env port is %s', async (_label, envValue) => {
    await expect(readBridgePort(envValue as string | undefined)).resolves.toBe(DEFAULT_PORT)
  })

  it.each([
    ['not a number', 'invalid'],
    ['empty', '']
  ])('falls back to the default when the env port is %s', async (_label, envValue) => {
    await expect(readBridgePort(envValue as string)).resolves.toBe(DEFAULT_PORT)
  })
})
