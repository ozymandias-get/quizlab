import { beforeEach, describe, expect, it, vi } from 'vitest'

const waitForQuitFlush = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({ dialog: { showMessageBox } }))
vi.mock('../../core/logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../../app/quitFlushGate.js', () => ({ waitForQuitFlush }))
vi.mock('../../app/constants.js', () => ({
  APP_CONFIG: { WINDOW: { MIN_WIDTH: 800, MIN_HEIGHT: 600 } }
}))
vi.mock('../../app/reloadShortcut.js', () => ({ isReloadShortcut: () => true }))
vi.mock('../../app/window/environment.js', () => ({
  DEV_SERVER_URL: '',
  isDev: false,
  MAIN_WINDOW_REVEAL_TIMEOUT_MS: 0,
  MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS: 0,
  MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS: 0
}))
vi.mock('../../app/window/rendererLoader.js', () => ({
  loadRenderer: vi.fn(async () => undefined)
}))
vi.mock('../../app/window/security.js', () => ({ hardenWindowWebContents: vi.fn() }))
vi.mock('../../app/window/sessions.js', () => ({ setupSessions: vi.fn() }))
vi.mock('../../app/window/state.js', () => ({
  loadWindowState: vi.fn(async () => ({ width: 800, height: 600, isMaximized: false })),
  saveWindowState: vi.fn(),
  clampWindowStateToDisplay: vi.fn()
}))
vi.mock('../../app/windowReveal.js', () => ({
  configureWindowReveal: vi.fn(() => vi.fn())
}))

interface FakeWindow {
  isDestroyed: () => boolean
  maximize: ReturnType<typeof vi.fn>
  on: (event: string, handler: (event: { preventDefault(): void }) => void) => void
  close: ReturnType<typeof vi.fn>
  webContents: {
    on: (event: string, handler: (event: unknown, input: unknown) => void) => void
    reload: ReturnType<typeof vi.fn>
    reloadIgnoringCache: ReturnType<typeof vi.fn>
  }
}

let fakeWindow: FakeWindow
let closeListeners: Array<(event: { preventDefault(): void }) => void>
let inputListeners: Array<(event: unknown, input: unknown) => void>

function makeWindow(): FakeWindow {
  closeListeners = []
  inputListeners = []
  const window: FakeWindow = {
    isDestroyed: () => false,
    maximize: vi.fn(),
    on: (event, handler) => {
      if (event === 'close') closeListeners.push(handler)
    },
    close: vi.fn(),
    webContents: {
      on: (event, handler) => {
        if (event === 'before-input-event') inputListeners.push(handler)
      },
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn()
    }
  }
  // Electron fires `close` again for our own close() call. The windowManager
  // guard must make that second event a no-op.
  window.close.mockImplementation(() => {
    for (const handler of closeListeners) handler({ preventDefault: () => undefined })
  })
  return window
}

vi.mock('../../app/window/windows.js', () => ({
  createMainBrowserWindow: () => fakeWindow,
  resolveIconPath: () => 'icon'
}))

const { createWindow } = await import('../../app/windowManager.js')

function fireReload(): void {
  for (const handler of inputListeners) handler({ preventDefault: () => undefined }, {})
}

function fireClose(): void {
  for (const handler of closeListeners) handler({ preventDefault: () => undefined })
}

describe('windowManager shutdown lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeWindow = makeWindow()
    waitForQuitFlush.mockResolvedValue(true)
  })

  it('runs only the latest of an overlapping reload and close', async () => {
    await createWindow()
    fireReload()
    fireClose()

    // Both requests share one flush → one IPC request.
    expect(waitForQuitFlush).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalledTimes(1))

    expect(fakeWindow.webContents.reload).not.toHaveBeenCalled()
    expect(fakeWindow.webContents.reloadIgnoringCache).not.toHaveBeenCalled()
  })

  it('performs neither action when the shared decision is cancelled', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockResolvedValue({ response: 2 })
    await createWindow()
    fireReload()
    fireClose()

    await vi.waitFor(() => expect(showMessageBox).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    await Promise.resolve()

    expect(waitForQuitFlush).toHaveBeenCalledTimes(1)
    expect(fakeWindow.close).not.toHaveBeenCalled()
    expect(fakeWindow.webContents.reload).not.toHaveBeenCalled()
    expect(fakeWindow.webContents.reloadIgnoringCache).not.toHaveBeenCalled()
  })
})
