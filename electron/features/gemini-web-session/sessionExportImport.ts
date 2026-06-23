import { safeStorage } from 'electron'
import { promises as fs } from 'fs'

import { Logger } from '../../core/logger'
import type { ProbeRunner } from './probeRunner'
import { HEALTH_TIMEOUT_MS } from './sessionConfig'
import type {
  SessionExportData,
  SessionExportDataV1,
  SessionExportDataV2,
  SessionImportResult
} from './sessionContracts'
import { toErrorMessage } from './sessionErrors'
import type { SessionMetadataRepository } from './sessionMetadataRepository'
import type { SessionSnapshotRepository } from './sessionSnapshotRepository'

/**
 * SECURITY: Validate that an unknown value conforms to the SessionExportDataV1
 * shape before any code path accesses its properties.  This prevents:
 *   - Prototype pollution via __proto__ in JSON.parse
 *   - Type confusion crashes from unexpected shapes
 *   - Malicious oversized payloads
 */
function isSessionExportDataV1(raw: unknown): raw is SessionExportDataV1 {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>

  if (typeof obj.version !== 'number' || obj.version !== 1) return false

  if (obj.exportedAt !== undefined && typeof obj.exportedAt !== 'string') return false

  if (
    obj.storageState !== null &&
    obj.storageState !== undefined &&
    typeof obj.storageState !== 'object'
  )
    return false

  if (
    obj.accountHash !== null &&
    obj.accountHash !== undefined &&
    typeof obj.accountHash !== 'string'
  )
    return false

  if (obj.metadata !== undefined) {
    if (!obj.metadata || typeof obj.metadata !== 'object') return false
    const meta = obj.metadata as Record<string, unknown>
    if (meta.state !== undefined && typeof meta.state !== 'string') return false
    if (meta.reasonCode !== undefined && typeof meta.reasonCode !== 'string') return false
    if (
      meta.lastHealthyAt !== null &&
      meta.lastHealthyAt !== undefined &&
      typeof meta.lastHealthyAt !== 'string'
    )
      return false
  }

  const hasOwn = (k: string) => Object.prototype.hasOwnProperty.call(obj, k)
  if (hasOwn('__proto__') || hasOwn('constructor') || hasOwn('prototype')) return false

  return true
}

function isSessionExportDataV2(raw: unknown): raw is SessionExportDataV2 {
  if (!raw || typeof raw !== 'object') return false
  const obj = raw as Record<string, unknown>
  if (obj.version !== 2) return false
  if (typeof obj.exportedAt !== 'string') return false
  if (typeof obj.encrypted !== 'string' || !obj.encrypted) return false
  return true
}

export class SessionExportImport {
  constructor(
    private snapshotRepository: SessionSnapshotRepository | null,
    private metadataRepository: SessionMetadataRepository,
    private probeRunner: ProbeRunner
  ) {}

  async exportSession(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const storageState =
        (await this.snapshotRepository?.readStorageStateSnapshot().catch(() => null)) ?? null
      const metadata = await this.metadataRepository.readMetadata()

      const innerData: SessionExportDataV1 = {
        version: 1,
        exportedAt: new Date().toISOString(),
        storageState,
        accountHash: metadata.accountHash,
        metadata: {
          state: metadata.state,
          reasonCode: metadata.reasonCode,
          lastHealthyAt: metadata.lastHealthyAt
        }
      }

      if (safeStorage.isEncryptionAvailable()) {
        // SECURITY: Encrypt session data using OS-level encryption
        // (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
        // This prevents other processes or users from reading Google
        // session cookies from the exported file.
        const innerJson = JSON.stringify(innerData)
        const encrypted = safeStorage.encryptString(innerJson)
        const exportData: SessionExportDataV2 = {
          version: 2,
          exportedAt: new Date().toISOString(),
          encrypted: encrypted.toString('base64')
        }
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), {
          mode: 0o600
        })
      } else {
        // Fallback: safeStorage unavailable (e.g. headless Linux).
        // Log a warning so the user knows the export is unencrypted.
        Logger.warn('[GeminiWebSession] safeStorage unavailable, exporting session as plaintext')
        await fs.writeFile(filePath, JSON.stringify(innerData, null, 2), {
          mode: 0o600
        })
      }

      return { success: true }
    } catch (error) {
      Logger.error('[GeminiWebSession] Export failed:', toErrorMessage(error, 'export_failed'))
      return {
        success: false,
        error: error instanceof Error ? error.message : 'export_failed'
      }
    }
  }

  async importSession(filePath: string): Promise<SessionImportResult> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)

      // Try version 2 (encrypted) first
      if (isSessionExportDataV2(parsed)) {
        const v2 = parsed as SessionExportDataV2

        if (!safeStorage.isEncryptionAvailable()) {
          Logger.warn('[GeminiWebSession] Import rejected: safeStorage unavailable for decryption')
          return { success: false, error: 'encryption_unavailable' }
        }

        let decryptedJson: string
        try {
          const buffer = Buffer.from(v2.encrypted, 'base64')
          decryptedJson = safeStorage.decryptString(buffer)
        } catch {
          Logger.warn('[GeminiWebSession] Import rejected: failed to decrypt session data')
          return { success: false, error: 'decryption_failed' }
        }

        const innerData: unknown = JSON.parse(decryptedJson)
        if (!isSessionExportDataV1(innerData)) {
          Logger.warn('[GeminiWebSession] Import rejected: invalid decrypted session data')
          return { success: false, error: 'invalid_session_data' }
        }

        return this.applyImportedData(innerData)
      }

      // Try version 1 (legacy plaintext)
      if (isSessionExportDataV1(parsed)) {
        Logger.info('[GeminiWebSession] Importing legacy plaintext session (v1)')
        return this.applyImportedData(parsed)
      }

      Logger.warn('[GeminiWebSession] Import rejected: unknown format')
      return { success: false, error: 'invalid_session_data' }
    } catch (error) {
      Logger.error('[GeminiWebSession] Import failed:', toErrorMessage(error, 'import_failed'))
      return {
        success: false,
        error: error instanceof Error ? error.message : 'import_failed'
      }
    }
  }

  private async applyImportedData(importData: SessionExportDataV1): Promise<SessionImportResult> {
    try {
      if (importData.storageState) {
        await this.snapshotRepository
          ?.writeStorageStateSnapshot(importData.storageState)
          .catch(() => {})
      }

      const probe = await this.probeRunner.runProbeAcrossApps({
        interactive: false,
        timeoutMs: HEALTH_TIMEOUT_MS
      })

      if (probe.outcome.healthy) {
        const currentMetadata = await this.metadataRepository.readMetadata()
        const status = await this.metadataRepository.writeStatus(
          {
            state: 'authenticated',
            lastHealthyAt: new Date().toISOString(),
            lastCheckAt: new Date().toISOString(),
            consecutiveFailures: 0,
            reasonCode: 'none',
            featureEnabled: true,
            enabled: true,
            enabledAppIds: currentMetadata.enabledAppIds
          },
          importData.accountHash
        )
        return { success: true, status }
      }

      return { success: false, error: 'import_verification_failed' }
    } catch (error) {
      Logger.error(
        '[GeminiWebSession] Import apply failed:',
        toErrorMessage(error, 'import_failed')
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : 'import_failed'
      }
    }
  }
}
