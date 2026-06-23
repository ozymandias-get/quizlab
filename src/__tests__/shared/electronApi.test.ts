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

  it('returns null when window.electronAPI is not defined', () => {
    setElectronAPI(undefined)
    expect(getElectronApi()).toBeNull()
  })

  it('returns null when window.electronAPI is null', () => {
    setElectronAPI(null)
    expect(getElectronApi()).toBeNull()
  })
})

describe('hasElectronApi', () => {
  it('returns true when electronAPI exists', () => {
    setElectronAPI({})
    expect(hasElectronApi()).toBe(true)
  })

  it('returns false when electronAPI is undefined', () => {
    setElectronAPI(undefined)
    expect(hasElectronApi()).toBe(false)
  })

  it('returns false when electronAPI is null', () => {
    setElectronAPI(null)
    expect(hasElectronApi()).toBe(false)
  })

  it('returns false when electronAPI is empty string', () => {
    setElectronAPI('')
    expect(hasElectronApi()).toBe(false)
  })

  it('returns false when electronAPI is 0', () => {
    setElectronAPI(0)
    expect(hasElectronApi()).toBe(false)
  })
})
