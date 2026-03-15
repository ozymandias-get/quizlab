import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const shellOpenExternal = vi.fn()
const browserWindowCtor = vi.fn()

type EventHandler = (...args: unknown[]) => void

class MockEventEmitter {
  private listeners = new Map<string, EventHandler[]>()
  private onceListeners = new Map<string, EventHandler[]>()

  on = vi.fn((event: string, handler: EventHandler) => {
    const handlers = this.listeners.get(event) ?? []
    handlers.push(handler)
    this.listeners.set(event, handlers)
    return this
  })

  once = vi.fn((event: string, handler: EventHandler) => {
    const handlers = this.onceListeners.get(event) ?? []
    handlers.push(handler)
    this.onceListeners.set(event, handlers)
    return this
  })

  emit(event: string, ...args: unknown[]) {
    const handlers = this.listeners.get(event) ?? []
    handlers.forEach((handler) => handler(...args))

    const onceHandlers = this.onceListeners.get(event) ?? []
    this.onceListeners.delete(event)
    onceHandlers.forEach((handler) => handler(...args))
  }
}

class MockWebContents extends MockEventEmitter {
  setWindowOpenHandler = vi.fn()
  isLoadingMainFrame = vi.fn(() => false)
  openDevTools = vi.fn()
}

class MockBrowserWindow extends MockEventEmitter {
  webContents = new MockWebContents()
  visible = false
  destroyed = false
  loadFile = vi.fn().mockResolvedValue(undefined)
  loadURL = vi.fn().mockResolvedValue(undefined)
  maximize = vi.fn()
  setMenu = vi.fn()
  setSkipTaskbar = vi.fn()
  show = vi.fn(() => {
    this.visible = true
  })
  destroy = vi.fn(() => {
    this.destroyed = true
    this.emit('closed')
  })
  isDestroyed = vi.fn(() => this.destroyed)
  isVisible = vi.fn(() => this.visible)
  isMaximized = vi.fn(() => false)
  getBounds = vi.fn(() => ({ width: 1280, height: 800, x: 100, y: 100 }))
  getNormalBounds = vi.fn(() => ({ width: 1280, height: 800, x: 100, y: 100 }))
}

vi.mock('electron', () => ({
  BrowserWindow: browserWindowCtor,
  dialog: {
    showErrorBox: vi.fn()
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn()
    },
    fromPartition: vi.fn(() => ({
      webRequest: {
        onBeforeSendHeaders: vi.fn()
      },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn()
    }))
  },
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock-user-data'),
    getAppPath: vi.fn(() => '/mock-app')
  },
  screen: {
    getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })),
    getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } }))
  },
  shell: {
    openExternal: shellOpenExternal
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true)
  }
}))

vi.mock('../../features/ai/aiManager', () => ({
  AI_REGISTRY: {},
  INACTIVE_PLATFORMS: {}
}))

vi.mock('../../core/ConfigManager', () => ({
  ConfigManager: vi.fn().mockImplementation(function () {
    return {
      read: vi.fn().mockResolvedValue({}),
      write: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

describe('windowManager navigation hardening', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    shellOpenExternal.mockReset()
    browserWindowCtor.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    Object.defineProperty(process, 'resourcesPath', {
      value: '/mock-resources',
      configurable: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(process, 'resourcesPath')
  })

  it('allows only dev-server origin for main-frame navigation in dev', async () => {
    const module = await import('../../app/windowManager.js')

    expect(module.isAllowedMainFrameUrl('http://localhost:5173/dashboard')).toBe(true)
    expect(module.isAllowedMainFrameUrl('https://example.com')).toBe(false)
    expect(module.isAllowedMainFrameUrl('http://localhost:4173')).toBe(false)
  })

  it('accepts safe external URLs but rejects unsafe schemes', async () => {
    const module = await import('../../app/windowManager.js')

    expect(module.isSafeExternalUrl('https://example.com')).toBe(true)
    expect(module.isSafeExternalUrl('mailto:test@example.com')).toBe(false)
    expect(module.isSafeExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('redirects unsafe main-frame navigation to the external browser', async () => {
    const module = await import('../../app/windowManager.js')
    const listeners = new Map<
      string,
      (event: { preventDefault: () => void }, url: string) => void
    >()
    const setWindowOpenHandler = vi.fn()
    const on = vi.fn(
      (event: string, handler: (event: { preventDefault: () => void }, url: string) => void) => {
        listeners.set(event, handler)
      }
    )
    const preventDefault = vi.fn()

    module.hardenWindowWebContents({
      webContents: {
        setWindowOpenHandler,
        on
      }
    } as never)

    const willNavigate = listeners.get('will-navigate')
    expect(willNavigate).toBeTypeOf('function')

    willNavigate?.({ preventDefault }, 'https://example.com/docs')

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/docs')
  })

  it('reveals the main window after dom-ready without waiting for the timeout fallback', async () => {
    vi.useFakeTimers()
    browserWindowCtor.mockImplementation(function MockBrowserWindowConstructor() {
      return new MockBrowserWindow()
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const module = await import('../../app/windowManager.js')

    const mainWindow = (await module.createWindow()) as unknown as MockBrowserWindow

    mainWindow.webContents.emit('dom-ready')
    await vi.advanceTimersByTimeAsync(100)
    mainWindow.webContents.emit('did-finish-load')
    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(10000)

    expect(mainWindow.show).toHaveBeenCalledTimes(1)
    expect(mainWindow.setSkipTaskbar).toHaveBeenCalledWith(false)
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[Window] Main window did not report readiness in time; revealing it as a fallback.'
    )

    warnSpy.mockRestore()
  })
})
