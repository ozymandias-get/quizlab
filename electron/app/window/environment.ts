import { app } from 'electron'

export const isDev = !app.isPackaged
export const DEV_SERVER_URL = process.env.APP_RENDERER_URL || 'http://localhost:5173'
export const DEV_SERVER_TIMEOUT_MS = 30000
export const DEV_SERVER_POLL_MS = 500
export const MAIN_WINDOW_REVEAL_TIMEOUT_MS = 10000
export const MAIN_WINDOW_DOM_READY_REVEAL_DELAY_MS = 100
export const MAIN_WINDOW_DID_FINISH_LOAD_REVEAL_DELAY_MS = 250
export const shouldOpenDevToolsOnStart = process.env.APP_OPEN_DEVTOOLS === '1'

export const DEV_SERVER_ORIGIN = (() => {
  try {
    return new URL(DEV_SERVER_URL).origin
  } catch {
    return null
  }
})()
