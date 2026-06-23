import { safeStorage } from 'electron'

import { Logger } from './logger'

/**
 * Prefix used to distinguish encrypted values from plaintext in stored JSON.
 * Legacy plaintext values (without this prefix) are handled transparently
 * for backward compatibility.
 */
const ENC_PREFIX = 'enc:'

/**
 * Checks whether the OS-level encrypted storage is available on this machine.
 *
 * - **macOS:** Always available (Keychain).
 * - **Windows:** Always available (DPAPI).
 * - **Linux:** Available only when `libsecret` is installed (many headless/server
 *   environments lack it).
 *
 * This function is safe to call before the `app` module emits `ready` because
 * `safeStorage.isEncryptionAvailable()` does not require a running event loop.
 */
function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Encrypts a plaintext string using the OS-level encrypted store
 * and returns an `"enc:"`-prefixed, base64-encoded representation.
 *
 * If encryption is unavailable (e.g. Linux without libsecret) the value
 * is stored as plaintext — this is a conscious fallback so that the app
 * remains functional on all platforms.  A warning is logged once.
 *
 * @param plaintext - The value to encrypt (e.g. an API key).
 * @returns The encrypted + encoded string, or the original plaintext.
 */
export function encryptValue(plaintext: string): string {
  if (!plaintext) return plaintext

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plaintext)
      return ENC_PREFIX + encrypted.toString('base64')
    }
  } catch (error) {
    Logger.warn('[Encryption] encryptValue failed, falling back to plaintext:', error)
  }

  return plaintext
}

/**
 * Decrypts a value previously produced by {@link encryptValue}.
 *
 * Also handles **legacy plaintext** values (those without the `"enc:"` prefix)
 * so that users who already have stored API keys are not forced to re-enter
 * them after upgrading.
 *
 * @param stored - The value read from disk (encrypted + prefixed, or plaintext).
 * @returns The decrypted plaintext string, or `""` if decryption fails.
 */
export function decryptValue(stored: string): string {
  if (!stored) return stored
  if (!stored.startsWith(ENC_PREFIX)) return stored

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const base64Data = stored.slice(ENC_PREFIX.length)
      const buffer = Buffer.from(base64Data, 'base64')
      return safeStorage.decryptString(buffer)
    }
  } catch (error) {
    Logger.error('[Encryption] decryptValue failed for a previously encrypted value:', error)
  }

  // If we can't decrypt, return empty to prevent using corrupted keys.
  // The user will need to re-enter the API key.
  return ''
}
