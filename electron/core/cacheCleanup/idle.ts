import { app } from 'electron'

import { APP_CONFIG } from '../../app/constants.js'

const { IDLE_TIMEOUT_MS } = APP_CONFIG.CLEANUP

let isIdle = false
let idleTimer: NodeJS.Timeout | null = null

function setIdleState(idle: boolean): void {
  isIdle = idle
}

export function startIdleDetection(onIdle: () => void): void {
  app.on('browser-window-blur', () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      setIdleState(true)
      onIdle()
    }, IDLE_TIMEOUT_MS)
  })

  app.on('browser-window-focus', () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    setIdleState(false)
  })
}

export function stopIdleDetection(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  setIdleState(false)
}

export function isIdleState(): boolean {
  return isIdle
}
