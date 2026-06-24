import { safeStorage } from 'electron'
import crypto from 'crypto'

import { Logger } from './logger'

const ENC_PREFIX = 'enc:'
const AES_PREFIX = 'aes:'

function getMachineDerivedKey(): Buffer {
  const machineId =
    process.env.MACHINE_ID ||
    (process.platform === 'win32' ? process.env.COMPUTERNAME : '') ||
    'quizlab-default-fallback'
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

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

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

  try {
    return aesEncrypt(plaintext)
  } catch (error) {
    Logger.error('[Encryption] AES fallback encryption failed:', error)
  }

  Logger.warn('[Encryption] All encryption methods failed, storing plaintext')
  return plaintext
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
