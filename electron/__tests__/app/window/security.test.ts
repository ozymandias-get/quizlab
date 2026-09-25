import path from 'path'
import { pathToFileURL } from 'url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const shellOpenExternal = vi.fn()
const appOn = vi.fn()
const appState = { isPackaged: false }
const geminiSession = {}

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return appState.isPackaged
    },
    getAppPath: vi.fn(() => path.resolve('/mock-app')),
    on: appOn
  },
  session: {
    fromPartition: vi.fn((partition: string) =>
      partition === 'persist:gemini_web_profile' ? geminiSession : {}
    )
  },
  shell: {
    openExternal: shellOpenExternal
  }
}))

describe('window/security', () => {
  beforeEach(() => {
    vi.resetModules()
    shellOpenExternal.mockReset()
    appOn.mockReset()
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

  it('blocks a webview without an explicit allowed partition', async () => {
    const module = await import('../../../app/window/security.js')
    const listeners = new Map<string, (event: unknown, ...args: unknown[]) => void>()
    module.hardenWindowWebContents({
      webContents: {
        setWindowOpenHandler: vi.fn(),
        on: (event: string, handler: (event: unknown, ...args: unknown[]) => void) =>
          listeners.set(event, handler)
      }
    } as never)

    const preventDefault = vi.fn()
    listeners.get('will-attach-webview')?.(
      { preventDefault },
      { partition: undefined },
      { src: 'https://example.com' }
    )

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('hardens webview guests from the webContents type and session identity', async () => {
    const module = await import('../../../app/window/security.js')
    module.setupWebviewSecurity()

    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => void>()
    const setWindowOpenHandler = vi.fn()
    const executeJavaScript = vi.fn().mockResolvedValue(undefined)
    const guest = {
      getType: vi.fn(() => 'webview'),
      session: geminiSession,
      isDestroyed: vi.fn(() => false),
      setWindowOpenHandler,
      on: (event: string, handler: (event: unknown, ...args: unknown[]) => void) =>
        handlers.set(event, handler),
      executeJavaScript
    }

    const onWebContentsCreated = appOn.mock.calls[0]?.[1] as (
      event: unknown,
      contents: typeof guest
    ) => void
    onWebContentsCreated({}, guest)

    expect(setWindowOpenHandler).toHaveBeenCalledTimes(1)
    expect(handlers.get('will-navigate')).toBeDefined()
    handlers.get('did-finish-load')?.({})
    expect(executeJavaScript).toHaveBeenCalledTimes(1)
  })
})
