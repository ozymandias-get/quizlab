/**
 * Tests for src/platform/electron/browserApiUtils.ts
 *
 * Covers pure utility functions. The selectPdfInBrowser function
 * is excluded because it requires real DOM interaction.
 */
import {
  getPlatform,
  registerBeforeUnloadCleanup,
  selectPdfInBrowser,
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

describe('selectPdfInBrowser', () => {
  it('resolves null when the file picker is cancelled', async () => {
    let createdInput!: HTMLInputElement
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreate(tagName)
      if (tagName === 'input') {
        createdInput = el as HTMLInputElement
      }
      return el
    })

    const promise = selectPdfInBrowser()
    expect(createdInput).toBeDefined()
    createdInput.dispatchEvent(new Event('cancel'))
    const result = await promise
    expect(result).toBeNull()
  })
})
