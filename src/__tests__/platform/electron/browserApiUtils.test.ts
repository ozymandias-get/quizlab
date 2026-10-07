/**
 * Tests for src/platform/electron/browserApiUtils.ts
 *
 * Covers pure utility functions. The selectPdfInBrowser function
 * is excluded because it requires real DOM interaction.
 */
import {
  createGeminiStatus,
  getPlatform,
  registerBeforeUnloadCleanup,
  revokeObjectUrl,
  toMapRecord
} from '@platform/electron/browserApiUtils'

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getPlatform', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  it('returns darwin on Mac', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true
    })
    expect(getPlatform()).toBe('darwin')
  })

  it('returns win32 on Windows', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true
    })
    expect(getPlatform()).toBe('win32')
  })

  it('returns linux on Linux', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Linux x86_64',
      configurable: true
    })
    expect(getPlatform()).toBe('linux')
  })

  it('returns web for unknown platforms', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Unknown',
      configurable: true
    })
    expect(getPlatform()).toBe('web')
  })
})

describe('createGeminiStatus', () => {
  it('returns auth_required state when enabled', () => {
    const status = createGeminiStatus(true, ['gemini'])
    expect(status.state).toBe('auth_required')
    expect(status.featureEnabled).toBe(true)
    expect(status.enabled).toBe(true)
    expect(status.enabledAppIds).toEqual(['gemini'])
    expect(status.consecutiveFailures).toBe(0)
    expect(status.reasonCode).toBe('none')
  })

  it('returns uninitialized state when disabled', () => {
    const status = createGeminiStatus(false, [])
    expect(status.state).toBe('uninitialized')
    expect(status.featureEnabled).toBe(false)
    expect(status.enabled).toBe(false)
    expect(status.lastHealthyAt).toBeNull()
  })

  it('sets lastCheckAt to current ISO string', () => {
    const before = Date.now()
    const status = createGeminiStatus(true, [])
    const after = Date.now()
    const parsed = new Date(status.lastCheckAt!).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })
})

describe('toMapRecord', () => {
  it('converts a Map to a plain Record', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ])
    expect(toMapRecord(map)).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('returns an empty object for an empty map', () => {
    expect(toMapRecord(new Map())).toEqual({})
  })
})

describe('registerBeforeUnloadCleanup', () => {
  it('registers a beforeunload listener once and ignores subsequent calls', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    // First call registers the listener
    registerBeforeUnloadCleanup()
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function), {
      once: true
    })

    // Second call is a no-op because the flag is already set
    registerBeforeUnloadCleanup()
    expect(addSpy).toHaveBeenCalledTimes(1)
  })
})

describe('revokeObjectUrl', () => {
  it('does not revoke an untracked URL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    revokeObjectUrl('blob:untracked')
    expect(revokeSpy).not.toHaveBeenCalled()
  })
})
