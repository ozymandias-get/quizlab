import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
}))

const mockElectronApi = vi.hoisted(() => ({
  platform: 'linux' as string
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: mockLogger
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => mockElectronApi,
  hasElectronApi: () => true
}))

// Import after mocks
const { safeWebviewPaste } = await import('@shared/lib/webviewUtils')

describe('safeWebviewPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronApi.platform = 'linux'
  })

  it('returns false for null webview', () => {
    expect(safeWebviewPaste(null)).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Webview is undefined'))
  })

  it('uses webview.paste() when available', () => {
    const webview = { paste: vi.fn() }
    const result = safeWebviewPaste(webview as any)
    expect(result).toBe(true)
    expect(webview.paste).toHaveBeenCalled()
  })

  it('returns false when webview.paste() throws', () => {
    const webview = {
      paste: vi.fn(() => {
        throw new Error('paste failed')
      })
    }
    const result = safeWebviewPaste(webview as any)
    expect(result).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Native paste failed'),
      expect.any(Error)
    )
  })

  it('falls back to sendInputEvent when paste is not available', () => {
    const webview = { sendInputEvent: vi.fn() }
    const result = safeWebviewPaste(webview as any)
    expect(result).toBe(true)
    expect(webview.sendInputEvent).toHaveBeenCalledTimes(3)
  })

  it('sends keyDown, char, and keyUp events', () => {
    const webview = { sendInputEvent: vi.fn() }
    safeWebviewPaste(webview as any)

    expect(webview.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown' })
    )
    expect(webview.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'char' }))
    expect(webview.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'keyUp' }))
  })

  it('uses meta modifier on macOS', () => {
    mockElectronApi.platform = 'darwin'
    const webview = { sendInputEvent: vi.fn() }
    safeWebviewPaste(webview as any)

    expect(webview.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ modifiers: ['meta'] })
    )
  })

  it('uses control modifier on non-macOS', () => {
    mockElectronApi.platform = 'linux'
    const webview = { sendInputEvent: vi.fn() }
    safeWebviewPaste(webview as any)

    expect(webview.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ modifiers: ['control'] })
    )
  })

  it('returns false when both paste and sendInputEvent are missing', () => {
    const webview = {}
    const result = safeWebviewPaste(webview as any)
    expect(result).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('sendInputEvent API missing')
    )
  })

  it('returns false when sendInputEvent throws', () => {
    const webview = {
      sendInputEvent: vi.fn(() => {
        throw new Error('input failed')
      })
    }
    const result = safeWebviewPaste(webview as any)
    expect(result).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Input simulation failed'),
      expect.any(Error)
    )
  })
})
