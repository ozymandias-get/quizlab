import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QUIZLAB_EXTENSION_ORIGIN } from '../../../../shared/constants/extensionRelease.js'

const mockAppGetPath = vi.hoisted(() =>
  vi.fn((name: string) => {
    if (name === 'userData') return '/tmp/quizlab-userdata'
    return `/tmp/${name}`
  })
)
const mockApp = {
  isPackaged: false,
  getPath: mockAppGetPath
}

const mockServerListen = vi.hoisted(() =>
  vi.fn((_port: number, _host: string, cb: () => void) => {
    cb()
    return mockServer
  })
)
const mockServerOn = vi.hoisted(() => vi.fn())
const mockServerClose = vi.hoisted(() => vi.fn())
const mockServerRemoveAllListeners = vi.hoisted(() => vi.fn())
const mockServerAddress = vi.hoisted(() =>
  vi.fn(() => ({ port: 51999, address: '127.0.0.1', family: 'IPv4' }))
)
const mockServer = {
  listen: mockServerListen,
  on: mockServerOn,
  close: mockServerClose,
  removeAllListeners: mockServerRemoveAllListeners,
  address: mockServerAddress,
  listening: false
}
const mockCreateServer = vi.hoisted(() => vi.fn((_handler: unknown) => mockServer))

const mockFsMkdir = vi.hoisted(() => vi.fn())
const mockFsWriteFile = vi.hoisted(() => vi.fn())
const mockFsReadFile = vi.hoisted(() => vi.fn())
const mockFsRename = vi.hoisted(() => vi.fn())

const mockCryptoRandomBytes = vi.hoisted(() => vi.fn(() => Buffer.alloc(32, 0xab)))

vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: mockFsMkdir,
      writeFile: mockFsWriteFile,
      readFile: mockFsReadFile,
      rename: mockFsRename
    }
  },
  promises: {
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
    readFile: mockFsReadFile,
    rename: mockFsRename
  }
}))

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto')
  return {
    default: { ...actual, randomBytes: mockCryptoRandomBytes },
    ...actual,
    randomBytes: mockCryptoRandomBytes
  }
})

vi.mock('http', () => ({
  default: {
    createServer: mockCreateServer
  },
  createServer: mockCreateServer
}))

vi.mock('../../../app/constants', () => ({
  APP_CONFIG: {
    IPC_CHANNELS: {
      NATIVE_MESSAGING_EXTENSION_CONNECTED: 'native-messaging:extension-connected',
      NATIVE_MESSAGING_EXTENSION_DISCONNECTED: 'native-messaging:extension-disconnected'
    }
  }
}))

