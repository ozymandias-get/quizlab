import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants'

const ipcHandle = vi.fn()
const showOpenDialog = vi.fn()
const getPath = vi.fn()
const setItem = vi.fn()
const read = vi.fn()
const existsSync = vi.fn()
const stat = vi.fn()
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn()
  },
  ipcMain: {
    handle: ipcHandle
  },
  dialog: {
    showOpenDialog
  },
  app: {
    getPath
  }
}))

vi.mock('../../../core/ConfigManager', () => {
  class MockConfigManager {
    setItem = setItem
    read = read
  }
  return {
    ConfigManager: MockConfigManager
  }
})

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

vi.mock('fs', () => ({
  default: {
    existsSync,
    promises: {
      stat,
      access: vi.fn()
    },
    createReadStream: vi.fn()
  }
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('pdfProtocol handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    showOpenDialog.mockReset()
    getPath.mockReset().mockReturnValue('/app/userData')
    setItem.mockReset().mockResolvedValue(undefined)
    read.mockReset().mockResolvedValue({})
    existsSync.mockReset().mockReturnValue(true)
    stat.mockReset().mockResolvedValue({ size: 512 })
    requireTrustedIpcSender.mockReset().mockReturnValue(true)
  })

  it('blocks getPdfStreamUrl when file path is not allowlisted', async () => {
    // Dynamic import of the shim AFTER vi.resetModules() so we share the same
    // log-buffer instance as the handler we'll register below. A static import
    // at the top of the file would capture the pre-reset instance and miss
    // any entries the handler writes.
    const { getRecentElectronLogs } = await import('../../../core/logger.js')
    const lengthBefore = getRecentElectronLogs().length
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const result = await handler?.({ sender: {} }, '/outside/secret.pdf')

    expect(result).toEqual({ ok: false, error: { code: 'unauthorized', message: 'Pdf not in allowlist' } })
    // Security warning is routed through the shared Logger (dev only console
    // output, always buffered). Verify the buffer grew with the warning.
    const logs = getRecentElectronLogs()
    const last = logs[logs.length - 1]
    expect(logs.length).toBe(lengthBefore + 1)
    expect(last?.message).toContain('Unauthoriz')
    expect(last?.message).toContain(path.join('outside', 'secret.pdf'))
  })

  it('allowlists selected PDF and returns stream URL payload', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/outside/document.pdf']
    })
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.SELECT_PDF)
    const result = await handler?.({ sender: {} }, {})

    expect(setItem).toHaveBeenCalledWith(path.normalize('/outside/document.pdf'), true)
    expect(result?.data.path).toBe('/outside/document.pdf')
    expect(result?.data.streamUrl).toContain('local-pdf://')
  })

  it('returns null for untrusted IPC senders', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const selectHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SELECT_PDF)
    const getUrlHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const registerHandler = getHandler(APP_CONFIG.IPC_CHANNELS.PDF_REGISTER_PATH)

    expect(await selectHandler?.({ sender: {} }, {})).toEqual({ ok: false, error: { code: 'unauthorized', message: 'Not authorized' } })
    expect(await getUrlHandler?.({ sender: {} }, '/x/y.pdf')).toEqual({ ok: false, error: { code: 'unauthorized', message: 'Not authorized' } })
    expect(await registerHandler?.({ sender: {} }, '/x/y.pdf')).toEqual({ ok: false, error: { code: 'unauthorized', message: 'Not authorized' } })
  })

  it('register path grants session-only access and persists allowlist', async () => {
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const registerHandler = getHandler(APP_CONFIG.IPC_CHANNELS.PDF_REGISTER_PATH)
    const result = await registerHandler?.({ sender: {} }, '/outside/dropped.pdf')

    // SECURITY: Register now persists to allowlist (same as SELECT_PDF) to prevent
    // unregistered files from being served via GET_PDF_STREAM_URL.
    expect(setItem).toHaveBeenCalledWith(path.normalize('/outside/dropped.pdf'), true)
    expect(result?.data.path).toBe(path.normalize('/outside/dropped.pdf'))
    expect(result?.data.streamUrl).toContain('local-pdf://')

    const getUrlHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const stream = await getUrlHandler?.({ sender: {} }, path.normalize('/outside/dropped.pdf'))
    expect(stream?.data.streamUrl).toContain('local-pdf://')
  })
})
