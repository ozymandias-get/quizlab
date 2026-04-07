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
  })

  it('blocks getPdfStreamUrl when file path is not allowlisted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { registerPdfProtocolHandlers } = await import('../../../features/pdf/pdfProtocol.js')
    registerPdfProtocolHandlers()

    const handler = getHandler(APP_CONFIG.IPC_CHANNELS.GET_PDF_STREAM_URL)
    const result = await handler?.({}, '/outside/secret.pdf')

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
    const result = await handler?.({}, {})

    expect(setItem).toHaveBeenCalledWith(path.normalize('/outside/document.pdf'), true)
    expect(result?.path).toBe('/outside/document.pdf')
    expect(result?.streamUrl).toContain('local-pdf://')
  })
})
