import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const mockAppGetPath = vi.hoisted(() =>
  vi.fn((name: string) => {
    if (name === 'userData') return '/tmp/quizlab-userdata'
    return `/tmp/${name}`
  })
)
const mockApp = {
  isPackaged: false,
  getAppPath: vi.fn(() => '/app'),
  getPath: mockAppGetPath
}

const mockClipboard = { writeText: vi.fn() }

const mockServerListen = vi.hoisted(() =>
  vi.fn((_port: number, _host: string, cb: () => void) => {
    cb()
    return mockServer
  })
)
const mockServerOn = vi.hoisted(() => vi.fn())
const mockServerClose = vi.hoisted(() => vi.fn())
const mockServerAddress = vi.hoisted(() =>
  vi.fn(() => ({ port: 51999, address: '127.0.0.1', family: 'IPv4' }))
)
const mockServer = {
  listen: mockServerListen,
  on: mockServerOn,
  close: mockServerClose,
  address: mockServerAddress,
  listening: false
}
const mockCreateServer = vi.hoisted(() => vi.fn((_handler: unknown) => mockServer))

const mockFsStat = vi.hoisted(() => vi.fn())
const mockFsReaddir = vi.hoisted(() => vi.fn())
const mockFsCopyFile = vi.hoisted(() => vi.fn())
const mockFsMkdir = vi.hoisted(() => vi.fn())
const mockFsWriteFile = vi.hoisted(() => vi.fn())
const mockFsRm = vi.hoisted(() => vi.fn())
const mockFsReadFile = vi.hoisted(() => vi.fn())

const mockCryptoRandomBytes = vi.hoisted(() => vi.fn(() => Buffer.alloc(32, 0xab)))

const mockExecFile = vi.hoisted(() =>
  vi.fn(
    (_cmd: string, _args: string[], cb: (err: unknown, stdout: string, stderr: string) => void) => {
      cb(null, '', '')
    }
  )
)

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: mockApp,
  clipboard: mockClipboard,
  session: { fromPartition: vi.fn(() => ({ cookies: { set: vi.fn() } })) },
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      stat: mockFsStat,
      readdir: mockFsReaddir,
      copyFile: mockFsCopyFile,
      mkdir: mockFsMkdir,
      writeFile: mockFsWriteFile,
      rm: mockFsRm,
      readFile: mockFsReadFile
    }
  },
  promises: {
    stat: mockFsStat,
    readdir: mockFsReaddir,
    copyFile: mockFsCopyFile,
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
    rm: mockFsRm,
    readFile: mockFsReadFile
  }
}))

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto')
  return {
    default: { ...actual, randomBytes: mockCryptoRandomBytes },
    ...actual,
    randomBytes: mockCryptoRandomBytes,
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({ digest: vi.fn(() => 'mock-hmac') }))
    })),
    timingSafeEqual: vi.fn(() => true)
  }
})

vi.mock('child_process', () => ({
  execFile: mockExecFile,
  default: { execFile: mockExecFile }
}))

vi.mock('http', () => ({
  default: {
    createServer: mockCreateServer
  },
  createServer: mockCreateServer
}))

vi.mock('../../../features/gemini-web-session/sessionCookies', () => ({
  importExternalCookies: vi.fn()
}))

vi.mock('../../../features/gemini-web-session/sessionConfig', () => ({
  PROFILE_PARTITION: 'partition-test'
}))

