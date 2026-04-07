import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureWindowReveal } from '../../app/windowReveal'

const { showErrorBox } = vi.hoisted(() => ({
  showErrorBox: vi.fn()
}))

vi.mock('electron', () => ({
  dialog: { showErrorBox }
}))

type Handler = (...args: unknown[]) => void

class MockEmitter {
  private onceMap = new Map<string, Handler[]>()
  private onMap = new Map<string, Handler[]>()

  once(event: string, handler: Handler) {
    const list = this.onceMap.get(event) ?? []
    list.push(handler)
    this.onceMap.set(event, list)
    return this
  }

  on(event: string, handler: Handler) {
    const list = this.onMap.get(event) ?? []
    list.push(handler)
    this.onMap.set(event, list)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    const once = this.onceMap.get(event) ?? []
    this.onceMap.delete(event)
    for (const fn of once) fn(...args)
    const on = this.onMap.get(event) ?? []
    for (const fn of on) fn(...args)
  }
}

function createWindowMock() {
  const windowEmitter = new MockEmitter()
  const webContents = new MockEmitter() as MockEmitter & { isLoadingMainFrame: () => boolean }
  webContents.isLoadingMainFrame = vi.fn(() => false)

  let visible = false
  const window = {
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => visible),
    show: vi.fn(() => {
      visible = true
    }),
    setSkipTaskbar: vi.fn(),
    once: vi.fn((event: 'ready-to-show', listener: () => void) => {
      windowEmitter.once(event, listener)
      return window as never
    }),
    on: vi.fn((event: 'closed', listener: () => void) => {
      windowEmitter.on(event, listener)
      return window as never
    }),
    webContents
  }
  return {
    windowEmitter,
    webContentsEmitter: webContents,
    window
  }
}

describe('windowReveal', () => {
  beforeEach(() => {
    showErrorBox.mockReset()
  })

  it('reveals once when ready-to-show wins the race', () => {
    const destroySplashWindow = vi.fn()
    const { window, windowEmitter, webContentsEmitter } = createWindowMock()
    configureWindowReveal({
      window,
      isDev: true,
      devServerUrl: 'http://localhost:5173',
      revealTimeoutMs: 1000,
      domReadyRevealDelayMs: 100,
      didFinishLoadRevealDelayMs: 150,
      destroySplashWindow
    })

    windowEmitter.emit('ready-to-show')
    webContentsEmitter.emit('dom-ready')
    webContentsEmitter.emit('did-finish-load')

    expect(destroySplashWindow).toHaveBeenCalledTimes(1)
    expect(window.show).toHaveBeenCalledTimes(1)
    expect(window.setSkipTaskbar).toHaveBeenCalledWith(false)
  })

  it('reveals on did-fail-load for main frame errors', () => {
    const destroySplashWindow = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { window, webContentsEmitter } = createWindowMock()
    configureWindowReveal({
      window,
      isDev: false,
      devServerUrl: 'http://localhost:5173',
      revealTimeoutMs: 1000,
      domReadyRevealDelayMs: 100,
      didFinishLoadRevealDelayMs: 150,
      destroySplashWindow
    })

    webContentsEmitter.emit(
      'did-fail-load',
      {},
      -100,
      'net error',
      'https://example.com',
      true
    )

    expect(destroySplashWindow).toHaveBeenCalledTimes(1)
    expect(window.show).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
    expect(showErrorBox).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
