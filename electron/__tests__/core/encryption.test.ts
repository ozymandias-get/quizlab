import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'

// Note: safeStorage is not available in test environment (Electron-only API).
// We test the AES fallback functions indirectly via the exported API.

// Replicate the AES logic from encryption.ts to verify algorithm correctness
const AES_PREFIX = 'aes:'

function getMachineDerivedKey(): Buffer {
  const machineId = 'test-machine-id'
  const salt = 'quizlab-aes-2024-v1'
  return crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha256')
}

function aesEncrypt(plaintext: string): string {
  const key = getMachineDerivedKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${AES_PREFIX}${iv.toString('base64')}:${authTag}:${encrypted}`
}

function aesDecrypt(stored: string): string {
  const withoutPrefix = stored.slice(AES_PREFIX.length)
  const colon1 = withoutPrefix.indexOf(':')
  const colon2 = withoutPrefix.indexOf(':', colon1 + 1)
  if (colon1 === -1 || colon2 === -1) throw new Error('Invalid AES format')

  const iv = Buffer.from(withoutPrefix.slice(0, colon1), 'base64')
  const authTag = Buffer.from(withoutPrefix.slice(colon1 + 1, colon2), 'hex')
  const encrypted = withoutPrefix.slice(colon2 + 1)
  const key = getMachineDerivedKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

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
    const base64 = result.slice(4)
    expect(() => Buffer.from(base64, 'base64').toString('utf-8')).not.toThrow()
  })

  it('falls back to AES when encryption is unavailable', () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    const result = encryptValue('fallback-key')
    expect(result).toMatch(/^aes:/)
  })

  it('falls back to AES when encryptString throws', () => {
    mockEncryptString.mockImplementation(() => {
      throw new Error('encryption failed')
    })
    const result = encryptValue('key')
    expect(result).toMatch(/^aes:/)
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[Encryption] safeStorage.encryptString failed'),
      expect.any(Error)
    )
  })

  it('falls back to AES when encryption available check throws', () => {
    mockIsEncryptionAvailable.mockImplementation(() => {
      throw new Error('check failed')
    })
    const result = encryptValue('key')
    expect(result).toMatch(/^aes:/)
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
      expect.stringContaining('[Encryption] safeStorage.decryptString failed'),
      expect.any(Error)
    )
  })

  it('returns "" when encryption is unavailable after having been encrypted', () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    const result = decryptValue('enc:' + Buffer.from('x').toString('base64'))
    expect(result).toBe('')
  })

  it('handles decrypt of value that was encrypted when available becomes unavailable', () => {
    mockIsEncryptionAvailable.mockReturnValueOnce(true).mockReturnValueOnce(false)

    const encrypted = encryptValue('test')
    const decrypted = decryptValue(encrypted)
    expect(decrypted).toBe('')
  })
})

describe('AES-256-GCM encryption fallback', () => {
  it('should encrypt and decrypt a value', () => {
    const key = 'sk-test-api-key-12345'
    const encrypted = aesEncrypt(key)
    expect(encrypted).toMatch(/^aes:.+:.+:.+$/)
    const decrypted = aesDecrypt(encrypted)
    expect(decrypted).toBe(key)
  })

  it('should produce different ciphertext each time for the same input', () => {
    const key = 'same-input'
    const result1 = aesEncrypt(key)
    const result2 = aesEncrypt(key)
    expect(result1).not.toBe(result2)
  })

  it('should handle empty string input', () => {
    const result = aesEncrypt('')
    const decrypted = aesDecrypt(result)
    expect(decrypted).toBe('')
  })

  it('should handle special characters', () => {
    const key = 'api-key-with-$pecial-ch@rs!🚀'
    const encrypted = aesEncrypt(key)
    const decrypted = aesDecrypt(encrypted)
    expect(decrypted).toBe(key)
  })

  it('should throw on corrupted ciphertext', () => {
    const key = 'test-key'
    const encrypted = aesEncrypt(key)
    const corrupted = encrypted.slice(0, -5) + 'XXXXX'
    expect(() => aesDecrypt(corrupted)).toThrow()
  })
})
