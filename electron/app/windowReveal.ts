import { dialog } from 'electron'

interface WindowLike {
  isDestroyed(): boolean
  isVisible(): boolean
  show(): void
  setSkipTaskbar(skip: boolean): void
  once(event: 'ready-to-show', listener: () => void): this
  on(event: 'closed', listener: () => void): this
  webContents: {
    isLoadingMainFrame(): boolean
    once(event: 'dom-ready' | 'did-finish-load', listener: () => void): void
    on(
      event: 'did-fail-load',
      listener: (
        event: Electron.Event,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean
      ) => void
    ): void
  }
}

interface ConfigureWindowRevealOptions {
  window: WindowLike
  isDev: boolean
  devServerUrl: string
  revealTimeoutMs: number
  domReadyRevealDelayMs: number
  didFinishLoadRevealDelayMs: number
  destroySplashWindow: () => void
}

type RevealReason = 'dom-ready' | 'did-fail-load' | 'did-finish-load' | 'ready-to-show' | 'timeout'

export function configureWindowReveal(options: ConfigureWindowRevealOptions): () => void {
  const {
    window,
    isDev,
    devServerUrl,
    revealTimeoutMs,
    domReadyRevealDelayMs,
    didFinishLoadRevealDelayMs,
    destroySplashWindow
  } = options

  let revealTimer: NodeJS.Timeout | null = null
  let hasRevealedMainWindow = false

  const clearRevealTimer = () => {
    if (!revealTimer) return
    clearTimeout(revealTimer)
    revealTimer = null
  }

  const revealMainWindow = (reason: RevealReason) => {
    if (hasRevealedMainWindow) return
    hasRevealedMainWindow = true
    clearRevealTimer()
    if (window.isDestroyed()) return
    if (reason === 'timeout' && window.webContents.isLoadingMainFrame()) {
      console.warn(
        '[Window] Main window did not report readiness in time; revealing it as a fallback.'
      )
    }
    destroySplashWindow()
    window.setSkipTaskbar(false)
    if (!window.isVisible()) {
      window.show()
    }
  }

  const scheduleReveal = (reason: 'dom-ready' | 'did-finish-load', delayMs: number) => {
    setTimeout(() => revealMainWindow(reason), delayMs)
  }

  revealTimer = setTimeout(() => {
    revealMainWindow('timeout')
  }, revealTimeoutMs)

  window.once('ready-to-show', () => revealMainWindow('ready-to-show'))
  window.webContents.once('dom-ready', () => {
    scheduleReveal('dom-ready', domReadyRevealDelayMs)
  })
  window.webContents.once('did-finish-load', () => {
    scheduleReveal('did-finish-load', didFinishLoadRevealDelayMs)
  })
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return
      console.error(
        `[Window] Failed to load ${validatedURL || 'main window'} (${errorCode}): ${errorDescription}`
      )
      revealMainWindow('did-fail-load')
      const isDevRendererFailure = isDev && (validatedURL || '').startsWith(devServerUrl)
      dialog.showErrorBox(
        isDevRendererFailure ? 'Renderer Dev Server Unavailable' : 'Load Error',
        isDevRendererFailure
          ? `Failed to load the renderer from ${validatedURL || devServerUrl}.\n\n` +
              `${errorDescription} (${errorCode})\n\n` +
              'Run `npm run dev` to start both Vite and Electron, or start Vite with `npm run dev:web` before `npm run dev:electron`.'
          : `Failed to load ${validatedURL || 'the main window'}.\n\n${errorDescription} (${errorCode})`
      )
    }
  )

  return clearRevealTimer
}
