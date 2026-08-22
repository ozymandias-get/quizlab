import crypto from 'crypto'
import { safeStorage } from 'electron'

import { Logger } from './logger.js'

const ENC_PREFIX = 'enc:'
const AES_PREFIX = 'aes:'

/**
 * Machine fingerprint used by the CURRENT (v3) derivation. Combines every
 * stable machine/user identifier available in the environment so values do
 * not silently break when only one of them changes.
 *
 * SECURITY NOTE: like any machine-derived key this is obfuscation, not true
 * at-rest protection — an attacker who controls the machine (or knows these
 * environment values) can rederive it. The preferred path is Electron's
 * safeStorage (OS keystore); the AES fallback exists only for environments
 * where safeStorage is unavailable (e.g. some Linux setups).
 */
function getMachineFingerprintV3(): string {
  const parts = [
    process.env.MACHINE_ID,
    process.env.COMPUTERNAME,
    process.env.HOSTNAME,
    process.env.USER,
    process.env.USERNAME
  ].filter((p): p is string => typeof p === 'string' && p.length > 0)
  return parts.length > 0 ? parts.join('|') : 'quizlab-default-fallback'
}

/** Fingerprint of the LEGACY (v2) derivation — must match the pre-v3 scheme exactly. */
function getMachineFingerprintV2(): string {
  return (
    process.env.MACHINE_ID ||
    (process.platform === 'win32' ? process.env.COMPUTERNAME : '') ||
    'quizlab-default-fallback'
  )
}

function deriveAesKey(version: 2 | 3): Buffer {
  if (version === 3) {
    const hmac = crypto
      .createHmac('sha256', 'quizlab-machine-id-v3')
      .update(getMachineFingerprintV3())
      .digest()
    return crypto.pbkdf2Sync(hmac, 'quizlab-aes-2026-v3', 200000, 32, 'sha256')
  }
  const hmac = crypto
    .createHmac('sha256', 'quizlab-machine-id-v2')
    .update(getMachineFingerprintV2())
    .digest()
  return crypto.pbkdf2Sync(hmac, 'quizlab-aes-2024-v2', 200000, 32, 'sha256')
}

function aesEncrypt(plaintext: string): string {
  const key = deriveAesKey(3)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${AES_PREFIX}${iv.toString('base64')}:${authTag}:${encrypted}`
}

/**
 * Decrypts with the current key, falling back to the legacy v2 derivation so
 * values written by older builds remain readable after the upgrade.
 */
function aesDecrypt(stored: string): string {
  const withoutPrefix = stored.slice(AES_PREFIX.length)
  const colon1 = withoutPrefix.indexOf(':')
  const colon2 = withoutPrefix.indexOf(':', colon1 + 1)
  if (colon1 === -1 || colon2 === -1) throw new Error('Invalid AES format')

  const iv = Buffer.from(withoutPrefix.slice(0, colon1), 'base64')
  const authTag = Buffer.from(withoutPrefix.slice(colon1 + 1, colon2), 'hex')
  const encrypted = withoutPrefix.slice(colon2 + 1)

  let lastError: unknown
  for (const version of [3, 2] as const) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', deriveAesKey(version), iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AES decryption failed')
}

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Encrypts a secret for storage.
 *
 * THROWS when every mechanism fails — callers must treat that as "value not
 * persisted" instead of storing an empty placeholder (which would destroy
 * the user's secret silently).
 */
export function encryptValue(plaintext: string): string {
  if (!plaintext) return plaintext

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plaintext)
      return ENC_PREFIX + encrypted.toString('base64')
    }
  } catch (error) {
    Logger.warn('[Encryption] safeStorage.encryptString failed:', error)
  }

  return aesEncrypt(plaintext)
}

export function decryptValue(stored: string): string {
  if (!stored) return stored

  if (stored.startsWith(AES_PREFIX)) {
    try {
      return aesDecrypt(stored)
    } catch (error) {
      Logger.error('[Encryption] AES fallback decryption failed:', error)
      return ''
    }
  }

  if (stored.startsWith(ENC_PREFIX)) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const base64Data = stored.slice(ENC_PREFIX.length)
        const buffer = Buffer.from(base64Data, 'base64')
        return safeStorage.decryptString(buffer)
      }
    } catch (error) {
      Logger.error('[Encryption] safeStorage.decryptString failed:', error)
    }
    return ''
  }

  return stored
}
