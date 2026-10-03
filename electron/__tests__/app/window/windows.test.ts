import { beforeEach, describe, expect, it, vi } from 'vitest'

const browserWindowCtor = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock-user-data'),
    getAppPath: vi.fn(() => '/mock-app')
  },
  BrowserWindow: browserWindowCtor
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true)
  }
}))

const loadWindowsModule = async () => import('../../../app/window/windows.js')

const getWebPreferences = async () => {
  const { createMainBrowserWindow } = await loadWindowsModule()
  createMainBrowserWindow({
    width: 1280,
    height: 800,
    x: 0,
    y: 0,
    isMaximized: false
  })
  expect(browserWindowCtor).toHaveBeenCalledTimes(1)
  const options = browserWindowCtor.mock.calls[0][0] as { webPreferences: Record<string, unknown> }
  return options.webPreferences
}

describe('createMainBrowserWindow webPreferences', () => {
  beforeEach(() => {
    vi.resetModules()
    browserWindowCtor.mockReset()
    browserWindowCtor.mockImplementation(function MockBrowserWindowConstructor() {
      return { on: vi.fn() }
    })
    Reflect.deleteProperty(process, 'resourcesPath')
    Object.defineProperty(process, 'resourcesPath', {
      value: '/mock-resources',
      configurable: true
    })
  })

  it('keeps Chromium background throttling enabled on the host window', async () => {
    // Electron docs for `webPreferences.backgroundThrottling`:
    //  - "When at least one webContents displayed in a single browserWindow has
    //     disabled backgroundThrottling then frames will be drawn and swapped
    //     for the whole window and other webContents displayed by it."
    //  - "This also affects the Page Visibility API."
    // Disabling it here silently overrode the per-`<webview>` setting in
    // AiSession.tsx (backgroundThrottling=yes) and killed every
    // `visibilitychange` consumer in the renderer.
    expect((await getWebPreferences()).backgroundThrottling).toBe(true)
  })

  it('never disables background throttling through a truthy-but-false value', async () => {
    const prefs = await getWebPreferences()
    // Guards against a regression expressed as `!!something` or a constant.
    expect(prefs.backgroundThrottling).not.toBe(false)
    expect(prefs.backgroundThrottling).not.toBe(0)
  })

  it('does not weaken any web security preference', async () => {
    const prefs = await getWebPreferences()
    expect(prefs.nodeIntegration).toBe(false)
    expect(prefs.contextIsolation).toBe(true)
    expect(prefs.sandbox).toBe(true)
    expect(prefs.webSecurity).toBe(true)
    expect(prefs.allowRunningInsecureContent).toBe(false)
    expect(prefs.experimentalFeatures).toBe(false)
  })
})
