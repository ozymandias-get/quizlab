import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  describeUnavailableCapability,
  getEncryptionCapability,
  unavailableErrorCode
} from '../../../features/gemini-web-session/sessionEncryptionCapability.js'

const safeStorageMocks = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(),
  getSelectedStorageBackend: vi.fn()
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: safeStorageMocks.isEncryptionAvailable,
    getSelectedStorageBackend: safeStorageMocks.getSelectedStorageBackend
  }
}))

const mocks = safeStorageMocks as unknown as Record<string, unknown>
const originalProbe = safeStorageMocks.getSelectedStorageBackend

describe('gemini-web-session/sessionEncryptionCapability', () => {
  beforeEach(() => {
    mocks.getSelectedStorageBackend = originalProbe
    safeStorageMocks.isEncryptionAvailable.mockReset().mockReturnValue(true)
    if (typeof safeStorageMocks.getSelectedStorageBackend === 'function') {
      safeStorageMocks.getSelectedStorageBackend.mockReset().mockReturnValue('gnome_libsecret')
    }
  })

  it('reports available on a real Linux keystore', () => {
    const capability = getEncryptionCapability()
    expect(capability).toEqual({ available: true, backend: 'gnome_libsecret' })
  })

  it('reports available for kwallet', () => {
    safeStorageMocks.getSelectedStorageBackend.mockReturnValue('kwallet5')
    expect(getEncryptionCapability().available).toBe(true)
  })

  it('reports available on Windows and macOS, which return no backend name', () => {
    safeStorageMocks.getSelectedStorageBackend.mockReturnValue('')
    expect(getEncryptionCapability()).toEqual({ available: true, backend: '' })
  })

  it('reports available when the backend API is absent', () => {
    mocks.getSelectedStorageBackend = undefined
    expect(getEncryptionCapability().available).toBe(true)
  })

  it('rejects basic_text even though isEncryptionAvailable is true', () => {
    safeStorageMocks.getSelectedStorageBackend.mockReturnValue('basic_text')
    const capability = getEncryptionCapability()
    expect(capability).toEqual({
      available: false,
      reason: 'weak_backend',
      backend: 'basic_text'
    })
  })

  it('rejects when the API reports available but encryption is not', () => {
    safeStorageMocks.isEncryptionAvailable.mockReturnValue(false)
    expect(getEncryptionCapability()).toEqual({
      available: false,
      reason: 'unavailable',
      backend: ''
    })
  })

  it('rejects when the backend cannot be verified', () => {
    safeStorageMocks.getSelectedStorageBackend.mockImplementation(() => {
      throw new Error('boom')
    })
    const capability = getEncryptionCapability()
    expect(capability).toEqual({
      available: false,
      reason: 'backend_unknown',
      backend: ''
    })
  })

  it('never returns a non-basic_text backend as unavailable', () => {
    for (const backend of ['gnome_libsecret', 'kwallet5', 'kwallet6', 'gnome_libsecret_dbus', '']) {
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue(backend)
      expect(getEncryptionCapability().available).toBe(true)
    }
  })

  it('maps each refusal to a distinct error code', () => {
    expect(unavailableErrorCode({ available: false, reason: 'unavailable', backend: '' })).toBe(
      'encryption_unavailable'
    )
    expect(
      unavailableErrorCode({ available: false, reason: 'weak_backend', backend: 'basic_text' })
    ).toBe('encryption_weak_backend')
    expect(unavailableErrorCode({ available: false, reason: 'backend_unknown', backend: '' })).toBe(
      'encryption_backend_unknown'
    )
  })

  it('explains every refusal in actionable terms', () => {
    for (const reason of ['unavailable', 'weak_backend', 'backend_unknown'] as const) {
      const text = describeUnavailableCapability({
        available: false,
        reason,
        backend: reason === 'weak_backend' ? 'basic_text' : ''
      })
      expect(text.length).toBeGreaterThan(20)
      expect(text).toMatch(/session cookies/i)
    }
  })

  it('tells the user how to fix a missing keyring', () => {
    const text = describeUnavailableCapability({
      available: false,
      reason: 'weak_backend',
      backend: 'basic_text'
    })
    expect(text).toMatch(/keyring/i)
  })
})