vi.mock('../../../core/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('NativeMessagingManager', () => {
  let manager: typeof import('../../../features/native-messaging/nativeMessagingManager.js').nativeMessagingManager

  beforeEach(async () => {
    vi.clearAllMocks()
    mockApp.isPackaged = false
    mockFsMkdir.mockReset()
    mockFsWriteFile.mockReset()
    mockFsReadFile.mockReset()
    mockFsRename.mockReset()
    mockCryptoRandomBytes.mockReset()
    mockServerListen.mockReset()
    mockServerOn.mockReset()
    mockServerClose.mockReset()
    mockServerRemoveAllListeners.mockReset()
    mockServerAddress.mockReset()

    mockCryptoRandomBytes.mockReturnValue(Buffer.alloc(32, 0xab))
    mockFsMkdir.mockResolvedValue(undefined)
    mockFsWriteFile.mockResolvedValue(undefined)
    mockFsRename.mockResolvedValue(undefined)
    // A missing secret file: the manager generates one.
    mockFsReadFile.mockRejectedValue(new Error('ENOENT'))

    const mod = await import('../../../features/native-messaging/nativeMessagingManager.js')
    manager = mod.nativeMessagingManager
    // The manager is a singleton, so a profile one test heard from would
    // otherwise be selected by the next one.
    const state = manager as unknown as {
      _profiles: Map<string, unknown>
      _selectedProfileId: string | null
      _selectionVersion: number
      _extensionProtocolVersion: number | null
      _legacyConnectedAt: number
      _paired: boolean
    }
    state._profiles.clear()
    state._selectedProfileId = null
    state._selectionVersion = 0
    state._extensionProtocolVersion = null
    state._legacyConnectedAt = 0
    state._paired = false
  })

  afterEach(() => {
    mockApp.isPackaged = false
    manager.stopServer()
  })

  describe('getters', () => {
    it('connectionStatus starts as disconnected', () => {
      expect(manager.connectionStatus).toBe('disconnected')
    })

    it('port returns BRIDGE_PORT default (51999)', () => {
      expect(manager.port).toBe(51999)
    })

    it('getPairingCode returns a 64-char hex string', () => {
      expect(manager.getPairingCode()).toMatch(/^[\da-f]{64}$/)
    })

    it('getExtensionInfo returns disconnected state', () => {
      const info = manager.getExtensionInfo()
      expect(info).toEqual({
        status: 'disconnected',
        paired: false,
        error: undefined,
        waitingSince: null,
        userHint: null,
        profiles: [],
        selectedProfileId: null
      })
    })
  })

  describe('initialize', () => {
    it('persists a fresh secret when none exists', async () => {
      await manager.initialize()

      expect(mockFsReadFile).toHaveBeenCalledWith(
        expect.stringContaining('bridge-secret.json'),
        'utf-8'
      )
      const writeCall = mockFsWriteFile.mock.calls.find(([filePath]) =>
        String(filePath).endsWith('bridge-secret.json')
      )
      expect(writeCall).toBeDefined()
      expect(JSON.parse(String(writeCall![1]))).toEqual({ secret: manager.getPairingCode() })
      expect(manager.getPairingCode()).toMatch(/^[\da-f]{64}$/)
    })

    it('reuses a persisted secret', async () => {
      const persisted = 'a'.repeat(64)
      mockFsReadFile.mockResolvedValue(JSON.stringify({ secret: persisted }))

      await manager.initialize()

      expect(manager.getPairingCode()).toBe(persisted)
      expect(mockFsWriteFile).not.toHaveBeenCalled()
    })

    it('starts the bridge server and enters the connecting state', async () => {
      await manager.initialize()

      expect(mockCreateServer).toHaveBeenCalledTimes(1)
      expect(mockServerListen).toHaveBeenCalledWith(51999, '127.0.0.1', expect.any(Function))
      expect(manager.connectionStatus).toBe('connecting')
      expect(manager.getExtensionInfo().waitingSince).toBeTypeOf('number')
      expect(manager.getExtensionInfo().userHint).toBe('waiting')
    })
  })

  describe('markExtensionPaired', () => {
    it('reports a paired extension after a signed request', async () => {
      await manager.markExtensionPaired()
      expect(manager.getExtensionInfo().paired).toBe(true)
    })

    it('keeps an origin-only request connected but not paired', () => {
      // Passing the origin check is not proof that the extension holds the
      // pairing code; only a signed request may set `paired`.
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')

      const info = manager.getExtensionInfo()
      // No source is selected yet, so the aggregate status is not "connected";
      // the profile itself is seen, and `paired` stays false.
      expect(info.status).toBe('connecting')
      expect(info.paired).toBe(false)
      expect(info.profiles[0]).toMatchObject({ connected: true, paired: false })
    })
  })

  describe('Chrome profiles', () => {
    it('tracks two extension instances and selects one', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')

      let info = manager.getExtensionInfo()
      expect(info.profiles.map((profile) => [profile.id, profile.name])).toEqual([
        ['profile-a-1234', 'Ana Chrome'],
        ['profile-b-1234', 'İş Chrome']
      ])
      expect(info.selectedProfileId).toBeNull()

      await manager.markExtensionPaired('profile-a-1234')
      info = manager.getExtensionInfo()
      expect(info.selectedProfileId).toBe('profile-a-1234')

      await expect(manager.selectProfile('profile-b-1234')).resolves.toBe(true)

      info = manager.getExtensionInfo()
      expect(info.selectedProfileId).toBe('profile-b-1234')
      expect(info.profiles[0]).toMatchObject({
        id: 'profile-b-1234',
        name: 'İş Chrome',
        selected: true
      })
    })

    it('refuses to select a profile the app has never heard from', async () => {
      await expect(manager.selectProfile('ghost-profile-1234')).resolves.toBe(false)
      expect(manager.getSelectedProfileId()).toBeNull()
    })

    it('pins the first paired profile instead of re-deriving the source', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')
      expect(manager.getSelectedProfileId()).toBeNull()

      await manager.markExtensionPaired('profile-b-1234')
      expect(manager.getSelectedProfileId()).toBe('profile-b-1234')

      // A later pairing must not move the source to the other profile.
      await manager.markExtensionPaired('profile-a-1234')
      expect(manager.getSelectedProfileId()).toBe('profile-b-1234')
    })

    it('does not report a first selection that could not be written', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      // Let the write that the new profile triggered finish before the
      // selection write is failed on purpose.
      await vi.waitFor(() => expect(mockFsWriteFile).toHaveBeenCalled())

      // Both attempts of the save fail.
      mockFsWriteFile.mockRejectedValue(new Error('the disk is full'))
      await manager.markExtensionPaired('profile-a-1234')

      // The user must not see a source that a restart would forget.
      expect(manager.getSelectedProfileId()).toBeNull()

      // The next signed request is the retry path.
      mockFsWriteFile.mockResolvedValue(undefined)
      await manager.markExtensionPaired('profile-a-1234')
      expect(manager.getSelectedProfileId()).toBe('profile-a-1234')
    })

    it('commits only one selection when two profiles pair at the same time', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')

      await Promise.all([
        manager.markExtensionPaired('profile-a-1234'),
        manager.markExtensionPaired('profile-b-1234')
      ])

      // The first pairing reserves the selection; the second waits for it and
      // must not overwrite the disk with a different source.
      expect(manager.getSelectedProfileId()).toBe('profile-a-1234')
      expect(manager.getSelectionVersion()).toBe(1)
    })

    it('retries a failed profile write before giving up', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      await vi.waitFor(() => expect(mockFsWriteFile).toHaveBeenCalledTimes(1))

      mockFsWriteFile.mockRejectedValueOnce(new Error('transient lock'))
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')

      await vi.waitFor(() => expect(mockFsWriteFile).toHaveBeenCalledTimes(3))
      expect(manager.getExtensionInfo().profilePersistenceError).toBeUndefined()
    })

    it('reports a profile write that failed both attempts', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      await vi.waitFor(() => expect(mockFsWriteFile).toHaveBeenCalledTimes(1))

      mockFsWriteFile.mockRejectedValue(new Error('the disk is read-only'))
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')

      await vi.waitFor(() =>
        expect(manager.getExtensionInfo().profilePersistenceError).toContain('read-only')
      )
      expect(mockFsWriteFile).toHaveBeenCalledTimes(3)
    })

    it('reports a legacy extension as outdated even when a profile is stored', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen()
      await manager.markExtensionPaired()
      manager.recordExtensionProtocolVersion(undefined, 2)

      const info = manager.getExtensionInfo()
      expect(info.status).toBe('connected')
      expect(info.paired).toBe(true)
      expect(manager.getExtensionProtocolVersion()).toBe(2)
    })

    it('advances the selection revision only when the profile changes', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')
      expect(manager.getSelectionVersion()).toBe(0)

      await manager.selectProfile('profile-a-1234')
      expect(manager.getSelectionVersion()).toBe(1)

      await manager.selectProfile('profile-a-1234')
      expect(manager.getSelectionVersion()).toBe(1)

      await manager.selectProfile('profile-b-1234')
      expect(manager.getSelectionVersion()).toBe(2)
    })

    it('keeps the selected profile paired separately from the other one', async () => {
      manager.markExtensionSeen('profile-a-1234', 'Ana Chrome')
      manager.markExtensionSeen('profile-b-1234', 'İş Chrome')
      await manager.selectProfile('profile-a-1234')
      await manager.markExtensionPaired('profile-b-1234')

      expect(manager.getExtensionInfo().paired).toBe(false)
      await manager.markExtensionPaired('profile-a-1234')
      expect(manager.getExtensionInfo().paired).toBe(true)
    })
  })

  describe('stopServer', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('closes the HTTP server, clears interval, sets status to disconnected', () => {
      expect(manager.connectionStatus).toBe('connecting')

      manager.stopServer()

      expect(mockServerClose).toHaveBeenCalledTimes(1)
      expect(mockServerRemoveAllListeners).toHaveBeenCalledTimes(1)
      expect(manager.connectionStatus).toBe('disconnected')
    })

    it('still closes the server when listener cleanup throws', () => {
      mockServerRemoveAllListeners.mockImplementationOnce(() => {
        throw new Error('already disposed')
      })

      manager.stopServer()

      expect(mockServerClose).toHaveBeenCalledTimes(1)
      expect(manager.connectionStatus).toBe('disconnected')
    })
  })

  describe('bridge origin validation', () => {
    const EXTENSION_ORIGIN = QUIZLAB_EXTENSION_ORIGIN

    beforeEach(async () => {
      await manager.initialize()
    })

    function getRequestHandler() {
      const createCall = mockCreateServer.mock.calls.find((call) => typeof call[0] === 'function')
      return createCall![0] as (req: unknown, res: unknown) => void
    }

    function fakeRes() {
      return {
        writeHead: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn()
      }
    }

    it('pins the expected origin to the release extension id', () => {
      const managerAny = manager as unknown as { _expectedExtensionOrigin: string | null }
      expect(managerAny._expectedExtensionOrigin).toBe(
        'chrome-extension://follalbajmbjmkejipfikekdiodbkggp'
      )
    })

    const PACKAGED = [false, true]

    function requestHealth(origin: string | undefined): ReturnType<typeof fakeRes> {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: origin === undefined ? {} : { origin }
        },
        res
      )
      return res
    }

    it.each(PACKAGED)('never serves the pairing code over HTTP (packaged=%s)', (packaged) => {
      mockApp.isPackaged = packaged
      const res = requestHealth(EXTENSION_ORIGIN)
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
      expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
    })

    it.each(PACKAGED)('rejects arbitrary website origins (packaged=%s)', (packaged) => {
      mockApp.isPackaged = packaged
      const res = requestHealth('https://evil.example.com')
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    it.each(PACKAGED)('rejects requests with no Origin header (packaged=%s)', (packaged) => {
      mockApp.isPackaged = packaged
      const res = requestHealth(undefined)
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    it.each(PACKAGED)('rejects localhost origins on any other port (packaged=%s)', (packaged) => {
      mockApp.isPackaged = packaged
      const res = requestHealth('http://localhost:9999')
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    it('serves the dev server origin only in development', () => {
      mockApp.isPackaged = false
      expect(requestHealth('http://localhost:5173').writeHead).toHaveBeenCalledWith(
        200,
        expect.anything()
      )

      mockApp.isPackaged = true
      const res = requestHealth('http://localhost:5173')
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    describe('CORS headers', () => {
      function acaoValues(res: ReturnType<typeof fakeRes>) {
        return res.setHeader.mock.calls
          .filter((call) => call[0] === 'Access-Control-Allow-Origin')
          .map((call) => call[1])
      }

      it('echoes the exact allowlisted origin — never a wildcard', () => {
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'GET',
            url: '/api/health',
            headers: { origin: EXTENSION_ORIGIN }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
        expect(acaoValues(res)).toEqual([EXTENSION_ORIGIN])
        expect(res.setHeader.mock.calls.flat()).not.toContain('*')
      })

      it('sets no Access-Control-Allow-Origin for disallowed origins', () => {
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'https://evil.com' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
        expect(acaoValues(res)).toEqual([])
      })

      it('answers OPTIONS preflights from allowed origins with 204 and echoed origin', () => {
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'OPTIONS',
            url: '/api/health',
            headers: { origin: EXTENSION_ORIGIN }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(204)
        expect(acaoValues(res)).toEqual([EXTENSION_ORIGIN])
      })

      it('rejects OPTIONS preflights from disallowed origins with 403', () => {
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'OPTIONS',
            url: '/api/health',
            headers: { origin: 'http://localhost:9999' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
        expect(acaoValues(res)).toEqual([])
      })

      it('answers OPTIONS preflights from the dev origin with 204', () => {
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'OPTIONS',
            url: '/api/health',
            headers: { origin: 'http://localhost:5173' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(204)
        expect(acaoValues(res)).toEqual(['http://localhost:5173'])
      })
    })
  })

  describe('the liveness of the extension', () => {
    beforeEach(async () => {
      const state = manager as unknown as {
        _connectionStatus: string
        _waitingSince: number | null
        _extensionLastSeenAt: number
      }
      state._connectionStatus = 'connecting'
      state._waitingSince = Date.now()
      state._extensionLastSeenAt = 0
      await manager.initialize()
      ;(
        manager as unknown as { _expectedExtensionOrigin: string | null }
      )._expectedExtensionOrigin = QUIZLAB_EXTENSION_ORIGIN
    })

    function request(url: string, origin: string | undefined) {
      const createCall = mockCreateServer.mock.calls.find((call) => typeof call[0] === 'function')
      const handler = createCall![0] as (req: unknown, res: unknown) => void
      const res = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() }
      handler(
        {
          method: 'GET',
          url,
          headers: origin === undefined ? {} : { origin }
        },
        res
      )
      return res
    }

    it('marks the extension as connected when a request comes from its origin', () => {
      expect(manager.connectionStatus).toBe('connecting')

      request('/api/health', QUIZLAB_EXTENSION_ORIGIN)

      expect(manager.connectionStatus).toBe('connected')
    })

    it('does not mark the extension as connected for a foreign origin', () => {
      request('/api/health', 'https://evil.example.com')

      expect(manager.connectionStatus).toBe('connecting')
    })
  })

  describe('the protocol version of the extension', () => {
    beforeEach(async () => {
      ;(
        manager as unknown as { _extensionProtocolVersion: number | null }
      )._extensionProtocolVersion = null
      await manager.initialize()
      ;(
        manager as unknown as { _expectedExtensionOrigin: string | null }
      )._expectedExtensionOrigin = QUIZLAB_EXTENSION_ORIGIN
    })

    function requestHealth(version?: string) {
      const createCall = mockCreateServer.mock.calls.find((call) => typeof call[0] === 'function')
      const handler = createCall![0] as (req: unknown, res: unknown) => void
      const res = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() }
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: {
            origin: QUIZLAB_EXTENSION_ORIGIN,
            ...(version === undefined ? {} : { 'x-protocol-version': version })
          }
        },
        res
      )
      return res
    }

    it('knows no version before the extension says one', () => {
      expect(manager.getExtensionProtocolVersion()).toBeNull()
    })

    it('remembers the version the extension reported', () => {
      requestHealth('2')
      expect(manager.getExtensionProtocolVersion()).toBe(2)
    })

    it('ignores a version that is not a number', () => {
      requestHealth('two')
      expect(manager.getExtensionProtocolVersion()).toBeNull()
    })

    it('forgets the version when the bridge stops', () => {
      requestHealth('2')
      expect(manager.getExtensionProtocolVersion()).toBe(2)

      manager.stopServer()

      expect(manager.getExtensionProtocolVersion()).toBeNull()
    })
  })
})
