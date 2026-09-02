import { BrowserWindow, clipboard, nativeImage } from 'electron'

import { failure, success } from '../../../shared/lib/typedIpc.js'
import { APP_CONFIG } from '../../app/constants.js'
import { requireTrustedIpcSender } from '../../core/ipcSecurity.js'
import { Logger } from '../../core/logger.js'
import { registerIpcHandler } from '../../core/typedIpcMain.js'

const MAX_CAPTURE_DIMENSION = 16384
const MAX_CAPTURE_AREA = 50 * 1024 * 1024 // ~50MP — prevents OOM via 16384x16384 (268MP) rect
const MAX_DATA_URL_LENGTH = 50 * 1024 * 1024 // 50 MB — prevents memory exhaustion via oversized base64 payloads

/** Minimum interval between successive screen captures (ms). */
const CAPTURE_THROTTLE_MS = 500
/** Maximum concurrent capture operations. */
const MAX_CONCURRENT_CAPTURES = 1

let lastCaptureTime = 0
let activeCaptures = 0

interface ClipboardSnapshot {
  text?: string
  html?: string
  image?: Electron.NativeImage
}

/**
 * Stack of clipboard snapshots taken right before COPY_IMAGE overwrites the
 * clipboard. Nested sends (two tabs sending screenshots concurrently) push
 * separate entries; the FINAL restore unwinds to the user's true original
 * content instead of an intermediate app-copied image.
 */
const MAX_CLIPBOARD_SNAPSHOTS = 8
let clipboardSnapshots: ClipboardSnapshot[] = []

function snapshotClipboard(): void {
  try {
    if (clipboardSnapshots.length >= MAX_CLIPBOARD_SNAPSHOTS) return
    let text: string | undefined
    let html: string | undefined
    let image: Electron.NativeImage | undefined
    try {
      const t = clipboard.readText()
      if (t) text = t
    } catch {}
    try {
      const h = clipboard.readHTML()
      if (h) html = h
    } catch {}
    try {
      const img = clipboard.readImage()
      if (img && !img.isEmpty()) image = img
    } catch {}

    clipboardSnapshots.push({
      text,
      html,
      image
    })
  } catch (error) {
    Logger.warn('[Clipboard] Failed to snapshot clipboard:', error)
  }
}

function restoreClipboard(): boolean {
  const snapshot = clipboardSnapshots.pop()
  if (!snapshot) return false

  // Inner cycle of a nested send: leave the current content in place; the
  // outermost restore writes the user's original content back.
  if (clipboardSnapshots.length > 0) return true

  try {
    if (snapshot.image) {
      clipboard.writeImage(snapshot.image)
    } else if (snapshot.html) {
      clipboard.writeHTML(snapshot.html)
    } else if (snapshot.text !== undefined) {
      clipboard.writeText(snapshot.text)
    } else {
      clipboard.clear()
    }
    return true
  } catch (error) {
    Logger.error('[Clipboard] Failed to restore clipboard:', error)
    return false
  }
}

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
            rect.height > MAX_CAPTURE_DIMENSION ||
            rect.width * rect.height > MAX_CAPTURE_AREA
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

        let image = nativeImage.createFromDataURL(dataUrl)

        // Chromium's GURL constructor has a ~2MB limit (kMaxURLChars = 2*1024*1024).
        // High-res screenshots and full-page renders larger than 2MB cause createFromDataURL
        // to return an empty image. Fallback: decode base64 to Buffer and use createFromBuffer.
        if (image.isEmpty() && typeof nativeImage.createFromBuffer === 'function') {
          try {
            const commaIndex = dataUrl.indexOf(',')
            if (commaIndex !== -1) {
              const base64Str = dataUrl.slice(commaIndex + 1)
              const buffer = Buffer.from(base64Str, 'base64')
              if (buffer.length > 0) {
                const bufferImage = nativeImage.createFromBuffer(buffer)
                if (bufferImage && !bufferImage.isEmpty()) {
                  image = bufferImage
                }
              }
            }
          } catch (err) {
            Logger.warn('[Clipboard] Buffer fallback decoding failed:', err)
          }
        }

        if (image.isEmpty()) return success(false)

        if (typeof image.getSize === 'function') {
          const imgSize = image.getSize()
          Logger.info(`[Clipboard] Image ready for clipboard: ${imgSize.width}x${imgSize.height}`)
        }

        snapshotClipboard()

        // Windows clipboard locks can be transiently held by other apps
        // (Clipboard history, Office, etc.). Retry with short backoff.
        let writeSuccess = false
        let lastError: unknown = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            clipboard.writeImage(image)
            writeSuccess = true
            break
          } catch (err) {
            lastError = err
            if (attempt < 2) {
              await new Promise<void>((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
            }
          }
        }

        if (!writeSuccess) {
          Logger.error('[Clipboard] Copy failed after retries:', lastError)
          return success(false)
        }

        // Do not mutate the NativeImage after writeImage – on Linux the
        // object is reference-counted and the clipboard may still hold a
        // reference. Resizing would corrupt the clipboard contents. Let GC
        // handle the temporary image.

        return success(true)
      } catch (error) {
        Logger.error('[Clipboard] Copy failed:', error)
        return success(false)
      }
    },
    requireTrustedIpcSender,
    success(false)
  )

  registerIpcHandler(
    IPC_CHANNELS.RESTORE_CLIPBOARD,
    () => success(restoreClipboard()),
    requireTrustedIpcSender,
    success(false)
  )
}