vi.mock('../../../features/gemini-web-session/sessionManager', () => ({
  geminiWebSessionManager: {}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expectedBridgeInfo(port: number) {
  return JSON.stringify(
    {
      port,
      host: '127.0.0.1',
      endpoints: { cookies: '/api/cookies', health: '/api/health' }
    },
    null,
    2
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NativeMessagingManager', () => {
  let manager: typeof import('../../../features/native-messaging/nativeMessagingManager.js').nativeMessagingManager

  beforeEach(async () => {
    vi.clearAllMocks()
    mockApp.isPackaged = false
    mockFsStat.mockReset()
    mockFsReaddir.mockReset()
    mockFsCopyFile.mockReset()
    mockFsMkdir.mockReset()
    mockFsWriteFile.mockReset()
    mockFsRm.mockReset()
    mockCryptoRandomBytes.mockReset()
    mockServerListen.mockReset()
    mockServerOn.mockReset()
    mockServerClose.mockReset()
    mockServerAddress.mockReset()
    mockExecFile.mockReset()
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        cb: (err: unknown, stdout: string, stderr: string) => void
      ) => {
        cb(null, '', '')
      }
    )

    mockCryptoRandomBytes.mockReturnValue(Buffer.alloc(32, 0xab))
    mockFsStat.mockRejectedValue(new Error('ENOENT'))
    mockFsReaddir.mockResolvedValue([])
    mockFsRm.mockResolvedValue(undefined)
    mockFsMkdir.mockResolvedValue(undefined)
    mockFsWriteFile.mockResolvedValue(undefined)
    mockFsReadFile.mockReset()
    mockFsReadFile.mockResolvedValue('{"key": "placeholder"}')

    const mod = await import('../../../features/native-messaging/nativeMessagingManager.js')
    manager = mod.nativeMessagingManager
  })

  // -----------------------------------------------------------------------
  // Getters - initial state
  // -----------------------------------------------------------------------

  describe('getters', () => {
    it('connectionStatus starts as disconnected', () => {
      expect(manager.connectionStatus).toBe('disconnected')
    })

    it('port returns BRIDGE_PORT default (51999)', () => {
      expect(manager.port).toBe(51999)
    })

    it('sharedSecret returns a 64-char hex string', () => {
      expect(manager.sharedSecret).toMatch(/^[\da-f]{64}$/)
    })

    it('getExtensionInfo returns disconnected state with new fields', () => {
      const info = manager.getExtensionInfo()
      expect(info).toEqual({
        status: 'disconnected',
        installed: false,
        error: undefined,
        waitingSince: null,
        userHint: null
      })
    })
  })

  // -----------------------------------------------------------------------
  // installExtension
  // -----------------------------------------------------------------------

  describe('installExtension', () => {
    beforeEach(() => {
      mockFsStat.mockResolvedValue(undefined)
      mockFsReaddir.mockResolvedValue([{ name: 'manifest.json', isDirectory: () => false }])
    })

    it('copies extension, writes bridge-info, copies path to clipboard', async () => {
      const result = await manager.installExtension()

      expect(result.success).toBe(true)
      expect(result.installedPath).toMatch(/quizlab-session-extension$/)

      expect(mockFsRm).toHaveBeenCalledWith(expect.stringMatching(/quizlab-session-extension$/), {
        recursive: true,
        force: true
      })
      expect(mockFsMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/quizlab-session-extension$/),
        { recursive: true }
      )
      expect(mockFsCopyFile).toHaveBeenCalled()

      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('chrome-bridge-info.json'),
        expectedBridgeInfo(51999),
        'utf-8'
      )
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/quizlab-session-extension$/)
      )
      expect(manager.getExtensionInfo().installed).toBe(true)
    })

    it('writes the native host manifest with a forward-slash path (no JSON backslash escaping)', async () => {
      const result = await manager.installExtension()

      expect(result.success).toBe(true)

      const manifestCall = mockFsWriteFile.mock.calls.find(([filePath]) =>
        String(filePath).endsWith('com.quizlab.reader.json')
      )
      expect(manifestCall).toBeDefined()
      const content = String(manifestCall![1])
      expect(content).not.toContain('\\\\')
      const manifest = JSON.parse(content)
      expect(manifest.name).toBe('com.quizlab.reader')
      expect(manifest.type).toBe('stdio')
      // A backslash in the JSON `path` (unescaped) breaks Chrome's host lookup.
      expect(manifest.path).toMatch(/^[^\\]+$/)
    })

    it('registers the native host in the Chrome registry when installing', async () => {
      await manager.installExtension()

      expect(mockExecFile).toHaveBeenCalledTimes(1)
      const [cmd, args] = mockExecFile.mock.calls[0]
      expect(cmd).toBe('reg')
      expect(args[0]).toBe('add')
      expect(args[1]).toContain('NativeMessagingHosts\\com.quizlab.reader')
      expect(args[3]).toBe('/d')
      expect(String(args[4])).toMatch(/com\.quizlab\.reader\.json$/)
    })

    it('returns error when source extension missing', async () => {
      mockFsStat.mockRejectedValue(new Error('ENOENT'))

      const result = await manager.installExtension()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Extension not found at')
      expect(mockFsWriteFile).not.toHaveBeenCalled()
      expect(mockClipboard.writeText).not.toHaveBeenCalled()
    })

    it('returns error when fs operation fails', async () => {
      mockFsMkdir.mockRejectedValue(new Error('Disk full'))

      const result = await manager.installExtension()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk full')
    })
  })

  // -----------------------------------------------------------------------
  // removeExtension
  // -----------------------------------------------------------------------

  describe('removeExtension', () => {
    it('removes files and resets state', async () => {
      const result = await manager.removeExtension()

      expect(result.success).toBe(true)
      expect(mockFsRm).toHaveBeenCalledWith(expect.stringContaining('chrome-bridge-info.json'), {
        force: true
      })
      expect(mockFsRm).toHaveBeenCalledWith(expect.stringMatching(/quizlab-session-extension$/), {
        recursive: true,
        force: true
      })
      expect(manager.connectionStatus).toBe('disconnected')
      expect(manager.getExtensionInfo().installed).toBe(false)
    })

    it('removes the native host registry key on uninstall', async () => {
      await manager.removeExtension()

      expect(mockExecFile).toHaveBeenCalledTimes(1)
      const [cmd, args] = mockExecFile.mock.calls[0]
      expect(cmd).toBe('reg')
      expect(args[0]).toBe('delete')
      expect(args[1]).toContain('NativeMessagingHosts\\com.quizlab.reader')
    })

    it('returns error when fs.rm fails', async () => {
      mockFsRm.mockRejectedValue(new Error('Access denied'))

      const result = await manager.removeExtension()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Access denied')
      expect(manager.connectionStatus).toBe('disconnected')
    })
  })

  // -----------------------------------------------------------------------
  // stopServer
  // -----------------------------------------------------------------------

  describe('stopServer', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('closes the HTTP server, clears interval, sets status to disconnected', () => {
      expect(manager.connectionStatus).toBe('connecting')

      manager.stopServer()

      expect(mockServerClose).toHaveBeenCalledTimes(1)
      expect(manager.connectionStatus).toBe('disconnected')
    })
  })

  // -----------------------------------------------------------------------
  // dispose
  // -----------------------------------------------------------------------

  describe('dispose', () => {
    it('delegates to stopServer', () => {
      manager.dispose()
      expect(manager.connectionStatus).toBe('disconnected')
    })
  })

  // -----------------------------------------------------------------------
  // Bridge request origin validation (health endpoint security)
  // -----------------------------------------------------------------------

  describe('bridge origin validation', () => {
    // Verified key->ID pair (JSONView extension): the derived ID must be
    // chklaanhfefbnpoihckbnefhakgolnmc per Chromium's id_util.
    // This is a PUBLIC key (in the extension's manifest) — not a secret.
    /* eslint-disable no-secrets/no-secrets */
    const JSONVIEW_KEY =
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsTeRKuxevWiein7geQszhb8mHRpLByZbXX8tR0m1GPBkN8SN9xgo7NijAYAqa3H5rGuDmNZm2k7UzdlVfC5+gO6uf/rVOPx7kHJNQBQaBuWUEd4KHLWa3jOy+mllD72TwXNdtJJdX6TWf115SGHlLzZRg7S47dke6KTZI6O8gcQIDAQAB'
    /* eslint-enable no-secrets/no-secrets */

    beforeEach(async () => {
      mockFsReadFile.mockResolvedValue(JSON.stringify({ key: JSONVIEW_KEY }))
      mockFsStat.mockRejectedValue(new Error('ENOENT'))
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

    it('derives the extension ID from the manifest key (verified against JSONView)', () => {
      const managerAny = manager as unknown as { _expectedExtensionOrigin: string | null }
      const derived = managerAny._expectedExtensionOrigin
      expect(derived).toBe('chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc')
    })

    it('rejects health requests from arbitrary website origins', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: { origin: 'https://evil.example.com' }
        },
        res
      )
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
      expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
    })

    it('rejects health requests without an Origin header', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler({ method: 'GET', url: '/api/health', headers: {} }, res)
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    it('serves the secret to the paired extension origin', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: { origin: 'chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc' }
        },
        res
      )
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
      expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeTypeOf('string')
    })

    it('serves the secret to the exact configured dev origin (http://localhost:5173)', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: { origin: 'http://localhost:5173' }
        },
        res
      )
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
      expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeTypeOf('string')
    })

    it('rejects localhost origins on any other port in development', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: { origin: 'http://localhost:9999' }
        },
        res
      )
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
      expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
    })

    it('rejects http://127.0.0.1 dev origins when not configured', () => {
      const handler = getRequestHandler()
      const res = fakeRes()
      handler(
        {
          method: 'GET',
          url: '/api/health',
          headers: { origin: 'http://127.0.0.1:5173' }
        },
        res
      )
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
    })

    // ---------------------------------------------------------------------
    // Production policy (app.isPackaged=true): extension origin only.
    // ---------------------------------------------------------------------

    describe('production policy', () => {
      afterEach(() => {
        mockApp.isPackaged = false
      })

      it('serves the secret to the paired extension origin', () => {
        mockApp.isPackaged = true
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
        expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeTypeOf('string')
      })

      it('rejects http://localhost:5173', () => {
        mockApp.isPackaged = true
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'http://localhost:5173' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
        expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
      })

      it('rejects localhost origins on any other port', () => {
        mockApp.isPackaged = true
        const handler = getRequestHandler()
        const res = fakeRes()
        handler(
          {
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'http://localhost:9999' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
      })

      it('rejects arbitrary web origins', () => {
        mockApp.isPackaged = true
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
        expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
      })

      it('rejects requests without an Origin header', () => {
        mockApp.isPackaged = true
        const handler = getRequestHandler()
        const res = fakeRes()
        handler({ method: 'GET', url: '/api/health', headers: {} }, res)
        expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
        expect(JSON.parse(res.end.mock.calls[0][0]).secret).toBeUndefined()
      })
    })

    // ---------------------------------------------------------------------
    // CORS headers (never a wildcard; OPTIONS obeys the origin policy).
    // ---------------------------------------------------------------------

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
            headers: { origin: 'chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
        expect(acaoValues(res)).toEqual(['chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc'])
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
            headers: { origin: 'chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc' }
          },
          res
        )
        expect(res.writeHead).toHaveBeenCalledWith(204)
        expect(acaoValues(res)).toEqual(['chrome-extension://chklaanhfefbnpoihckbnefhakgolnmc'])
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

  // -----------------------------------------------------------------------
  // getExtensionInfo - new fields
  // -----------------------------------------------------------------------

  describe('getExtensionInfo new fields', () => {
    it('sets waitingSince after initialize (connecting state)', async () => {
      await manager.initialize()
      const info = manager.getExtensionInfo()
      expect(info.waitingSince).toBeTypeOf('number')
      expect(info.waitingSince).toBeGreaterThan(0)
    })

    it('returns userHint when bridge info exists and status is connecting', async () => {
      mockFsStat.mockResolvedValue(undefined)
      await manager.initialize()
      const info = manager.getExtensionInfo()
      expect(info.installed).toBe(true)
      expect(info.userHint).toBe('waiting')
    })

    it('returns userHint null when extension is not installed', async () => {
      // mockFsStat is already set to reject (no bridge info)
      await manager.initialize()
      const info = manager.getExtensionInfo()
      expect(info.installed).toBe(false)
      expect(info.userHint).toBeNull()
    })
  })
})
