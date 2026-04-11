import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
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
      stat
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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const result = await handler?.({ sender: {} }, '/outside/secret.pdf')

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
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
    expect(result?.path).toBe('/outside/document.pdf')
    expect(result?.streamUrl).toContain('local-pdf://')
  })

  it('returns null for untrusted IPC senders', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const selectHandler = getHandler(APP_CONFIG.IPC_CHANNELS.SELECT_PDF)
    const getUrlHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const registerHandler = getHandler(APP_CONFIG.IPC_CHANNELS.PDF_REGISTER_PATH)

    expect(await selectHandler?.({ sender: {} }, {})).toBeNull()
    expect(await getUrlHandler?.({ sender: {} }, '/x/y.pdf')).toBeNull()
    expect(await registerHandler?.({ sender: {} }, '/x/y.pdf')).toBeNull()
  })

  it('register path grants session-only access without persisting allowlist', async () => {
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const registerHandler = getHandler(APP_CONFIG.IPC_CHANNELS.PDF_REGISTER_PATH)
    const result = await registerHandler?.({ sender: {} }, '/outside/dropped.pdf')

    expect(setItem).not.toHaveBeenCalled()
    expect(result?.path).toBe(path.normalize('/outside/dropped.pdf'))
    expect(result?.streamUrl).toContain('local-pdf://')

    const getUrlHandler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const stream = await getUrlHandler?.({ sender: {} }, path.normalize('/outside/dropped.pdf'))
    expect(stream?.streamUrl).toContain('local-pdf://')
  })
})
