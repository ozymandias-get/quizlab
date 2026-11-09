import { Readable } from 'stream'
import path from 'path'
import { pathToFileURL } from 'url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const TEST_APP_PATH = process.platform === 'win32' ? 'C:\\app' : '/app'
const TEST_APP_REFERER = pathToFileURL(path.join(TEST_APP_PATH, 'dist', 'index.html')).href

const protocolHandleMock = vi.fn()
const ipcHandleMock = vi.fn()
const showOpenDialogMock = vi.fn()
const getPathMock = vi.fn()
const setItemMock = vi.fn()
const readMock = vi.fn()
const existsSyncMock = vi.fn()
const statMock = vi.fn()
const openMock = vi.fn()
const closeMock = vi.fn()
const readHeadMock = vi.fn()
const createReadStreamMock = vi.fn()
const requireTrustedIpcSenderMock = vi.fn()

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: protocolHandleMock
  },
  ipcMain: {
    handle: ipcHandleMock
  },
  dialog: {
    showOpenDialog: showOpenDialogMock
  },
  app: {
    getPath: getPathMock,
    getAppPath: () => TEST_APP_PATH
  }
}))

vi.mock('../../../core/ConfigManager', () => ({
  ConfigManager: class {
    setItem = setItemMock
    read = readMock
  }
}))

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender: requireTrustedIpcSenderMock
}))

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    promises: { stat: statMock, open: openMock },
    createReadStream: createReadStreamMock
  }
}))

type ProtocolHandler = (request: { url: string; headers: Headers }) => Promise<Response>

function getProtocolHandler(): ProtocolHandler {
  const call = protocolHandleMock.mock.calls.find(([scheme]) => scheme === 'local-pdf')
  if (!call) throw new Error('Protocol handler not registered')
  return call[1] as ProtocolHandler
}

function getIpcHandler(channel: string) {
  const call = ipcHandleMock.mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`IPC handler not registered for ${channel}`)
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>
}

function makeFakeFileStream() {
  return new Readable({ read() {} })
}

function makeRequest(
  url: string,
  headers: Record<string, string> = {},
  options: { withOrigin?: boolean } = {}
) {
  const allHeaders =
    options.withOrigin === false ? headers : { origin: 'http://localhost:5173', ...headers }
  return {
    url,
    headers: {
      get: (name: string) => allHeaders[name.toLowerCase()] ?? null
    }
  } as unknown as { url: string; headers: Headers }
}

async function registerTestPdf(
  filePath: string,
  options: { size?: number; mtimeMs?: number } = {}
) {
  const { size = 1000, mtimeMs = 1700000000000 } = options
  showOpenDialogMock.mockResolvedValueOnce({ canceled: false, filePaths: [filePath] })
  statMock.mockResolvedValueOnce({ size, mtimeMs })

  const selectHandler = getIpcHandler(APP_CONFIG.IPC_CHANNELS.SELECT_PDF)
  const raw = await selectHandler({ sender: {} }, {})
  const result = (raw as { ok: true; data: { streamUrl: string } }).data
  return result.streamUrl
}

async function loadAndRegister() {
  const mod = await import('../../../features/pdf/pdfProtocol.js')
  mod.registerPdfProtocolHandlers()
  mod.registerPdfProtocol()
  return mod
}

