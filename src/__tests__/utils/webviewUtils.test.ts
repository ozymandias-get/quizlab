import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeWebviewPaste } from '@shared/lib/webviewUtils'
import type { WebviewController } from '@shared-core/types/webview'
import { Logger } from '@shared/lib/logger'

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('webviewUtils - safeWebviewPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false if webview is undefined', () => {
    expect(safeWebviewPaste(null)).toBe(false)
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Webview is undefined'))
  })

  it('uses native paste() if available', () => {
    const mockWebview = {
      paste: vi.fn()
    } as unknown as WebviewController

    expect(safeWebviewPaste(mockWebview)).toBe(true)
    expect(mockWebview.paste).toHaveBeenCalled()
  })

  it('returns false if native paste throws', () => {
    const mockWebview = {
      paste: vi.fn().mockImplementation(() => {
        throw new Error('Paste error')
      })
    } as unknown as WebviewController

    expect(safeWebviewPaste(mockWebview)).toBe(false)
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Native paste failed'),
      expect.any(Error)
    )
  })

  it('falls back to input simulation if paste() is missing but sendInputEvent exists', () => {
    const mockWebview = {
      sendInputEvent: vi.fn()
    } as unknown as WebviewController

    Object.defineProperty(window, 'electronAPI', {
      value: { platform: 'win32' },
      writable: true
    })

    expect(safeWebviewPaste(mockWebview)).toBe(true)

    expect(mockWebview.sendInputEvent).toHaveBeenCalledTimes(3)
    expect(mockWebview.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'keyDown',
        keyCode: 'v',
        modifiers: ['control']
      })
    )
  })

  it('handles macos modifier key', () => {
    const mockWebview = {
      sendInputEvent: vi.fn()
    } as unknown as WebviewController

    Object.defineProperty(window, 'electronAPI', {
      value: { platform: 'darwin' },
      writable: true
    })

    safeWebviewPaste(mockWebview)

    expect(mockWebview.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        modifiers: ['meta']
      })
    )
  })

  it('returns false if sendInputEvent is also missing', () => {
    const mockWebview = {} as unknown as WebviewController
    expect(safeWebviewPaste(mockWebview)).toBe(false)
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('sendInputEvent API missing'))
  })
})
