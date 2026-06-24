import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcOn = vi.fn()
const fromWebContents = vi.fn()
const popup = vi.fn()
const append = vi.fn()
const sentMessages: Array<[string, unknown]> = []
const getMainWindow = vi.fn()

class MockMenu {
  append = append
  popup = popup
}

class MockMenuItem {
  label?: string
  click?: () => void
  constructor(options: { label?: string; click?: () => void }) {
    this.label = options.label
    this.click = options.click
  }
}

vi.mock('electron', () => ({
  ipcMain: { on: ipcOn },
  BrowserWindow: { fromWebContents },
  Menu: MockMenu,
  MenuItem: MockMenuItem
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow
}))

describe('pdfHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcOn.mockReset()
    fromWebContents.mockReset()
    popup.mockReset()
    append.mockReset()
    getMainWindow.mockReset()
    sentMessages.length = 0
  })

  it('registers menu handler and forwards screenshot action to renderer', async () => {
    const webContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const win = { isDestroyed: () => false, webContents }
    fromWebContents.mockReturnValue(win)
    getMainWindow.mockReturnValue({ webContents })

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]
    expect(eventHandler).toBeTypeOf('function')

    eventHandler?.({ sender: webContents }, {})
    const items = append.mock.calls.map(([item]) => item) as Array<{
      click?: () => void
      label?: string
    }>
    const fullPageItem = items.find((item) => item.label === 'Full Page Screenshot')
    expect(fullPageItem?.click).toBeTypeOf('function')

    fullPageItem?.click?.()
    expect(sentMessages).toContainEqual([
      APP_CONFIG.IPC_CHANNELS.TRIGGER_SCREENSHOT,
      APP_CONFIG.SCREENSHOT_TYPES.FULL
    ])
    expect(popup).toHaveBeenCalledTimes(1)
  })

  it('forwards area screenshot, zoom in/out/reset, and reload via context menu', async () => {
    const webContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const win = { isDestroyed: () => false, webContents }
    fromWebContents.mockReturnValue(win)
    getMainWindow.mockReturnValue({ webContents })

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]
    eventHandler?.({ sender: webContents }, {})

    const items = append.mock.calls.map(([item]) => item) as Array<{
      click?: () => void
      label?: string
    }>
    const findItem = (label: string) => items.find((item) => item.label === label)

    findItem('Crop Screenshot')?.click?.()
    findItem('Zoom In')?.click?.()
    findItem('Zoom Out')?.click?.()
    findItem('Reset Zoom')?.click?.()

    expect(sentMessages).toContainEqual([
      APP_CONFIG.IPC_CHANNELS.TRIGGER_SCREENSHOT,
      APP_CONFIG.SCREENSHOT_TYPES.CROP
    ])
    expect(sentMessages).toContainEqual([APP_CONFIG.IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'in'])
    expect(sentMessages).toContainEqual([APP_CONFIG.IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'out'])
    expect(sentMessages).toContainEqual([APP_CONFIG.IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, 'reset'])
    // Reload item uses the framework's "role" instead of a click handler
    expect(findItem('Reload')?.click).toBeUndefined()
  })

  it('uses localized labels when provided', async () => {
    const webContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const win = { isDestroyed: () => false, webContents }
    fromWebContents.mockReturnValue(win)
    getMainWindow.mockReturnValue({ webContents })

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]
    const labels = {
      full_page_screenshot: 'Tam Sayfa Ekran Görüntüsü',
      crop_screenshot: 'Alan Seç',
      zoom_in: 'Yakınlaştır',
      zoom_out: 'Uzaklaştır',
      reset_zoom: 'Sıfırla',
      reload: 'Yeniden Yükle'
    }
    eventHandler?.({ sender: webContents }, labels)

    const items = append.mock.calls.map(([item]) => item) as Array<{ label?: string }>
    expect(items.map((i) => i.label)).toEqual(
      expect.arrayContaining([
        'Tam Sayfa Ekran Görüntüsü',
        'Alan Seç',
        'Yakınlaştır',
        'Uzaklaştır',
        'Sıfırla',
        'Yeniden Yükle'
      ])
    )
  })

  it('rejects menu opening from a foreign webContents (sender spoofing)', async () => {
    const trustedWebContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const foreignWebContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const win = { isDestroyed: () => false, webContents: trustedWebContents }
    fromWebContents.mockReturnValue(win)
    getMainWindow.mockReturnValue({ webContents: trustedWebContents })

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]
    eventHandler?.({ sender: foreignWebContents }, {})

    expect(append).not.toHaveBeenCalled()
    expect(popup).not.toHaveBeenCalled()
  })

  it('skips menu when BrowserWindow is missing or destroyed', async () => {
    const webContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    getMainWindow.mockReturnValue({ webContents })

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]

    fromWebContents.mockReturnValue(null)
    eventHandler?.({ sender: webContents }, {})
    expect(append).not.toHaveBeenCalled()

    fromWebContents.mockReturnValue({ isDestroyed: () => true, webContents })
    eventHandler?.({ sender: webContents }, {})
    expect(append).not.toHaveBeenCalled()
  })
})
