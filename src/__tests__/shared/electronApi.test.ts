import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { afterEach, describe, expect, it } from 'vitest'

let originalElectronAPI: unknown

afterEach(() => {
  // Restore window.electronAPI to prevent state leaking across test files
  if (originalElectronAPI !== undefined) {
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      writable: true,
      configurable: true
    })
  } else {
    delete (window as unknown as Record<string, unknown>).electronAPI
  }
})

function setElectronAPI(value: unknown) {
  // Save original only once
  if (originalElectronAPI === undefined && !('electronAPI' in window)) {
    originalElectronAPI = undefined
  } else if (originalElectronAPI === undefined) {
    originalElectronAPI = (window as unknown as Record<string, unknown>).electronAPI
  }
  Object.defineProperty(window, 'electronAPI', { value, writable: true, configurable: true })
}

describe('getElectronApi', () => {
  it('returns window.electronAPI when available', () => {
    const mockApi = { platform: 'linux', invoke: vi.fn() }
    setElectronAPI(mockApi)

    expect(getElectronApi()).toBe(mockApi)
  })

  it.each([
    ['undefined', undefined],
    ['null', null]
  ])('returns null when window.electronAPI is %s', (_label, value) => {
    setElectronAPI(value)
    expect(getElectronApi()).toBeNull()
  })
})

describe('hasElectronApi', () => {
  it.each([
    ['an object', {}, true],
    ['undefined', undefined, false],
    ['null', null, false],
    ['an empty string', '', false],
    ['zero', 0, false]
  ])('returns %j for %s', (_label, value, expected) => {
    setElectronAPI(value)
    expect(hasElectronApi()).toBe(expected)
  })
})
