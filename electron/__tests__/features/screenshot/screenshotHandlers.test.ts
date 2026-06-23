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

    expect(await captureHandler?.({ sender: {} })).toEqual({ ok: false, error: { code: 'unauthorized', message: 'Not authorized' } })
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({ ok: true, data: false })
  })

  it('copies image when data URL is valid and image is non-empty', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')

    expect(result).toEqual({ ok: true, data: true })
    expect(writeImage).toHaveBeenCalledTimes(1)
  })

  it('rejects copy with non-image data URL prefix', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    await expect(copyHandler?.({ sender: {} }, 'data:text/html;base64,abc')).resolves.toEqual({ ok: true, data: false })
    await expect(copyHandler?.({ sender: {} }, 'data:audio/mp3;base64,abc')).resolves.toEqual({ ok: true, data: false })
    await expect(copyHandler?.({ sender: {} }, 'javascript:alert(1)')).resolves.toEqual({ ok: true, data: false })
    expect(createFromDataURL).not.toHaveBeenCalled()
    expect(writeImage).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('rejects copy when image parses to an empty native image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => true })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({ ok: true, data: false })
    expect(writeImage).not.toHaveBeenCalled()
  })

  it('rejects copy when data URL exceeds the size limit', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const oversized = 'data:image/png;base64,' + 'A'.repeat(50 * 1024 * 1024)
    await expect(copyHandler?.({ sender: {} }, oversized)).resolves.toEqual({ ok: true, data: false })
    expect(createFromDataURL).not.toHaveBeenCalled()
    expect(writeImage).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('captures the whole page when sender is trusted and window exists', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,page' })
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const result = await captureHandler?.({ sender: {} })

    expect(result).toEqual({ ok: true, data: 'data:image/png;base64,page' })
    expect(capturePage).toHaveBeenCalledWith(undefined)
  })

  it('returns null when window is missing or destroyed', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    fromWebContents.mockReturnValue(null)
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    expect(await captureHandler?.({ sender: {} })).toEqual({ ok: false, error: { code: 'internal_error', message: 'Window not available' } })
  })

  it('returns null and rejects oversized rect dimensions', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi.fn()
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    expect(
      await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 99999, height: 100 })
    ).toEqual({ ok: false, error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' } })
    expect(
      await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 100, height: 99999 })
    ).toEqual({ ok: false, error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' } })
    expect(await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 0, height: 100 })).toEqual({ ok: false, error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' } })
    expect(await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 100, height: 0 })).toEqual({ ok: false, error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' } })
    expect(
      await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: -1, height: 100 })
    ).toEqual({ ok: false, error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' } })
    expect(capturePage).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('captures a valid rect', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi
      .fn()
      .mockResolvedValue({ toDataURL: () => 'data:image/png;base64,region' })
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const rect = { x: 0, y: 0, width: 800, height: 600 }
    const result = await captureHandler?.({ sender: {} }, rect)

    expect(result).toEqual({ ok: true, data: 'data:image/png;base64,region' })
    expect(capturePage).toHaveBeenCalledWith(rect)
  })
})
