import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveBridgePort,
  resolveBridgePortRange
} from '../../../features/native-messaging/nativeMessagingTypes.js'

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

describe('bridge port ranges', () => {
  it('keeps the release range exactly where it was', () => {
    expect(resolveBridgePortRange('prod')).toEqual({ start: 51999, end: 52009 })
  })

  it('gives the development build its own range', () => {
    expect(resolveBridgePortRange('dev')).toEqual({ start: 52010, end: 52020 })
  })

  it('never lets the two ranges overlap', () => {
    const prod = resolveBridgePortRange('prod')
    const dev = resolveBridgePortRange('dev')
    expect(dev.start).toBeGreaterThan(prod.end)
  })

  it.each([
    ['unset', undefined, 52010],
    ['inside the dev range', '52015', 52015],
    ['inside the release range', '51999', 52010],
    ['past the dev range', '52021', 52010]
  ])('resolves a dev port when it is %s', (_label, raw, expected) => {
    expect(resolveBridgePort('dev', raw)).toBe(expected)
  })

  it.each([
    ['a dev port', '52015'],
    ['past the release range', '52021']
  ])('never moves the release bridge to %s', (_label, raw) => {
    expect(resolveBridgePort('prod', raw)).toBe(51999)
  })
})
