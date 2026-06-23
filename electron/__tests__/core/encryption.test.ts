/**
 * Tests for electron/core/encryption.ts
 *
 * encryptValue / decryptValue wrap electron safeStorage with
 * base64 encoding and fallback logic.  All electron APIs are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---
const mockEncryptString = vi.fn()
const mockDecryptString = vi.fn()
const mockIsEncryptionAvailable = vi.fn()

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
    encryptString: (s: string) => mockEncryptString(s),
    decryptString: (buf: Buffer) => mockDecryptString(buf)
  }
}))

const mockWarn = vi.fn()
const mockError = vi.fn()
vi.mock('@electron/core/logger', () => ({
  Logger: {
    warn: (...args: any[]) => mockWarn(...args),
    error: (...args: any[]) => mockError(...args)
  }
}))

const { encryptValue, decryptValue } = await import('@electron/core/encryption')

beforeEach(() => {
  vi.clearAllMocks()
  mockIsEncryptionAvailable.mockReturnValue(true)
  mockEncryptString.mockImplementation((s: string) => Buffer.from(s, 'utf-8'))
  mockDecryptString.mockImplementation((buf: Buffer) => buf.toString('utf-8'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encryptValue', () => {
  it('returns empty string for empty input', () => {
    expect(encryptValue('')).toBe('')
  })

  it('returns "enc:"-prefixed base64 when encryption is available', () => {
    const result = encryptValue('my-api-key')
    expect(result).toMatch(/^enc:/)
    // Verify it's valid base64 after prefix
    const base64 = result.slice(4)
    expect(() => Buffer.from(base64, 'base64').toString('utf-8')).not.toThrow()
  })

  it('falls back to plaintext when encryption is unavailable', () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    expect(encryptValue('fallback-key')).toBe('fallback-key')
  })

  it('falls back to plaintext when encryptString throws', () => {
    mockEncryptString.mockImplementation(() => {
      throw new Error('encryption failed')
    })
    expect(encryptValue('key')).toBe('key')
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[Encryption] encryptValue failed'),
      expect.any(Error)
    )
  })

  it('falls back to plaintext when encryption available check throws', () => {
    mockIsEncryptionAvailable.mockImplementation(() => {
      throw new Error('check failed')
    })
    expect(encryptValue('key')).toBe('key')
  })

  it('does not log warning for normal encryption', () => {
    encryptValue('key')
    expect(mockWarn).not.toHaveBeenCalled()
  })
})

describe('decryptValue', () => {
  it('returns empty string for empty input', () => {
    expect(decryptValue('')).toBe('')
  })

  it('returns plaintext as-is when no "enc:" prefix (legacy values)', () => {
    expect(decryptValue('plain-api-key')).toBe('plain-api-key')
  })

  it('decrypts "enc:"-prefixed values', () => {
    const encrypted = encryptValue('secret-key')
    expect(decryptValue(encrypted)).toBe('secret-key')
  })

  it('decrypts works with bare base64 after prefix', () => {
    const buf = Buffer.from('direct-value', 'utf-8')
    const result = decryptValue('enc:' + buf.toString('base64'))
    expect(result).toBe('direct-value')
  })

  it('returns "" when decryption fails', () => {
    mockDecryptString.mockImplementation(() => {
      throw new Error('decryption failed')
    })
    const result = decryptValue('enc:' + Buffer.from('x').toString('base64'))
    expect(result).toBe('')
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('[Encryption] decryptValue failed'),
      expect.any(Error)
    )
  })

  it('returns "" when encryption is unavailable after having been encrypted', () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    const result = decryptValue('enc:' + Buffer.from('x').toString('base64'))
    expect(result).toBe('')
  })

  it('handles decrypt of value that was encrypted when available becomes unavailable', () => {
    // Simulate: encrypted when available → then decrypt when unavailable
    mockIsEncryptionAvailable
      .mockReturnValueOnce(true) // for encryptValue
      .mockReturnValueOnce(false) // for decryptValue

    const encrypted = encryptValue('test')
    const decrypted = decryptValue(encrypted)
    expect(decrypted).toBe('')
  })
})
