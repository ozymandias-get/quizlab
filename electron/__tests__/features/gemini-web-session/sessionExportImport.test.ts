import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionExportImport } from '../../../features/gemini-web-session/sessionExportImport.js'

const testExportPath = path.join(os.tmpdir(), 'quizlab-test', 'export.enc')

const exportImportMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

const safeStorageMocks = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
  encryptString: vi.fn(),
  decryptString: vi.fn()
}))

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: safeStorageMocks.isEncryptionAvailable,
    getSelectedStorageBackend: safeStorageMocks.getSelectedStorageBackend,
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
    safeStorageMocks.isEncryptionAvailable.mockReset().mockReturnValue(true)
    // Guard against a previous test leaving the probe detached.
    if (typeof safeStorageMocks.getSelectedStorageBackend === 'function') {
      safeStorageMocks.getSelectedStorageBackend.mockReset().mockReturnValue('gnome_libsecret')
    }
    safeStorageMocks.encryptString.mockReset()
    safeStorageMocks.decryptString.mockReset()
  })

  describe('exportSession', () => {
    const snapshotRepo = (readStorageStateSnapshot: () => Promise<unknown>) =>
      ({
        readStorageStateSnapshot,
        writeStorageStateSnapshot: vi.fn(),
        clearSnapshot: vi.fn()
      }) as never

    const metadataRepo = (over: Record<string, unknown> = {}) =>
      ({
        readMetadata: vi.fn().mockResolvedValue({
          accountHash: 'abc123',
          state: 'authenticated',
          reasonCode: 'none',
          lastHealthyAt: '2025-01-01T00:00:00.000Z',
          ...over
        })
      }) as never

    it('exports session data to file', async () => {
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(true)
      expect(exportImportMocks.writeFile).toHaveBeenCalledTimes(1)
      const callArgs = exportImportMocks.writeFile.mock.calls[0]
      expect(callArgs.length).toBeGreaterThanOrEqual(2)
      expect(String(callArgs[1])).toContain('"version"')
    })

    it('exports with null storageState when snapshot missing', async () => {
      safeStorageMocks.encryptString.mockImplementation((json: string) => Buffer.from(json))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue(null)),
        metadataRepo({ accountHash: null, state: 'requires_login', lastHealthyAt: null })
      )

      await exporter.exportSession(testExportPath)

      // The plaintext payload is what gets encrypted, so assert on the
      // pre-encryption string rather than on the file contents.
      const plaintext = String(safeStorageMocks.encryptString.mock.calls[0][0])
      const data = JSON.parse(plaintext)
      expect(data.storageState).toBeNull()
      expect(data.accountHash).toBeNull()
    })

    it('returns error when file write fails', async () => {
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))
      exportImportMocks.writeFile.mockRejectedValue(new Error('Permission denied'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue(null)),
        metadataRepo({ accountHash: null })
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('never writes plaintext cookies to disk when the file is .enc', async () => {
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [{ name: 'SID', value: 'secret' }] })),
        metadataRepo()
      )

      await exporter.exportSession(testExportPath)

      const written = String(exportImportMocks.writeFile.mock.calls[0][1])
      expect(written).not.toContain('SID')
      expect(written).not.toContain('secret')
      const parsed = JSON.parse(written)
      expect(parsed.version).toBe(2)
      expect(parsed.encrypted).toBeTruthy()
      expect(parsed.storageState).toBeUndefined()
    })

    it('refuses to export when safeStorage is unavailable', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(false)

      const readStorageStateSnapshot = vi.fn().mockResolvedValue({ cookies: [] })
      const exporter = new SessionExportImport(
        snapshotRepo(readStorageStateSnapshot),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_unavailable')
      expect(result.detail).toBeTruthy()
      // Nothing may be written, and the snapshot must not even be read.
      expect(exportImportMocks.writeFile).not.toHaveBeenCalled()
      expect(readStorageStateSnapshot).not.toHaveBeenCalled()
      expect(safeStorageMocks.encryptString).not.toHaveBeenCalled()
    })

    it('refuses to export when Linux reports the basic_text backend', async () => {
      // safeStorage says "available", but basic_text keeps its key in a
      // plaintext file, so the .enc output would be readable by any process.
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('basic_text')

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_weak_backend')
      expect(result.detail).toBeTruthy()
      expect(exportImportMocks.writeFile).not.toHaveBeenCalled()
      expect(safeStorageMocks.encryptString).not.toHaveBeenCalled()
    })

    it('still exports on other Linux backends', async () => {
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('kwallet5')
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(true)
      expect(exportImportMocks.writeFile).toHaveBeenCalledTimes(1)
    })

    it('treats an empty backend string as usable', async () => {
      // Windows and macOS report no backend name; that must not be mistaken
      // for a weak one.
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('')
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
        metadataRepo()
      )

      expect((await exporter.exportSession(testExportPath)).success).toBe(true)
    })

    it('refuses to export when the backend cannot be verified', async () => {
      // The API exists but throws: the keystore is unverifiable, which must
      // not be treated as "safe to write".
      safeStorageMocks.getSelectedStorageBackend.mockImplementation(() => {
        throw new Error('not supported')
      })
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      const exporter = new SessionExportImport(
        snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_backend_unknown')
      expect(exportImportMocks.writeFile).not.toHaveBeenCalled()
    })

    it('exports when the backend API is absent', async () => {
      // Windows and macOS report no backend name at all; the absence of the
      // API is not itself a reason to refuse. The mock object is shared, so
      // the property has to be put back for the other tests.
      const mocks = safeStorageMocks as unknown as Record<string, unknown>
      const original = mocks.getSelectedStorageBackend
      mocks.getSelectedStorageBackend = undefined
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))

      try {
        const exporter = new SessionExportImport(
          snapshotRepo(vi.fn().mockResolvedValue({ cookies: [] })),
          metadataRepo()
        )

        expect((await exporter.exportSession(testExportPath)).success).toBe(true)
      } finally {
        mocks.getSelectedStorageBackend = original
      }
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
        { readMetadata } as never
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
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
    })

    it('rejects export with wrong version', async () => {
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({ version: 99, storageState: null })
      )

      const importer = new SessionExportImport(null, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      // The schema validator now catches wrong version as invalid_session_data
      expect(result.error).toBe('invalid_session_data')
    })

    it('returns error when file read fails', async () => {
      exportImportMocks.readFile.mockRejectedValue(new Error('File not found'))

      const importer = new SessionExportImport(null, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })

    it('returns error when JSON is invalid', async () => {
      exportImportMocks.readFile.mockResolvedValue('not json')

      const importer = new SessionExportImport(null, {} as never)

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
      const writeStatus = vi
        .fn()
        .mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never
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
      const writeStatus = vi
        .fn()
        .mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' })

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        { writeStatus, readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] }) } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(safeStorageMocks.decryptString).toHaveBeenCalledTimes(1)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
    })

    it('rejects v2 import when safeStorage is unavailable', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(false)
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: 'dGVzdA=='
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))

      const importer = new SessionExportImport(null, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_unavailable')
      expect(result.detail).toBeTruthy()
      expect(safeStorageMocks.decryptString).not.toHaveBeenCalled()
    })

    it('rejects v2 import when Linux reports the basic_text backend', async () => {
      // isEncryptionAvailable() is true, but basic_text cannot actually
      // decrypt, so the import must not be attempted at all.
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('basic_text')
      const exportDataV2 = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        encrypted: 'dGVzdA=='
      }
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(exportDataV2))

      const importer = new SessionExportImport(null, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_weak_backend')
      expect(safeStorageMocks.decryptString).not.toHaveBeenCalled()
    })

    it('warns when importing a legacy unencrypted file', async () => {
      const legacyV1 = {
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
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(legacyV1))

      const writeStorageStateSnapshot = vi.fn().mockResolvedValue(undefined)
      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot,
          clearSnapshot: vi.fn()
        } as never,
        {
          writeStatus: vi.fn().mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' }),
          readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] })
        } as never
      )

      const result = await importer.importSession(testExportPath)

      // Still importable, but the caller must be able to tell the user the
      // source file was not encrypted.
      expect(result.success).toBe(true)
      expect(result.warning).toBe('imported_unencrypted_legacy_file')
    })

    it('does not warn when importing an encrypted file', async () => {
      safeStorageMocks.decryptString.mockReturnValue(
        JSON.stringify({
          version: 1,
          exportedAt: '2025-01-01T00:00:00.000Z',
          storageState: { cookies: [] },
          accountHash: 'abc123',
          metadata: {
            state: 'authenticated',
            reasonCode: 'none',
            lastHealthyAt: '2025-01-01T00:00:00.000Z'
          }
        })
      )
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({
          version: 2,
          exportedAt: '2025-01-01T00:00:00.000Z',
          encrypted: 'dGVzdA=='
        })
      )

      const importer = new SessionExportImport(
        {
          readStorageStateSnapshot: vi.fn(),
          writeStorageStateSnapshot: vi.fn().mockResolvedValue(undefined),
          clearSnapshot: vi.fn()
        } as never,
        {
          writeStatus: vi.fn().mockResolvedValue({ state: 'authenticated', accountHash: 'abc123' }),
          readMetadata: vi.fn().mockResolvedValue({ enabledAppIds: [] })
        } as never
      )

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(result.warning).toBeUndefined()
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

      const importer = new SessionExportImport(null, {} as never)

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

      const importer = new SessionExportImport(null, {} as never)

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_session_data')
    })

    describe('isSessionExportDataV1 edge cases', () => {
      it('rejects v1 data with __proto__ pollution', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          '{"version":1,"__proto__":{"cookies":[]},"storageState":null,"accountHash":null,"metadata":{"state":"requires_login","reasonCode":"none"}}'
        )
        const importer = new SessionExportImport(null, {} as never)
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
        const importer = new SessionExportImport(null, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })

      it('rejects v1 data with non-object metadata', async () => {
        exportImportMocks.readFile.mockResolvedValue(
          JSON.stringify({ version: 1, storageState: null, accountHash: null, metadata: 'invalid' })
        )
        const importer = new SessionExportImport(null, {} as never)
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
        const importer = new SessionExportImport(null, {} as never)
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
        const importer = new SessionExportImport(null, {} as never)
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
        const importer = new SessionExportImport(null, {} as never)
        const result = await importer.importSession(testExportPath)
        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })
    })
  })
})