describe('local-pdf:// protocol handler', () => {
  beforeEach(() => {
    vi.resetModules()
    protocolHandleMock.mockReset()
    ipcHandleMock.mockReset()
    showOpenDialogMock.mockReset()
    getPathMock
      .mockReset()
      .mockImplementation((name: string) =>
        name === 'documents' ? '/home/u/Documents' : '/app/userData'
      )
    setItemMock.mockReset().mockResolvedValue(undefined)
    readMock.mockReset().mockResolvedValue({})
    existsSyncMock.mockReset().mockReturnValue(true)
    statMock.mockReset().mockResolvedValue({ size: 1000, mtimeMs: 1700000000000 })
    openMock.mockReset().mockImplementation(async () => ({
      fd: 42,
      stat: statMock,
      read: readHeadMock,
      close: closeMock
    }))
    closeMock.mockReset().mockResolvedValue(undefined)
    readHeadMock.mockReset().mockImplementation(async (buffer: Buffer) => {
      Buffer.from('%PDF-1.7').copy(buffer)
      return { bytesRead: 8 }
    })
    createReadStreamMock.mockReset().mockImplementation(() => makeFakeFileStream())
    requireTrustedIpcSenderMock.mockReset().mockReturnValue(true)
  })

  describe('normalization', () => {
    it('streams from the normalized path when a non-normalized path is selected', async () => {
      await loadAndRegister()
      const rawSelection = '/test/../test/file.pdf'
      const streamUrl = await registerTestPdf(rawSelection)
      const normalized = path.normalize(rawSelection)

      const response = await getProtocolHandler()(makeRequest(streamUrl))

      expect(response.status).toBe(200)
      expect(createReadStreamMock).toHaveBeenCalledWith(
        normalized,
        expect.objectContaining({ highWaterMark: 1024 * 1024 })
      )
    })
  })

  describe('dialog directory', () => {
    it('starts in the documents directory and reopens the last used one', async () => {
      await loadAndRegister()
      await registerTestPdf('/home/u/Pictures/a.pdf')

      expect(showOpenDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: '/home/u/Documents' })
      )

      await registerTestPdf('/home/u/Pictures/b.pdf')

      expect(showOpenDialogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ defaultPath: '/home/u/Pictures' })
      )
    })
  })

  describe('authorization', () => {
    it('returns 404 for unknown pdfId', async () => {
      await loadAndRegister()

      const response = await getProtocolHandler()(makeRequest('local-pdf://unknown_id_xyz'))

      expect(response.status).toBe(404)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    it('returns 404 when registered file no longer exists on disk', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf')
      // existsSync artık kullanılmıyor; onun yerine fs.promises.stat
      // dosya bulunamayınca reject etmeli.
      statMock.mockRejectedValueOnce(new Error('ENOENT'))

      const response = await getProtocolHandler()(makeRequest(streamUrl))

      expect(response.status).toBe(404)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })
  })

  describe('caching (ETag / 304)', () => {
    it('returns 304 with ETag when If-None-Match matches', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', {
        size: 1000,
        mtimeMs: 1700000000000
      })
      const etag = 'W/"1000-1700000000000"'
      closeMock.mockClear()

      const response = await getProtocolHandler()(makeRequest(streamUrl, { 'if-none-match': etag }))

      expect(response.status).toBe(304)
      expect(response.headers.get('etag')).toBe(etag)
      expect(createReadStreamMock).not.toHaveBeenCalled()
      // The 304 path does not create a stream; it closes the descriptor.
      expect(closeMock).toHaveBeenCalledTimes(1)
    })

    it('returns 200 (not 304) when If-None-Match does not match', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf')

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { 'if-none-match': 'W/"different"' })
      )

      expect(response.status).toBe(200)
    })
  })

  describe('full file response (200)', () => {
    it('returns 200 with full Content-Length and no Content-Range', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-length')).toBe('1000')
      expect(response.headers.get('content-range')).toBeNull()
      expect(createReadStreamMock).toHaveBeenCalledWith(
        path.normalize('/test/file.pdf'),
        expect.objectContaining({ highWaterMark: 1024 * 1024 })
      )
    })

    it('includes security headers on 200 response', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf')

      const response = await getProtocolHandler()(makeRequest(streamUrl))

      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('cache-control')).toBe('private, max-age=0, must-revalidate')
      expect(response.headers.get('accept-ranges')).toBe('bytes')
    })
  })

  describe('range response (206)', () => {
    it('returns 206 with Content-Range for closed range', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=0-99' }))

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 0-99/1000')
      expect(response.headers.get('content-length')).toBe('100')
      expect(createReadStreamMock).toHaveBeenCalledWith(
        path.normalize('/test/file.pdf'),
        expect.objectContaining({
          start: 0,
          end: 99,
          highWaterMark: 1024 * 1024
        })
      )
    })

    it('returns 206 for open-ended range (bytes=N-)', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=900-' }))

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 900-999/1000')
      expect(response.headers.get('content-length')).toBe('100')
    })

    it('returns 206 for last-byte range (bytes=N-N)', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=999-999' })
      )

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 999-999/1000')
      expect(response.headers.get('content-length')).toBe('1')
    })
  })

  // SECURITY: these exercise the real origin gate in pdfProtocol.ts
  // (isAllowedPdfOrigin + the origin/referer/sec-fetch-site block). The old
  // pdfProtocolSecurity.test.ts only grepped the source text for the string
  // 'Access-Control-Allow-Origin', which ran no product code at all.
  describe('CORS origin validation', () => {
    it('serves the request and echoes a validated localhost origin back in Access-Control-Allow-Origin', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { origin: 'http://localhost:5173' })
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
      expect(response.headers.get('vary')).toBe('Origin')
      expect(response.headers.get('access-control-allow-origin')).not.toBe('*')
    })

    it('returns 403 for a foreign web origin and never streams the file', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { origin: 'https://evil.com' })
      )

      expect(response.status).toBe(403)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    it('returns 403 for a crafted localhost.evil.com origin (exact hostname match only)', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { origin: 'http://localhost.evil.com' })
      )

      expect(response.status).toBe(403)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    it('falls back to the Referer check when no Origin header is present', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { referer: 'https://evil.com/page' }, { withOrigin: false })
      )

      expect(response.status).toBe(403)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    // The registered id is a capability: Chromium labels these custom-scheme
    // fetches cross-site and sometimes strips origin/referer entirely.
    it('accepts a valid-id navigation that Chromium labels cross-site', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(
          streamUrl,
          { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' },
          { withOrigin: false }
        )
      )

      expect(response.status).toBe(200)
    })

    it('accepts a valid-id range request with no Origin or Referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { 'sec-fetch-mode': 'cors' }, { withOrigin: false })
      )

      expect(response.status).toBe(200)
    })

    it('accepts a top-level navigation with no Origin or Referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(
          streamUrl,
          { 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate' },
          { withOrigin: false }
        )
      )

      expect(response.status).toBe(200)
    })

    it('accepts an opaque origin only with a local app referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, {
          origin: 'null',
          referer: TEST_APP_REFERER
        })
      )

      expect(response.status).toBe(200)
    })

    it('accepts an opaque origin from the local dev server referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, {
          origin: 'null',
          referer: 'http://localhost:5173/#/pdf'
        })
      )

      expect(response.status).toBe(200)
    })

    it('still rejects an opaque origin with a remote referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, {
          origin: 'null',
          referer: 'https://evil.com/app'
        })
      )

      expect(response.status).toBe(403)
    })

    it('accepts an opaque-origin app request that Chromium labels cross-site', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(
          streamUrl,
          { origin: 'null', 'sec-fetch-site': 'cross-site' },
          { withOrigin: false }
        )
      )

      expect(response.status).toBe(200)
    })

    it('accepts an opaque-origin app request when Chromium omits the referer', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(
          streamUrl,
          { origin: 'null', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' },
          { withOrigin: false }
        )
      )

      expect(response.status).toBe(200)
    })

    it('does not answer a conditional request before checking the origin', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', {
        size: 1000,
        mtimeMs: 1700000000000
      })

      const response = await getProtocolHandler()(
        makeRequest(
          streamUrl,
          { 'if-none-match': 'W/"1000-1700000000000"', origin: 'https://evil.com' },
          { withOrigin: false }
        )
      )

      // 304 would leak the cache state and ETag to a refused client.
      expect(response.status).toBe(403)
    })
  })

  describe('invalid range (416)', () => {
    it('returns 416 with bytes */N for out-of-bounds start', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=2000-3000' })
      )

      expect(response.status).toBe(416)
      expect(response.headers.get('content-range')).toBe('bytes */1000')
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    it('closes the file descriptor when the range is invalid', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })
      closeMock.mockClear()

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=2000-3000' })
      )

      expect(response.status).toBe(416)
      expect(createReadStreamMock).not.toHaveBeenCalled()
      // No stream was created, so the handler must close the descriptor it
      // opened; repeated invalid ranges must not leak descriptors.
      expect(closeMock).toHaveBeenCalledTimes(1)
    })

    it('leaves the descriptor to the stream on a valid range', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })
      closeMock.mockClear()

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=0-9' }))

      expect(response.status).toBe(206)
      expect(createReadStreamMock).toHaveBeenCalledTimes(1)
      expect(closeMock).not.toHaveBeenCalled()
    })

    it('returns 416 for reversed range (start > end)', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=500-100' })
      )

      expect(response.status).toBe(416)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })

    it('returns 416 for malformed range header', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf')

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'chunks=0-99' }))

      expect(response.status).toBe(416)
    })

    it('returns 206 for suffix-only range (bytes=-N) with the trailing N bytes', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=-100' }))

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 900-999/1000')
      expect(createReadStreamMock).toHaveBeenCalledWith(
        expect.stringMatching(/[\\/]test[\\/]file\.pdf$/),
        { start: 900, end: 999, highWaterMark: 1048576, fd: 42 }
      )
    })

    it('returns 206 with the whole file for oversized suffix range (RFC 7233)', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=-1001' }))

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 0-999/1000')
    })

    it('returns 416 (not a crash/500) for any range on an empty file', async () => {
      await loadAndRegister()
      // Both the registration stat and the streaming stat must report size 0.
      statMock.mockReset().mockResolvedValue({ size: 0, mtimeMs: 1700000000000 })
      const streamUrl = await registerTestPdf('/test/empty.pdf', { size: 0 })

      const suffixResponse = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=-5' })
      )
      expect(suffixResponse.status).toBe(416)
      expect(suffixResponse.headers.get('content-range')).toBe('bytes */0')
      expect(createReadStreamMock).not.toHaveBeenCalled()

      const openEndedResponse = await getProtocolHandler()(
        makeRequest(streamUrl, { range: 'bytes=0-' })
      )
      expect(openEndedResponse.status).toBe(416)
      expect(createReadStreamMock).not.toHaveBeenCalled()
    })
  })
})
