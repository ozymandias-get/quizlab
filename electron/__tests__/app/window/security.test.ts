import path from 'path'
import { pathToFileURL } from 'url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const shellOpenExternal = vi.fn()
const appState = { isPackaged: false }

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return appState.isPackaged
    },
    getAppPath: vi.fn(() => path.resolve('/mock-app')),
    on: vi.fn()
  },
  shell: {
    openExternal: shellOpenExternal
  }
}))

describe('window/security', () => {
  beforeEach(() => {
    vi.resetModules()
    shellOpenExternal.mockReset()
    appState.isPackaged = false
  })

  it('keeps production file navigation inside the dist directory', async () => {
    appState.isPackaged = true
    const module = await import('../../../app/window/security.js')

    const appRoot = path.resolve('/mock-app')
    const fileUrl = (relativePath: string) => pathToFileURL(path.join(appRoot, relativePath)).href

    expect(module.isAllowedMainFrameUrl(fileUrl('dist/index.html'))).toBe(true)
    expect(module.isAllowedMainFrameUrl(fileUrl('dist/assets/app.js'))).toBe(true)
    expect(module.isAllowedMainFrameUrl(fileUrl('dist-evil/index.html'))).toBe(false)
    expect(module.isAllowedMainFrameUrl(fileUrl('dist/../secret.html'))).toBe(false)
  })

  it('accepts only safe external urls', async () => {
    const module = await import('../../../app/window/security.js')

    expect(module.isSafeExternalUrl('https://example.com')).toBe(true)
    expect(module.isSafeExternalUrl('http://localhost:5173')).toBe(true)
    expect(module.isSafeExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('refuses external urls that resolve to a local service', async () => {
    const module = await import('../../../app/window/security.js')

    expect(module.isSafeExternalUrl('https://127.0.0.1/admin')).toBe(false)
    expect(module.isSafeExternalUrl('https://localhost/admin')).toBe(false)
    expect(module.isSafeExternalUrl('https://intranet/admin')).toBe(false)
    expect(module.isSafeExternalUrl('https://user:pass@example.com')).toBe(false)
  })

  it('opens external navigation and denies popup creation', async () => {
    const module = await import('../../../app/window/security.js')
    const setWindowOpenHandler = vi.fn()
    const listeners = new Map<
      string,
      (event: { preventDefault: () => void }, url: string) => void
    >()

    module.hardenWindowWebContents({
      webContents: {
        setWindowOpenHandler,
        on: (
          event: string,
          handler: (event: { preventDefault: () => void }, url: string) => void
        ) => listeners.set(event, handler)
      }
    } as never)

    const handler = setWindowOpenHandler.mock.calls[0][0]
    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' })

    const preventDefault = vi.fn()
    listeners.get('will-navigate')?.({ preventDefault }, 'https://example.com/docs')
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/docs')
  })

  it('rejects certificate errors on the app window', async () => {
    const module = await import('../../../app/window/security.js')
    const listeners = new Map<string, (...args: unknown[]) => void>()

    module.hardenWindowWebContents({
      webContents: {
        setWindowOpenHandler: vi.fn(),
        on: (event: string, handler: (...args: unknown[]) => void) => listeners.set(event, handler)
      }
    } as never)

    const preventDefault = vi.fn()
    const callback = vi.fn()
    listeners.get('certificate-error')?.(
      { preventDefault },
      'https://x.test',
      'ERR_CERT',
      {},
      callback
    )
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(false)
  })

  it('no longer installs any webview gate, since webviewTag is disabled', async () => {
    const module = await import('../../../app/window/security.js')
    expect(Object.keys(module)).not.toContain('setupWebviewSecurity')
    expect(Object.keys(module)).not.toContain('WEBVIEW_CLIPBOARD_PROTECTION_SCRIPT')
  })
})
