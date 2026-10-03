import { beforeEach, describe, expect, it, vi } from 'vitest'

const showErrorBox = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock-app')
  },
  dialog: {
    showErrorBox
  }
}))

describe('window/rendererLoader', () => {
  beforeEach(() => {
    vi.resetModules()
    showErrorBox.mockReset()
    vi.unstubAllGlobals()
  })

  it('loads dev server URL when reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const module = await import('../../../app/window/rendererLoader.js')
    const window = {
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn(),
      setMenu: vi.fn(),
      webContents: {
        openDevTools: vi.fn(),
        session: {
          webRequest: {
            onHeadersReceived: vi.fn()
          }
        }
      }
    } as any

    await module.loadRenderer(window)

    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173')
  })

  it('shows an error box when production index is missing', async () => {
    vi.doMock('../../../app/window/environment', () => ({
      isDev: false,
      DEV_SERVER_URL: 'http://localhost:5173',
      DEV_SERVER_TIMEOUT_MS: 30000,
      DEV_SERVER_POLL_MS: 500,
      shouldOpenDevToolsOnStart: false
    }))
    const module = await import('../../../app/window/rendererLoader.js')
    const window = {
      loadURL: vi.fn(),
      loadFile: vi.fn().mockRejectedValue(new Error('missing')),
      setMenu: vi.fn(),
      webContents: {
        openDevTools: vi.fn(),
        session: {
          webRequest: {
            onHeadersReceived: vi.fn()
          }
        }
      }
    } as any

    await module.loadRenderer(window)

    expect(showErrorBox).toHaveBeenCalled()
  })

  it('installs the CSP header rewrite only once per session', async () => {
    // window.webContents.session is the shared defaultSession, and
    // createWindow() runs again on macOS 'activate'. Registering per call added
    // another full header rewrite for every response.
    vi.doMock('../../../app/window/environment', () => ({
      isDev: false,
      DEV_SERVER_URL: 'http://localhost:5173',
      DEV_SERVER_TIMEOUT_MS: 30000,
      DEV_SERVER_POLL_MS: 500,
      shouldOpenDevToolsOnStart: false
    }))
    const module = await import('../../../app/window/rendererLoader.js')

    const onHeadersReceived = vi.fn()
    const sharedSession = { webRequest: { onHeadersReceived } }
    const makeWindow = () =>
      ({
        loadURL: vi.fn(),
        loadFile: vi.fn().mockResolvedValue(undefined),
        setMenu: vi.fn(),
        webContents: { openDevTools: vi.fn(), session: sharedSession }
      }) as any

    await module.loadRenderer(makeWindow())
    await module.loadRenderer(makeWindow())
    await module.loadRenderer(makeWindow())

    expect(onHeadersReceived).toHaveBeenCalledTimes(1)
  })

  it('installs the CSP rewrite separately for distinct sessions', async () => {
    vi.doMock('../../../app/window/environment', () => ({
      isDev: false,
      DEV_SERVER_URL: 'http://localhost:5173',
      DEV_SERVER_TIMEOUT_MS: 30000,
      DEV_SERVER_POLL_MS: 500,
      shouldOpenDevToolsOnStart: false
    }))
    const module = await import('../../../app/window/rendererLoader.js')

    const onHeadersA = vi.fn()
    const onHeadersB = vi.fn()
    const makeWindow = (session: unknown) =>
      ({
        loadURL: vi.fn(),
        loadFile: vi.fn().mockResolvedValue(undefined),
        setMenu: vi.fn(),
        webContents: { openDevTools: vi.fn(), session }
      }) as any

    await module.loadRenderer(makeWindow({ webRequest: { onHeadersReceived: onHeadersA } }))
    await module.loadRenderer(makeWindow({ webRequest: { onHeadersReceived: onHeadersB } }))

    expect(onHeadersA).toHaveBeenCalledTimes(1)
    expect(onHeadersB).toHaveBeenCalledTimes(1)
  })
})
