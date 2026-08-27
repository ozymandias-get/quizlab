import { app } from 'electron'

import { APP_CONFIG } from '../../app/constants.js'

const { IDLE_TIMEOUT_MS } = APP_CONFIG.CLEANUP

let isIdle = false
let idleTimer: NodeJS.Timeout | null = null
let onBlur: (() => void) | null = null
let onFocus: (() => void) | null = null

function setIdleState(idle: boolean): void {
  isIdle = idle
}

export function startIdleDetection(onIdle: () => void): void {
  // Prevent duplicate listeners on repeated start
  if (onBlur) app.off('browser-window-blur', onBlur)
  if (onFocus) app.off('browser-window-focus', onFocus)

  onBlur = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      setIdleState(true)
      onIdle()
    }, IDLE_TIMEOUT_MS)
  }

  onFocus = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    setIdleState(false)
  }

  app.on('browser-window-blur', onBlur)
  app.on('browser-window-focus', onFocus)
}

export function stopIdleDetection(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (onBlur) {
    app.off('browser-window-blur', onBlur)
    onBlur = null
  }
  if (onFocus) {
    app.off('browser-window-focus', onFocus)
    onFocus = null
  }
  setIdleState(false)
}

export function isIdleState(): boolean {
  return isIdle
}
