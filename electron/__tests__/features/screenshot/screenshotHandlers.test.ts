import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../../app/constants'

const ipcHandle = vi.fn()
const fromWebContents = vi.fn()
const writeImage = vi.fn()
const createFromDataURL = vi.fn()
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  BrowserWindow: { fromWebContents },
  clipboard: { writeImage },
  nativeImage: { createFromDataURL }
}))

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('screenshotHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    fromWebContents.mockReset()
    writeImage.mockReset()
    createFromDataURL.mockReset()
    requireTrustedIpcSender.mockReset()
  })

  it('returns null/false for untrusted senders', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)

    expect(await captureHandler?.({ sender: {} })).toBeNull()
    expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).toBe(false)
  })

  it('copies image when data URL is valid and image is non-empty', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')

    expect(result).toBe(true)
    expect(writeImage).toHaveBeenCalledTimes(1)
  })
})
