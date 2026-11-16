import { beforeEach, describe, expect, it, vi } from 'vitest'

const waitForQuitFlush = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())
const loadRenderer = vi.hoisted(() => vi.fn<() => Promise<void>>())
const saveWindowState = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
const createMainBrowserWindow = vi.hoisted(() => vi.fn())

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
vi.mock('../../app/window/rendererLoader.js', () => ({ loadRenderer }))
vi.mock('../../app/window/security.js', () => ({ hardenWindowWebContents: vi.fn() }))
vi.mock('../../app/window/sessions.js', () => ({ setupSessions: vi.fn() }))
vi.mock('../../app/window/state.js', () => ({
  loadWindowState: vi.fn(async () => ({ width: 800, height: 600, isMaximized: false })),
  saveWindowState,
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
  destroy: ReturnType<typeof vi.fn>
  webContents: {
    on: (event: string, handler: (event: unknown, input: unknown) => void) => void
    reload: ReturnType<typeof vi.fn>
    reloadIgnoringCache: ReturnType<typeof vi.fn>
  }
}

let fakeWindow: FakeWindow
let closeListeners: Array<(event: { preventDefault(): void }) => void>
let inputListeners: Array<(event: unknown, input: unknown) => void>
let closedListeners: Array<() => void>

function makeWindow(): FakeWindow {
  // Each window keeps its own listener arrays. The module-level aliases below
  // always point at the most recently created window, like Electron's real
  // single main window that `getMainWindow()` hands out.
  const ownCloseListeners: Array<(event: { preventDefault(): void }) => void> = []
  const ownInputListeners: Array<(event: unknown, input: unknown) => void> = []
  const ownClosedListeners: Array<() => void> = []
  closeListeners = ownCloseListeners
  inputListeners = ownInputListeners
  closedListeners = ownClosedListeners

  const window: FakeWindow = {
    isDestroyed: () => false,
    maximize: vi.fn(),
    on: (event, handler) => {
      if (event === 'close') ownCloseListeners.push(handler)
      if (event === 'closed') ownClosedListeners.push(handler as () => void)
    },
    close: vi.fn(),
    destroy: vi.fn(),
    webContents: {
      on: (event, handler) => {
        if (event === 'before-input-event') ownInputListeners.push(handler)
      },
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn()
    }
  }
  // Electron fires `close` again for our own close() call. The windowManager
  // guard must make that second event a no-op.
  window.close.mockImplementation(() => {
    for (const handler of ownCloseListeners) handler({ preventDefault: () => undefined })
  })
  window.destroy.mockImplementation(() => {
    for (const handler of ownClosedListeners) handler()
  })
  return window
}

vi.mock('../../app/window/windows.js', () => ({
  createMainBrowserWindow: () => createMainBrowserWindow(),
  resolveIconPath: () => 'icon'
}))

const { createWindow, getMainWindow } = await import('../../app/windowManager.js')

function fireReload(): void {
  for (const handler of inputListeners) handler({ preventDefault: () => undefined }, {})
}

function fireClose(): void {
  for (const handler of closeListeners) handler({ preventDefault: () => undefined })
}

function fireClosed(): void {
  for (const handler of closedListeners) handler()
}

describe('windowManager shutdown lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeWindow = makeWindow()
    waitForQuitFlush.mockReset().mockResolvedValue(true)
    loadRenderer.mockReset().mockResolvedValue(undefined)
    saveWindowState.mockReset().mockResolvedValue(true)
    createMainBrowserWindow.mockReset().mockImplementation(() => fakeWindow)
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

  it('keeps mainWindow in sync when the window closes during the renderer load', async () => {
    let releaseLoad!: () => void
    loadRenderer.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseLoad = resolve
        })
    )

    const creating = createWindow()
    await vi.waitFor(() => expect(loadRenderer).toHaveBeenCalledTimes(1))

    // The window is closed while loadRenderer is still pending.
    fireClosed()
    releaseLoad()
    await creating

    expect(getMainWindow()).toBeNull()
  })

  it('clears the stale window when the renderer load rejects', async () => {
    loadRenderer.mockRejectedValueOnce(new Error('dev server down'))

    await expect(createWindow()).rejects.toThrow('dev server down')
    expect(getMainWindow()).toBeNull()
  })

  it('closes the original window even if mainWindow is replaced during the flush', async () => {
    let releaseFlush!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFlush = resolve
        })
    )

    await createWindow()
    const firstWindow = fakeWindow
    fireClose()
    await vi.waitFor(() => expect(waitForQuitFlush).toHaveBeenCalledTimes(1))

    // A second createWindow() makes a different window the module-level mainWindow.
    const secondWindow = makeWindow()
    secondWindow.close.mockImplementation(() => undefined)
    createMainBrowserWindow.mockImplementationOnce(() => secondWindow)
    await createWindow()

    releaseFlush(true)
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(firstWindow.close).toHaveBeenCalledTimes(1)
    expect(secondWindow.close).not.toHaveBeenCalled()
  })

  it('does not destroy the window until its state save has finished', async () => {
    let releaseSave!: () => void
    let releaseFlush!: (saved: boolean) => void
    saveWindowState.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseSave = () => resolve(true)
        })
    )
    waitForQuitFlush.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFlush = resolve
        })
    )

    await createWindow()
    fireClose()
    await vi.waitFor(() => expect(saveWindowState).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(waitForQuitFlush).toHaveBeenCalledTimes(1))

    // The renderer already answered "saved", but the state write is still in
    // flight; the window must not be destroyed before that write completes.
    releaseFlush(true)
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(fakeWindow.close).not.toHaveBeenCalled()

    releaseSave()
    await vi.waitFor(() => expect(fakeWindow.close).toHaveBeenCalledTimes(1))
  })
})
