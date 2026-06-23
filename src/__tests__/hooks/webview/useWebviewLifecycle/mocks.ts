import { vi } from 'vitest'

export const mockT = vi.fn((key) => key)
export const mockShowWarning = vi.fn()
export const mockRegisterWebview = vi.fn()

export const createMockWebview = () => {
  const listeners: Record<string, Function> = {}
  return {
    addEventListener: vi.fn((event, handler) => {
      listeners[event] = handler
    }),
    removeEventListener: vi.fn((event) => {
      delete listeners[event]
    }),
    reload: vi.fn(),
    executeJavaScript: vi.fn(),
    insertCSS: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn(() => 'https://example.com'),
    src: '',
    nodeName: 'WEBVIEW',
    _trigger: (event: string, ...args: any[]) => {
      if (listeners[event]) {
        listeners[event](...args)
      }
    }
  }
}
