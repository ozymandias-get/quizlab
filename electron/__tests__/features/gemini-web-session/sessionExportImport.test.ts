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
    // A getter, not a captured reference: the "backend API is absent" case is
    // expressed by deleting the property from the hoisted object, and a plain
    // value copy would keep serving the original probe and never reach the
    // `typeof probe !== 'function'` branch in sessionEncryptionCapability.ts.
    get getSelectedStorageBackend() {
      return safeStorageMocks.getSelectedStorageBackend
    },
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

    // All three refusals are the same contract — report a stable error code and
    // write nothing to disk — reached through different keystore states.
    it.each([
      [
        'safeStorage is unavailable',
        'encryption_unavailable',
        (m: typeof safeStorageMocks) => m.isEncryptionAvailable.mockReturnValue(false)
      ],
      [
        'Linux reports the basic_text backend',
        'encryption_weak_backend',
        // safeStorage says "available", but basic_text keeps its key in a
        // plaintext file, so the .enc output would be readable by any process.
        (m: typeof safeStorageMocks) => m.getSelectedStorageBackend.mockReturnValue('basic_text')
      ],
      [
        'the backend probe throws',
        'encryption_backend_unknown',
        // The API exists but throws: the keystore is unverifiable, which must
        // not be treated as "safe to write".
        (m: typeof safeStorageMocks) =>
          m.getSelectedStorageBackend.mockImplementation(() => {
            throw new Error('not supported')
          })
      ]
    ])('refuses to export when %s', async (_label, expectedError, arrange) => {
      arrange(safeStorageMocks)
      safeStorageMocks.encryptString.mockReturnValue(Buffer.from('encrypted-content'))
      const readStorageStateSnapshot = vi.fn().mockResolvedValue({ cookies: [] })

      const exporter = new SessionExportImport(
        snapshotRepo(readStorageStateSnapshot),
        metadataRepo()
      )

      const result = await exporter.exportSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe(expectedError)
      expect(result.detail).toBeTruthy()
      expect(exportImportMocks.writeFile).not.toHaveBeenCalled()
      expect(safeStorageMocks.encryptString).not.toHaveBeenCalled()
      // Nothing may be written, and the snapshot must not even be read.
      expect(readStorageStateSnapshot).not.toHaveBeenCalled()
    })

    it('still exports on backends that are not basic_text', async () => {
      // kwallet/gnome on Linux, no backend name at all on Windows and macOS,
      // and an Electron build that does not expose the API. None of these may
      // be mistaken for a weak or unverifiable keystore.
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('kwallet5')
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
      expect(JSON.parse(String(callArgs[1]))).toMatchObject({ version: 2 })
    })

    it.each([
      ['an empty backend string (Windows/macOS)', ''],
      ['an absent backend API', undefined]
    ])('still exports when safeStorage reports %s', async (_label, backend) => {
      const mocks = safeStorageMocks as unknown as Record<string, unknown>
      const original = mocks.getSelectedStorageBackend
      mocks.getSelectedStorageBackend =
        backend === undefined ? undefined : vi.fn().mockReturnValue(backend)
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
      expect(typeof parsed.encrypted).toBe('string')
      expect(parsed.storageState).toBeUndefined()
      expect(exportImportMocks.writeFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('importSession', () => {
    // Every import test needs the same two collaborators. Naming them once here
    // removes ~10 lines of identical `as never` scaffolding per test.
    const VALID_V1 = {
      version: 1,
      exportedAt: '2025-01-01T00:00:00.000Z',
      storageState: { cookies: [] },
      accountHash: 'abc123',
      metadata: { state: 'authenticated', reasonCode: 'none', lastHealthyAt: null }
    }

    function createImporter() {
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
      return { importer, writeStorageStateSnapshot, writeStatus }
    }

    /** A schema-rejected importer: the constructor args are never reached. */
    function bareImporter() {
      return new SessionExportImport(null, {} as never)
    }

    /** A well-formed v2 envelope; the ciphertext body is supplied per test. */
    const ENCRYPTED_V2 = () => ({
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      encrypted: 'dGVzdA=='
    })

    it('imports session from valid export file', async () => {
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(VALID_V1))
      const { importer, writeStorageStateSnapshot } = createImporter()

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
    })

    it.each([
      ['an unknown schema version', { version: 99, storageState: null }, 'invalid_session_data'],
      ['unreadable JSON', 'not json', null],
      ['a failed file read', new Error('File not found'), 'File not found']
    ] as const)('rejects %s', async (_label, payload, expectedError) => {
      if (payload instanceof Error) {
        exportImportMocks.readFile.mockRejectedValue(payload)
      } else {
        exportImportMocks.readFile.mockResolvedValue(
          typeof payload === 'string' ? payload : JSON.stringify(payload)
        )
      }

      const result = await bareImporter().importSession(testExportPath)

      expect(result.success).toBe(false)
      if (expectedError === null) {
        expect(result.error).toBeTruthy()
      } else {
        expect(result.error).toBe(expectedError)
      }
    })

    it('skips snapshot restore when storageState is null', async () => {
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({ ...VALID_V1, storageState: null })
      )
      const { importer, writeStorageStateSnapshot } = createImporter()

      await importer.importSession(testExportPath)

      expect(writeStorageStateSnapshot).not.toHaveBeenCalled()
    })

    it('imports session from valid v2 (encrypted) export', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({
          ...ENCRYPTED_V2(),
          encrypted: Buffer.from(JSON.stringify(VALID_V1)).toString('base64')
        })
      )
      safeStorageMocks.decryptString.mockReturnValue(JSON.stringify(VALID_V1))
      const { importer, writeStorageStateSnapshot } = createImporter()

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(safeStorageMocks.decryptString).toHaveBeenCalledTimes(1)
      expect(writeStorageStateSnapshot).toHaveBeenCalledWith({ cookies: [] })
    })

    it('rejects v2 import when safeStorage is unavailable', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(false)
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(ENCRYPTED_V2()))

      const result = await bareImporter().importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_unavailable')
      expect(result.detail).toBeTruthy()
      expect(safeStorageMocks.decryptString).not.toHaveBeenCalled()
    })

    it('rejects v2 import when Linux reports the basic_text backend', async () => {
      // isEncryptionAvailable() is true, but basic_text cannot actually
      // decrypt, so the import must not be attempted at all.
      safeStorageMocks.getSelectedStorageBackend.mockReturnValue('basic_text')
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(ENCRYPTED_V2()))

      const result = await bareImporter().importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('encryption_weak_backend')
      expect(safeStorageMocks.decryptString).not.toHaveBeenCalled()
    })

    it('warns when importing a legacy unencrypted file', async () => {
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(VALID_V1))
      const { importer } = createImporter()

      const result = await importer.importSession(testExportPath)

      // Still importable, but the caller must be able to tell the user the
      // source file was not encrypted.
      expect(result.success).toBe(true)
      expect(result.warning).toBe('imported_unencrypted_legacy_file')
    })

    it('does not warn when importing an encrypted file', async () => {
      safeStorageMocks.decryptString.mockReturnValue(JSON.stringify(VALID_V1))
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(ENCRYPTED_V2()))
      const { importer } = createImporter()

      const result = await importer.importSession(testExportPath)

      expect(result.success).toBe(true)
      expect(result.warning).toBeUndefined()
    })

    it('rejects v2 import when decryption fails', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      exportImportMocks.readFile.mockResolvedValue(JSON.stringify(ENCRYPTED_V2()))
      safeStorageMocks.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      const result = await bareImporter().importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('decryption_failed')
    })

    it('rejects v2 import when decrypted data is not valid v1', async () => {
      safeStorageMocks.isEncryptionAvailable.mockReturnValue(true)
      const badInnerData = { foo: 'bar' }
      exportImportMocks.readFile.mockResolvedValue(
        JSON.stringify({
          version: 2,
          exportedAt: '2025-01-01T00:00:00.000Z',
          encrypted: Buffer.from(JSON.stringify(badInnerData)).toString('base64')
        })
      )
      safeStorageMocks.decryptString.mockReturnValue(JSON.stringify(badInnerData))

      const result = await bareImporter().importSession(testExportPath)

      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_session_data')
    })

    // All of these payloads go through the same v1 schema validator, so this
    // is one behaviour with several inputs rather than six behaviours.
    describe('isSessionExportDataV1 edge cases', () => {
      const VALID_TAIL = {
        storageState: null,
        accountHash: null,
        metadata: { state: 'auth_required', reasonCode: 'none' }
      }

      it.each([
        [
          '__proto__ pollution',
          '{"version":1,"__proto__":{"cookies":[]},"storageState":null,"accountHash":null,"metadata":{"state":"auth_required","reasonCode":"none"}}'
        ],
        [
          'constructor pollution',
          JSON.stringify({
            version: 1,
            constructor: { prototype: {} },
            storageState: null,
            accountHash: null,
            metadata: { state: 'auth_required', reasonCode: 'none' }
          })
        ],
        [
          'non-object metadata',
          JSON.stringify({ version: 1, storageState: null, accountHash: null, metadata: 'invalid' })
        ],
        ['non-string exportedAt', JSON.stringify({ ...VALID_TAIL, version: 1, exportedAt: 123 })],
        [
          'non-object storageState',
          JSON.stringify({ ...VALID_TAIL, version: 1, storageState: 'invalid' })
        ],
        ['a non-string accountHash', JSON.stringify({ ...VALID_TAIL, version: 1, accountHash: 7 })],
        [
          'non-string metadata state',
          JSON.stringify({
            version: 1,
            storageState: null,
            accountHash: null,
            metadata: { state: 123, reasonCode: 'none' }
          })
        ],
        ['an unknown schema version', JSON.stringify({ version: 99, storageState: null })]
      ])('rejects v1 data with %s', async (_label, rawJson) => {
        exportImportMocks.readFile.mockResolvedValue(rawJson)
        const importer = new SessionExportImport(null, {} as never)

        const result = await importer.importSession(testExportPath)

        expect(result.success).toBe(false)
        expect(result.error).toBe('invalid_session_data')
      })
    })
  })
})
