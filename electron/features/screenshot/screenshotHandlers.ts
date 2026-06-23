import { BrowserWindow, clipboard, nativeImage } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc'
import { APP_CONFIG } from '../../app/constants'
import { requireTrustedIpcSender } from '../../core/ipcSecurity'
import { Logger } from '../../core/logger'
import { registerIpcHandler } from '../../core/typedIpcMain'

const MAX_CAPTURE_DIMENSION = 16384
const MAX_DATA_URL_LENGTH = 50 * 1024 * 1024 // 50 MB — prevents memory exhaustion via oversized base64 payloads

/** Minimum interval between successive screen captures (ms). */
const CAPTURE_THROTTLE_MS = 500
/** Maximum concurrent capture operations. */
const MAX_CONCURRENT_CAPTURES = 1

let lastCaptureTime = 0
let activeCaptures = 0

export function registerScreenshotHandlers() {
  const { IPC_CHANNELS } = APP_CONFIG

  registerIpcHandler(
    IPC_CHANNELS.CAPTURE_SCREEN,
    async (event, rect?) => {
      try {
        const now = Date.now()
        if (
          now - lastCaptureTime < CAPTURE_THROTTLE_MS ||
          activeCaptures >= MAX_CONCURRENT_CAPTURES
        ) {
          Logger.warn('[Screenshot] Capture rejected: rate-limited')
          return failure('internal_error', 'Capture rejected: rate-limited')
        }

        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win || win.isDestroyed()) return failure('internal_error', 'Window not available')

        if (rect) {
          if (
            typeof rect.x !== 'number' ||
            typeof rect.y !== 'number' ||
            typeof rect.width !== 'number' ||
            typeof rect.height !== 'number' ||
            !Number.isFinite(rect.x) ||
            !Number.isFinite(rect.y) ||
            !Number.isFinite(rect.width) ||
            !Number.isFinite(rect.height) ||
            rect.width <= 0 ||
            rect.height <= 0 ||
            rect.width > MAX_CAPTURE_DIMENSION ||
            rect.height > MAX_CAPTURE_DIMENSION
          ) {
            Logger.warn('[Screenshot] Capture rejected: invalid or out-of-bounds rect', {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            })
            return failure('internal_error', 'Invalid or out-of-bounds rect')
          }
        }

        lastCaptureTime = now
        activeCaptures++
        try {
          const image = await win.webContents.capturePage(rect)
          return success(image.toDataURL())
        } finally {
          activeCaptures--
        }
      } catch (error) {
        Logger.error('[Screenshot] Capture failed:', error)
        return failure('internal_error', (error as Error).message)
      }
    },
    requireTrustedIpcSender,
    failure('unauthorized', 'Not authorized')
  )

  registerIpcHandler(
    IPC_CHANNELS.COPY_IMAGE,
    async (event, dataUrl: string) => {
      try {
        if (!dataUrl?.startsWith('data:image/')) return success(false)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          Logger.warn('[Clipboard] Copy rejected: data URL exceeds size limit')
          return success(false)
        }

        if (dataUrl.length > 1024 * 1024) {
          Logger.info(
            `[Clipboard] Decoding large image: ${(dataUrl.length / 1024 / 1024).toFixed(1)} MB Base64`
          )
          await new Promise<void>((resolve) => setImmediate(resolve))
        }

        const image = nativeImage.createFromDataURL(dataUrl)
        if (image.isEmpty()) return success(false)
        clipboard.writeImage(image)

        typeof image.resize === 'function' && image.resize({ width: 1, height: 1 })

        return success(true)
      } catch (error) {
        Logger.error('[Clipboard] Copy failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )
}
