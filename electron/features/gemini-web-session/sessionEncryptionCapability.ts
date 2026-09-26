/**
 * Encryption capability check for session export/import.
 *
 * `safeStorage.isEncryptionAvailable()` is necessary but not sufficient:
 * on Linux Electron can report the API as available while the selected
 * backend is `basic_text`, which stores its key in a plaintext file on disk
 * and therefore provides no real confidentiality. A `.enc` file produced in
 * that state would be labelled encrypted while being readable by any local
 * process, so the weak backend has to be rejected explicitly.
 */
import { safeStorage } from 'electron'

import { Logger } from '../../core/logger.js'

/** Backend name Electron uses when no OS keystore is actually in use. */
const WEAK_BACKEND = 'basic_text'

export type EncryptionUnavailableReason = 'unavailable' | 'weak_backend' | 'backend_unknown'

export type EncryptionUnavailable = {
  available: false
  reason: EncryptionUnavailableReason
  backend: string
}

export type EncryptionCapability = { available: true; backend: string } | EncryptionUnavailable

type BackendProbe = { kind: 'absent' } | { kind: 'ok'; backend: string } | { kind: 'failed' }

/**
 * Reads the active backend.
 *
 * Three outcomes are distinguished on purpose:
 *   - `absent`: the Electron build does not expose the API. That is the
 *     normal case on Windows/macOS, where encryption is provided by DPAPI and
 *     Keychain instead, so it must not block an export.
 *   - `ok` with an empty string: also a non-Linux platform reporting no
 *     backend name. Usable.
 *   - `failed`: the API exists but threw, so the backend is genuinely unknown.
 *     Treated as unusable — an unverifiable keystore must not be trusted to
 *     protect session cookies.
 */
function probeBackend(): BackendProbe {
  const probe = safeStorage.getSelectedStorageBackend
  if (typeof probe !== 'function') return { kind: 'absent' }
  try {
    return { kind: 'ok', backend: probe.call(safeStorage) ?? '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    Logger.warn('[GeminiWebSession] Could not read safeStorage backend:', message)
    return { kind: 'failed' }
  }
}

/**
 * Decides whether session material can be written to disk with a real
 * confidentiality guarantee. Fail-closed: anything unproven is unavailable.
 */
export function getEncryptionCapability(): EncryptionCapability {
  if (!safeStorage.isEncryptionAvailable()) {
    return { available: false, reason: 'unavailable', backend: '' }
  }

  const probe = probeBackend()

  if (probe.kind === 'failed') {
    return { available: false, reason: 'backend_unknown', backend: '' }
  }
  if (probe.kind === 'ok' && probe.backend === WEAK_BACKEND) {
    return { available: false, reason: 'weak_backend', backend: WEAK_BACKEND }
  }
  if (probe.kind === 'ok') {
    return { available: true, backend: probe.backend }
  }

  // No backend API at all: non-Linux platform keystore, nothing to verify.
  return { available: true, backend: '' }
}

/** Stable, non-sensitive error code for the IPC result. */
export function unavailableErrorCode(
  capability: EncryptionUnavailable
): 'encryption_unavailable' | 'encryption_weak_backend' | 'encryption_backend_unknown' {
  if (capability.reason === 'weak_backend') return 'encryption_weak_backend'
  if (capability.reason === 'backend_unknown') return 'encryption_backend_unknown'
  return 'encryption_unavailable'
}

/** Explains the refusal in terms the user can act on. */
export function describeUnavailableCapability(capability: EncryptionUnavailable): string {
  switch (capability.reason) {
    case 'weak_backend':
      return (
        'This system has no secure keyring, so the session cannot be encrypted. ' +
        'The exported file would contain readable session cookies, so the export was cancelled. ' +
        'Set up a system keyring (GNOME Keyring, KWallet) and try again.'
      )
    case 'backend_unknown':
      return (
        'The system keyring could not be verified, so the session cannot be encrypted ' +
        'safely. The export was cancelled rather than writing readable session cookies.'
      )
    default:
      return (
        'This system does not provide OS-level encryption, so the exported file would ' +
        'contain readable session cookies. The export was cancelled.'
      )
  }
}
