import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const mockCreateServer = vi.hoisted(() => vi.fn(() => mockServer))

const mockFsStat = vi.hoisted(() => vi.fn())
const mockFsReaddir = vi.hoisted(() => vi.fn())
const mockFsCopyFile = vi.hoisted(() => vi.fn())
const mockFsMkdir = vi.hoisted(() => vi.fn())
const mockFsWriteFile = vi.hoisted(() => vi.fn())
const mockFsRm = vi.hoisted(() => vi.fn())

const mockCryptoRandomBytes = vi.hoisted(() => vi.fn(() => Buffer.alloc(32, 0xab)))

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
      rm: mockFsRm
    }
  },
  promises: {
    stat: mockFsStat,
    readdir: mockFsReaddir,
    copyFile: mockFsCopyFile,
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
    rm: mockFsRm
  }
}))

vi.mock('crypto', () => ({
  default: { randomBytes: mockCryptoRandomBytes },
  randomBytes: mockCryptoRandomBytes,
  createHmac: vi.fn(() => ({
    update: vi.fn(() => ({ digest: vi.fn(() => 'mock-hmac') }))
  })),
  timingSafeEqual: vi.fn(() => true)
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
  Logger: { warn: vi.fn(), error: vi.fn() }
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

    mockCryptoRandomBytes.mockReturnValue(Buffer.alloc(32, 0xab))
    mockFsStat.mockRejectedValue(new Error('ENOENT'))
    mockFsReaddir.mockResolvedValue([])
    mockFsRm.mockResolvedValue(undefined)
    mockFsMkdir.mockResolvedValue(undefined)
    mockFsWriteFile.mockResolvedValue(undefined)

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
