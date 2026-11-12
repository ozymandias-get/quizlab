import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { afterEach, describe, expect, it, vi } from 'vitest'

const hadElectronAPI = 'electronAPI' in window
const originalElectronAPI = (window as unknown as Record<string, unknown>).electronAPI

afterEach(() => {
  // Restore window.electronAPI to prevent state leaking across tests.
  if (hadElectronAPI) {
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
  it('detects an electron API from truthy values only', () => {
    setElectronAPI({})
    expect(hasElectronApi()).toBe(true)

    for (const value of [undefined, null, '', 0]) {
      setElectronAPI(value)
      expect(hasElectronApi(), String(value)).toBe(false)
    }
  })
})
