import { Readable } from 'stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants'

// ---- Module mocks (hoisted) ----
const protocolHandleMock = vi.fn()
const ipcHandleMock = vi.fn()
const showOpenDialogMock = vi.fn()
const getPathMock = vi.fn()
const setItemMock = vi.fn()
const readMock = vi.fn()
const existsSyncMock = vi.fn()
const statMock = vi.fn()
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
    getPath: getPathMock
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
    promises: { stat: statMock },
    createReadStream: createReadStreamMock
  }
}))

// ---- Helpers ----
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

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return {
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null
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
    getPathMock.mockReset().mockReturnValue('/app/userData')
    setItemMock.mockReset().mockResolvedValue(undefined)
    readMock.mockReset().mockResolvedValue({})
    existsSyncMock.mockReset().mockReturnValue(true)
    statMock.mockReset().mockResolvedValue({ size: 1000, mtimeMs: 1700000000000 })
    createReadStreamMock.mockReset().mockImplementation(() => makeFakeFileStream())
    requireTrustedIpcSenderMock.mockReset().mockReturnValue(true)
  })

  describe('authorization', () => {
    it('returns 403 for unknown pdfId', async () => {
      await loadAndRegister()

      const response = await getProtocolHandler()(makeRequest('local-pdf://unknown_id_xyz'))

      expect(response.status).toBe(403)
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

      const response = await getProtocolHandler()(makeRequest(streamUrl, { 'if-none-match': etag }))

      expect(response.status).toBe(304)
      expect(response.headers.get('etag')).toBe(etag)
      expect(createReadStreamMock).not.toHaveBeenCalled()
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
        '/test/file.pdf',
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
        '/test/file.pdf',
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

    it('returns 416 for suffix-only range (bytes=-N) since parser requires leading digits', async () => {
      await loadAndRegister()
      const streamUrl = await registerTestPdf('/test/file.pdf', { size: 1000 })

      const response = await getProtocolHandler()(makeRequest(streamUrl, { range: 'bytes=-100' }))

      // parseByteRange regex requires \d+ at start; suffix-only is not supported
      expect(response.status).toBe(416)
    })
  })
})
