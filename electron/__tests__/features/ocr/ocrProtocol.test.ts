import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Module mocks (hoisted) ----
const protocolHandleMock = vi.fn()
const registerSchemesAsPrivilegedMock = vi.fn()
const getAppPathMock = vi.fn()
const existsSyncMock = vi.fn()
const readFileSyncMock = vi.fn()

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: registerSchemesAsPrivilegedMock,
    handle: protocolHandleMock
  },
  app: {
    getAppPath: getAppPathMock
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
    promises: {}
  }
}))

// ---- Helpers ----
type ProtocolHandler = (request: { url: string; headers: Headers }) => Promise<Response>

function getProtocolHandler(): ProtocolHandler {
  const call = protocolHandleMock.mock.calls.find(([scheme]) => scheme === 'local-ocr')
  if (!call) throw new Error('Protocol handler not registered')
  return call[1] as ProtocolHandler
}

function makeRequest(url: string) {
  return {
    url,
    headers: { get: () => null }
  } as unknown as { url: string; headers: Headers }
}

async function loadModule() {
  return import('../../../features/ocr/ocrProtocol.js')
}

describe('local-ocr:// protocol', () => {
  beforeEach(() => {
    vi.resetModules()
    protocolHandleMock.mockReset()
    registerSchemesAsPrivilegedMock.mockReset()
    getAppPathMock.mockReset().mockReturnValue('/app/mock')
    existsSyncMock.mockReset().mockReturnValue(true)
    readFileSyncMock.mockReset().mockReturnValue(Buffer.from('fake-gzip-bytes'))
  })

  it('registers the scheme as a privileged fetch-capable scheme', async () => {
    const mod = await loadModule()
    mod.registerOcrScheme()

    expect(registerSchemesAsPrivilegedMock).toHaveBeenCalledWith([
      expect.objectContaining({
        scheme: 'local-ocr',
        privileges: expect.objectContaining({
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true
        })
      })
    ])
  })

  it('serves allowlisted language data with cache headers', async () => {
    const mod = await loadModule()
    mod.registerOcrProtocol()

    const response = await getProtocolHandler()(
      makeRequest('local-ocr://tessdata/eng.traineddata.gz')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/gzip')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(readFileSyncMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`tessdata\\${path.sep}eng\\.traineddata\\.gz$`))
    )
    expect(mod.OCR_TESSDATA_ALLOWLIST.has('eng.traineddata.gz')).toBe(true)
    expect(mod.OCR_TESSDATA_ALLOWLIST.has('tur.traineddata.gz')).toBe(true)
  })

  it('returns 403 for non-allowlisted files (no open file reader)', async () => {
    const mod = await loadModule()
    mod.registerOcrProtocol()

    const response = await getProtocolHandler()(
      makeRequest('local-ocr://tessdata/evil.traineddata.gz')
    )

    expect(response.status).toBe(403)
    expect(readFileSyncMock).not.toHaveBeenCalled()
  })

  it('returns 403 for path traversal attempts', async () => {
    const mod = await loadModule()
    mod.registerOcrProtocol()

    const response = await getProtocolHandler()(makeRequest('local-ocr://tessdata/../secret.txt'))

    expect(response.status).toBe(403)
    expect(readFileSyncMock).not.toHaveBeenCalled()
  })

  it('returns 403 for unknown hosts', async () => {
    const mod = await loadModule()
    mod.registerOcrProtocol()

    const response = await getProtocolHandler()(makeRequest('local-ocr://other/file.gz'))

    expect(response.status).toBe(403)
    expect(readFileSyncMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the bundled file is missing on disk', async () => {
    const mod = await loadModule()
    mod.registerOcrProtocol()
    readFileSyncMock.mockImplementationOnce(() => {
      throw new Error('ENOENT')
    })

    const response = await getProtocolHandler()(
      makeRequest('local-ocr://tessdata/tur.traineddata.gz')
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 when no tessdata directory exists', async () => {
    existsSyncMock.mockReturnValue(false)
    const mod = await loadModule()
    mod.registerOcrProtocol()

    const response = await getProtocolHandler()(
      makeRequest('local-ocr://tessdata/eng.traineddata.gz')
    )

    expect(response.status).toBe(404)
    expect(readFileSyncMock).not.toHaveBeenCalled()
  })
})
