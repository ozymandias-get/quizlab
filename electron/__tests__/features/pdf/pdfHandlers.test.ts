import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONFIG } from '../../../app/constants'

const ipcOn = vi.fn()
const fromWebContents = vi.fn()
const popup = vi.fn()
const append = vi.fn()
const sentMessages: Array<[string, unknown]> = []

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

describe('pdfHandlers', () => {
  beforeEach(() => {
    ipcOn.mockReset()
    fromWebContents.mockReset()
    popup.mockReset()
    append.mockReset()
    sentMessages.length = 0
  })

  it('registers menu handler and forwards screenshot action to renderer', async () => {
    const webContents = {
      send: (channel: string, payload: unknown) => sentMessages.push([channel, payload])
    }
    const win = { isDestroyed: () => false, webContents }
    fromWebContents.mockReturnValue(win)

    const { registerPdfHandlers } = await import('../../../features/pdf/pdfHandlers.js')
    registerPdfHandlers()

    const eventHandler = ipcOn.mock.calls.find(
      ([channel]) => channel === APP_CONFIG.IPC_CHANNELS.SHOW_PDF_CONTEXT_MENU
    )?.[1]
    expect(eventHandler).toBeTypeOf('function')

    eventHandler?.({ sender: {} }, {})
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
})
