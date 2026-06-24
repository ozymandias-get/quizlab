import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionExportImport } from '../../../features/gemini-web-session/sessionExportImport.js'

const testExportPath = path.join(os.tmpdir(), 'quizlab-test', 'export.json')

const exportImportMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

const safeStorageMocks = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => false),
  encryptString: vi.fn(),
  decryptString: vi.fn()
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: safeStorageMocks.isEncryptionAvailable,
    encryptString: safeStorageMocks.encryptString,
    decryptString: safeStorageMocks.decryptString
  },
  app: {
    getPath: () => ''
  }
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      readFile: exportImportMocks.readFile,
      writeFile: exportImportMocks.writeFile
    }
  },
  promises: {
    readFile: exportImportMocks.readFile,
    writeFile: exportImportMocks.writeFile
  }
}))

describe('SessionExportImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Prevent cross-test leaks from non-Once mock implementations
    exportImportMocks.readFile.mockReset()
    exportImportMocks.writeFile.mockReset()
    safeStorageMocks.isEncryptionAvailable.mockReset().mockReturnValue(false)
    safeStorageMocks.encryptString.mockReset()
    safeStorageMocks.decryptString.mockReset()
  })

  describe('exportSession', () => {
    it('exports session data to file', async () => {
      const readStorageStateSnapshot = vi.fn().mockResolvedValue({ cookies: [] })
      const readMetadata = vi.fn().mockResolvedValue({
        accountHash: 'abc123',
        state: 'authenticated',
        reasonCode: 'none',
        lastHealthyAt: '2025-01-01T00:00:00.000Z'
      })

      const exporter = new SessionExportImport(
        {
          readStorageStateSnapshot,
          writeStorageStateSnapshot: vi.fn(),
          clearSnapshot: vi.fn()
        } as never,
        { readMetadata } as never,
        {} as never
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(true)
      expect(exportImportMocks.writeFile).toHaveBeenCalledTimes(1)
      const callArgs = exportImportMocks.writeFile.mock.calls[0]
      expect(callArgs.length).toBeGreaterThanOrEqual(2)
      expect(String(callArgs[1])).toContain('"version"')
    })

    it('exports with null storageState when snapshot missing', async () => {
      const readStorageStateSnapshot = vi.fn().mockResolvedValue(null)
      const readMetadata = vi.fn().mockResolvedValue({
        accountHash: null,
        state: 'requires_login',
        reasonCode: 'none',
        lastHealthyAt: null
      })

      const exporter = new SessionExportImport(
        {
          readStorageStateSnapshot,
          writeStorageStateSnapshot: vi.fn(),
          clearSnapshot: vi.fn()
        } as never,
        { readMetadata } as never,
        {} as never
      )

      await exporter.exportSession(testExportPath)

      const written = exportImportMocks.writeFile.mock.calls[0][1]
      const data = JSON.parse(written)
      expect(data.storageState).toBeNull()
      expect(data.accountHash).toBeNull()
    })

    it('returns error when file write fails', async () => {
      const readStorageStateSnapshot = vi.fn().mockResolvedValue(null)
      const readMetadata = vi.fn().mockResolvedValue({
        accountHash: null,
        state: 'requires_login',
        reasonCode: 'none',
        lastHealthyAt: null
      })
      exportImportMocks.writeFile.mockRejectedValue(new Error('Permission denied'))

      const exporter = new SessionExportImport(
        {
          readStorageStateSnapshot,
          writeStorageStateSnapshot: vi.fn(),
          clearSnapshot: vi.fn()
        } as never,
        { readMetadata } as never,
        {} as never
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('exports session data as encrypted v2 when safeStorage is available', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const readStorageStateSnapshot = vi.fn().mockResolvedValue({ cookies: [] })
      const readMetadata = vi.fn().mockResolvedValue({
        accountHash: 'abc123',
        state: 'authenticated',
        reasonCode: 'none',
        lastHealthyAt: '2025-01-01T00:00:00.000Z'
      })

      const exporter = new SessionExportImport(
        {
          readStorageStateSnapshot,
          writeStorageStateSnapshot: vi.fn(),
          clearSnapshot: vi.fn()
        } as never,
        { readMetadata } as never,
        {} as never
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(true)
      expect(safeStorageMocks.encryptString).toHaveBeenCalledTimes(1)
      expect(exportImportMocks.writeFile).toHaveBeenCalledTimes(1)
      const callArgs = exportImportMocks.writeFile.mock.calls[0]
      expect(callArgs.length).toBeGreaterThanOrEqual(2)
      const written = JSON.parse(String(callArgs[1]))
      expect(written.version).toBe(2)
      expect(typeof written.encrypted).toBe('string')
      expect(written.encrypted.length).toBeGreaterThan(0)
    })
  })

  describe('importSession', () => {
    it('imports session from valid export file', async () => {
      const exportData = {
        version: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        storageState: { cookies: [] },
        accountHash: 'abc123',
        metadata: {
          state: 'authenticated',
          reasonCode: 'none',
          lastHealthyAt: '2025-01-01T00:00:00.000Z'
        }
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportData))

      const writeStorageStateSnapshot = vi.fn().mockResolvedValue(undefined)
      const runProbeAcrossApps = vi.fn().mockResolvedValue({ outcome: { healthy: true } })
      const writeStatus = vi.fn().mockResolvedValue({
        state: 'authenticated',
        accountHash: 'abc123'
      })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never,
        { runProbeAcrossApps } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
      expect(runProbeAcrossApps).toHaveBeenCalledWith({
        interactive: false,
        timeoutMs: expect.any(Number)
      })
    })

    it('rejects export with wrong version', async () => {
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({ version: 99, storageState: null })
      )

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      // The schema validator now catches wrong version as invalid_session_data
      expect(result.error).toBe('invalid_session_data')
    })

    it('fails when probe verification fails', async () => {
      const exportData = {
        version: 1,
        storageState: { cookies: [] },
        accountHash: 'abc123',
        metadata: { state: 'authenticated', reasonCode: 'none', lastHealthyAt: null }
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportData))

      const runProbeAcrossApps = vi.fn().mockResolvedValue({ outcome: { healthy: false } })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot: vi.fn().mockResolvedValue(undefined),
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus: vi.fn() } as never,
        { runProbeAcrossApps } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('import_verification_failed')
    })

    it('returns error when file read fails', async () => {
      exportImportMocks.readFile.mockRejectedValue(new Error('File not found'))

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })

    it('returns error when JSON is invalid', async () => {
      exportImportMocks.readFile.mockResolvedValue('not json')

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('skips snapshot restore when storageState is null', async () => {
      const exportData = {
        version: 1,
        storageState: null,
        accountHash: 'abc123',
        metadata: { state: 'authenticated', reasonCode: 'none', lastHealthyAt: null }
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportData))

      const writeStorageStateSnapshot = vi.fn()
      const runProbeAcrossApps = vi.fn().mockResolvedValue({ outcome: { healthy: true } })
      const writeStatus = vi
        .fn()
        .mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never,
        { runProbeAcrossApps } as never
      )

      await importer.importSession(testExportPath)

      expect(writeStorageStateSnapshot).not.toHaveBeenCalled()
    })

    it('imports session from valid v2 (encrypted) export', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      const innerV1 = {
        version: 1,
        exportedAt: '2025-01-01T00:00:00.000Z',
        storageState: { cookies: [] },
        accountHash: 'abc123',
        metadata: {
          state: 'authenticated',
          reasonCode: 'none',
          lastHealthyAt: '2025-01-01T00:00:00.000Z'
        }
      }
      const encryptedBase64 = Buffer.from(JSON.stringify(innerV1)).toString('base64')
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: encryptedBase64
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))
      safeStorageMocks.decryptString.mockReturnValue(JSON.stringify(innerV1))

      const writeStorageStateSnapshot = vi.fn().mockResolvedValue(undefined)
      const runProbeAcrossApps = vi.fn().mockResolvedValue({ outcome: { healthy: true } })
      const writeStatus = vi
        .fn()
        .mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never,
        { runProbeAcrossApps } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(safeStorageMocks.decryptString).toHaveBeenCalledTimes(1)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
      expect(runProbeAcrossApps).toHaveBeenCalledWith({
        interactive: false,
        timeoutMs: expect.any(Number)
      })
    })

    it('rejects v2 import when safeStorage is unavailable', async () => {
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: 'dGVzdA=='
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_unavailable')
    })

    it('rejects v2 import when decryption fails', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: 'dGVzdA=='
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))
      safeStorageMocks.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('decryption_failed')
    })

    it('rejects v2 import when decrypted data is not valid v1', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      const badInnerData = { foo: 'bar' }
      const encryptedBase64 = Buffer.from(JSON.stringify(badInnerData)).toString('base64')
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: encryptedBase64
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))
      safeStorageMocks.decryptString.mockReturnValue(JSON.stringify(badInnerData))

      const importer = new SessionExportImport(null, {} as never, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_session_data')
    })

    describe('isSessionExportDataV1 edge cases', () => {
      it('rejects v1 data with __proto__ pollution', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          '{"version":1,"__proto__":{"cookies":[]},"storageState":null,"accountHash":null,"metadata":{"state":"requires_login","reasonCode":"none"}}'
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with constructor pollution', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({
            version: 1,
            constructor: { prototype: {} },
            storageState: null,
            accountHash: null,
            metadata: { state: 'requires_login', reasonCode: 'none' }
          })
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with non-object metadata', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({ version: 1, storageState: null, accountHash: null, metadata: 'invalid' })
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with non-string exportedAt', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({
            version: 1,
            exportedAt: 123,
            storageState: null,
            accountHash: null,
            metadata: { state: 'requires_login', reasonCode: 'none' }
          })
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with non-object storageState', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({
            version: 1,
            storageState: 'invalid',
            accountHash: null,
            metadata: { state: 'requires_login', reasonCode: 'none' }
          })
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with non-string metadata state', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({
            version: 1,
            storageState: null,
            accountHash: null,
            metadata: { state: 123, reasonCode: 'none' }
          })
        )
        const importer = new SessionExportImport(null, {} as never, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })
    })
  })
})
