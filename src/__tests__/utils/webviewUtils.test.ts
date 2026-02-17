import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeWebviewPaste } from '@src/utils/webviewUtils'
import { Logger } from '@src/utils/logger'

// Mock Logger to avoid clutter
vi.mock('@src/utils/logger', () => ({
    Logger: {
        error: vi.fn(),
        warn: vi.fn(),
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
        } as any

        expect(safeWebviewPaste(mockWebview)).toBe(true)
        expect(mockWebview.paste).toHaveBeenCalled()
    })

    it('returns false if native paste throws', () => {
        const mockWebview = {
            paste: vi.fn().mockImplementation(() => { throw new Error('Paste error') })
        } as any

        expect(safeWebviewPaste(mockWebview)).toBe(false)
        expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Native paste failed'), expect.any(Error))
    })

    it('falls back to input simulation if paste() is missing but sendInputEvent exists', () => {
        const mockWebview = {
            // No paste method
            sendInputEvent: vi.fn()
        } as any

        // Assume platform is windows by default/mock
        // The implementation checks: window.electronAPI?.platform or defaults?
        // Let's see implementation: const modifier = (window.electronAPI?.platform === 'darwin') ? 'meta' : 'control';
        // We can mock window.electronAPI

        Object.defineProperty(window, 'electronAPI', {
            value: { platform: 'win32' },
            writable: true
        })

        expect(safeWebviewPaste(mockWebview)).toBe(true)

        // Should send Ctrl+V (3 events: keyDown, char, keyUp)
        expect(mockWebview.sendInputEvent).toHaveBeenCalledTimes(3)
        expect(mockWebview.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'keyDown',
            keyCode: 'v',
            modifiers: ['control']
        }))
    })

    it('handles macos modifier key', () => {
        const mockWebview = {
            sendInputEvent: vi.fn()
        } as any

        Object.defineProperty(window, 'electronAPI', {
            value: { platform: 'darwin' },
            writable: true
        })

        safeWebviewPaste(mockWebview)

        expect(mockWebview.sendInputEvent).toHaveBeenCalledWith(expect.objectContaining({
            modifiers: ['meta']
        }))
    })

    it('returns false if sendInputEvent is also missing', () => {
        const mockWebview = {} as any // No methods
        expect(safeWebviewPaste(mockWebview)).toBe(false)
        expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('sendInputEvent API missing'))
    })
})
