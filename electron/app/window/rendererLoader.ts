import { app, type BrowserWindow, dialog } from 'electron'
import path from 'path'

import {
  DEV_SERVER_POLL_MS,
  DEV_SERVER_TIMEOUT_MS,
  DEV_SERVER_URL,
  isDev,
  shouldOpenDevToolsOnStart
} from './environment'
import { generateCspNonce, getDevCsp, getStrictCsp } from '../../core/csp'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function isDevServerReachable() {
  let timeoutId: NodeJS.Timeout | null = null
  try {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 1500)
    const response = await fetch(DEV_SERVER_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/html' }
    })
    return response.ok
  } catch {
    return false
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function waitForDevServer() {
  const startedAt = Date.now()

  while (Date.now() - startedAt < DEV_SERVER_TIMEOUT_MS) {
    if (await isDevServerReachable()) {
      return true
    }
    await sleep(DEV_SERVER_POLL_MS)
  }

  return false
}

export async function loadRenderer(window: BrowserWindow) {
  const nonce = generateCspNonce()
  const csp = isDev ? getDevCsp() : getStrictCsp(nonce)

  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  if (!isDev) {
    window.setMenu(null)
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html')
    await window.loadFile(indexPath).catch(() => {
      dialog.showErrorBox('Load Error', `Index not found: ${indexPath}`)
    })
    return
  }

  const devServerReady = await waitForDevServer()
  if (!devServerReady) {
    throw new Error(
      `Renderer dev server was not reachable at ${DEV_SERVER_URL} within ${DEV_SERVER_TIMEOUT_MS / 1000} seconds. ` +
        'Start the app with `npm run dev`, or run `npm run dev:web` before `npm run dev:electron`.'
    )
  }

  await window.loadURL(DEV_SERVER_URL)
  if (shouldOpenDevToolsOnStart) {
    window.webContents.openDevTools({ mode: 'detach' })
  }
}
